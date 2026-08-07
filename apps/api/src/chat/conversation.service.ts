import { hasRole, type UserRole } from '@chatbot/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Transaction } from '../db/database.tokens';
import { conversations } from '../db/schema/conversation';
import { departments } from '../db/schema/department';
import { escalationTickets } from '../db/schema/escalation';
import { imageAssets, messageAttachments } from '../db/schema/image';
import { messageRatings, messages } from '../db/schema/message';
import type {
  CostBreakdown,
  LatencyBreakdown,
  RetrievedChunkRef,
} from '../db/schema/types';
import { TenantDb } from '../db/tenant-db.service';
import type { HistoryTurn } from './rewrite.service';

/** Quá ngưỡng im lặng này thì lượt hỏi tiếp được tính là hội thoại mới. */
const IDLE_MINUTES = 30;

/** Độ dài phần câu trả lời cũ đưa vào ngữ cảnh viết lại truy vấn. */
const ANSWER_PREVIEW_CHARS = 400;

const COMMAND_PATTERN = /^\/([a-z0-9-]+)\s*/;

/**
 * Truy vấn qua schema của drizzle thì cột timestamp về dạng `Date`, còn `execute()`
 * SQL thô thì về dạng chuỗi của Postgres. Nhận cả hai để chỗ gọi không phải nhớ
 * mình đang đi đường nào.
 */
const toIsoString = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

export type ParsedMessage = {
  /** `/slug` người dùng gõ, `null` nếu không gõ lệnh nào. */
  slug: string | null;
  /** `/all` — xoá bộ lọc phòng ban của cả hội thoại. */
  clearHint: boolean;
  text: string;
};

export type ConversationSummaryRow = {
  id: string;
  title: string;
  departmentSlug: string | null;
  messageCount: number;
  lastActivityAt: string;
};

export type ActiveConversation = {
  id: string;
  hintDepartmentId: string | null;
  hintDepartmentSlug: string | null;
  hintDepartmentName: string | null;
};

export type AssistantMessageRecord = {
  id: string;
  conversationId: string;
  content: string;
  citedHandles: string[];
  retrieved: RetrievedChunkRef[];
  latency: LatencyBreakdown;
  cost: CostBreakdown;
  tokensInput: number;
  tokensOutput: number;
};

/**
 * Lệnh `/tenphongban` tách khỏi nội dung câu hỏi ngay tại đây, trước mọi bước
 * khác — bước viết lại truy vấn không được nhìn thấy dấu gạch chéo, không thì nó
 * coi lệnh là một phần câu hỏi.
 */
export const parseMessage = (raw: string): ParsedMessage => {
  const trimmed = raw.trim();
  const matched = COMMAND_PATTERN.exec(trimmed);

  if (matched === null) return { slug: null, clearHint: false, text: trimmed };

  const command = matched[1] ?? '';
  const text = trimmed.slice(matched[0].length).trim();

  if (command === 'all') return { slug: null, clearHint: true, text };

  return { slug: command, clearHint: false, text };
};

@Injectable()
export class ConversationService {
  constructor(private readonly tenantDb: TenantDb) {}

  /**
   * Lấy hội thoại đang mở hoặc mở hội thoại mới, rồi áp bộ lọc phòng ban.
   *
   * Bộ lọc là "dính": không gõ lệnh thì giữ nguyên phòng của lượt trước. Chỉ `/slug`
   * khác hoặc `/all` mới đổi được — cơ chế tự nới lọc ở bước gate tuyệt đối không
   * đụng vào trường này, vì một lần nới mà xoá hint là mất ngữ cảnh cả hội thoại.
   */
  readonly start = async (input: {
    conversationId: string | null;
    userId: string;
    command: ParsedMessage;
    requestedSlug: string | null;
  }): Promise<ActiveConversation> =>
    this.tenantDb.run(async (tx, tenantId) => {
      const conversationId = await this.resolveConversation(
        tx,
        tenantId,
        input.conversationId,
        input.userId,
      );

      const wantedSlug = input.command.slug ?? input.requestedSlug;

      if (input.command.clearHint) {
        await tx
          .update(conversations)
          .set({ departmentHintId: null, lastActivityAt: new Date() })
          .where(eq(conversations.id, conversationId));

        return {
          id: conversationId,
          hintDepartmentId: null,
          hintDepartmentSlug: null,
          hintDepartmentName: null,
        };
      }

      if (wantedSlug !== null) {
        const found = await tx
          .select({
            id: departments.id,
            slug: departments.slug,
            name: departments.name,
          })
          .from(departments)
          .where(
            and(
              eq(departments.slug, wantedSlug),
              eq(departments.isActive, true),
            ),
          )
          .limit(1);

        const department = found[0];

        // Gõ nhầm một phòng không tồn tại thì giữ nguyên hint cũ, đừng im lặng
        // xoá bộ lọc rồi trả lời bằng tài liệu phòng khác.
        if (department !== undefined) {
          await tx
            .update(conversations)
            .set({
              departmentHintId: department.id,
              lastActivityAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));

          return {
            id: conversationId,
            hintDepartmentId: department.id,
            hintDepartmentSlug: department.slug,
            hintDepartmentName: department.name,
          };
        }
      }

      const current = await tx
        .select({
          hintId: conversations.departmentHintId,
          slug: departments.slug,
          name: departments.name,
        })
        .from(conversations)
        .leftJoin(
          departments,
          eq(departments.id, conversations.departmentHintId),
        )
        .where(eq(conversations.id, conversationId))
        .limit(1);

      const row = current[0];

      return {
        id: conversationId,
        hintDepartmentId: row?.hintId ?? null,
        hintDepartmentSlug: row?.slug ?? null,
        hintDepartmentName: row?.name ?? null,
      };
    });

  readonly history = async (
    conversationId: string,
    turns: number,
  ): Promise<HistoryTurn[]> =>
    this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(turns * 2);

      const userIds = rows
        .filter((row) => row.role === 'user')
        .map((row) => row.id);

      const captionByMessage = new Map<string, string>();
      if (userIds.length > 0) {
        const captions = await tx
          .select({
            messageId: messageAttachments.messageId,
            caption: imageAssets.caption,
          })
          .from(messageAttachments)
          .innerJoin(
            imageAssets,
            eq(imageAssets.id, messageAttachments.imageAssetId),
          )
          .where(inArray(messageAttachments.messageId, userIds))
          .orderBy(messageAttachments.ord);

        for (const row of captions) {
          const caption = (row.caption ?? '').trim();
          if (caption.length > 0 && !captionByMessage.has(row.messageId)) {
            captionByMessage.set(row.messageId, caption);
          }
        }
      }

      const ordered = rows.reverse();
      const history: HistoryTurn[] = [];

      for (const row of ordered) {
        if (row.role === 'user') {
          history.push({
            question: row.content,
            answerPreview: '',
            imageCaption: captionByMessage.get(row.id) ?? null,
          });
          continue;
        }

        const last = history.at(-1);
        if (last !== undefined && last.answerPreview.length === 0) {
          last.answerPreview = row.content.slice(0, ANSWER_PREVIEW_CHARS);
        }
      }

      return history.slice(-turns);
    });

  readonly appendUserMessage = async (input: {
    id: string;
    conversationId: string;
    content: string;
    rewrittenQuery: string;
    isFollowup: boolean;
    imageAssetIds: string[];
  }): Promise<void> => {
    await this.tenantDb.run(async (tx, tenantId) => {
      await tx.insert(messages).values({
        id: input.id,
        tenantId,
        conversationId: input.conversationId,
        role: 'user',
        content: input.content,
        rewrittenQuery: input.rewrittenQuery,
        isFollowup: input.isFollowup,
      });

      if (input.imageAssetIds.length > 0) {
        await tx.insert(messageAttachments).values(
          input.imageAssetIds.map((imageAssetId, ord) => ({
            tenantId,
            messageId: input.id,
            imageAssetId,
            ord,
          })),
        );
      }

      await tx
        .update(conversations)
        .set({ lastActivityAt: new Date() })
        .where(eq(conversations.id, input.conversationId));
    });
  };

  readonly appendAssistantMessage = async (
    record: AssistantMessageRecord,
  ): Promise<void> => {
    await this.tenantDb.run(async (tx, tenantId) => {
      await tx.insert(messages).values({
        id: record.id,
        tenantId,
        conversationId: record.conversationId,
        role: 'assistant',
        content: record.content,
        retrievedChunks: record.retrieved,
        citedChunkIds: record.citedHandles,
        tokensInput: record.tokensInput,
        tokensOutput: record.tokensOutput,
        latencyBreakdown: record.latency,
        costBreakdown: record.cost,
      });

      await tx
        .update(conversations)
        .set({ lastActivityAt: new Date() })
        .where(eq(conversations.id, record.conversationId));
    });
  };

  readonly delete = async (
    conversationId: string,
    userId: string,
  ): Promise<void> => {
    await this.tenantDb.run(async (tx) => {
      const deleted = await tx
        .delete(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId),
          ),
        )
        .returning({ id: conversations.id });

      if (deleted.length === 0) {
        throw new NotFoundException('Hội thoại không tồn tại');
      }
    });
  };

  /**
   * Danh sách hội thoại cho thanh bên. Tiêu đề lấy từ câu hỏi đầu tiên thay vì
   * thêm cột `title`: nhờ vậy không có bước đặt tên nào để quên, và tiêu đề luôn
   * đúng với thứ người dùng thật sự đã hỏi.
   *
   * Hội thoại rỗng bị loại — mỗi lần mở trang mà chưa hỏi gì cũng tạo một bản ghi,
   * hiện hết lên thì thanh bên đầy dòng trống.
   */
  readonly list = async (
    userId: string,
    limit: number,
  ): Promise<ConversationSummaryRow[]> =>
    this.tenantDb.run(async (tx) => {
      const result = await tx.execute<{
        id: string;
        title: string | null;
        department_slug: string | null;
        message_count: string;
        last_activity_at: string | Date;
      }>(sql`
        SELECT c.id,
               c.last_activity_at,
               dep.slug AS department_slug,
               (SELECT m.content
                  FROM messages m
                 WHERE m.conversation_id = c.id AND m.role = 'user'
                 ORDER BY m.created_at
                 LIMIT 1) AS title,
               (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
          FROM conversations c
          LEFT JOIN departments dep ON dep.id = c.department_hint_id
         WHERE c.user_id = ${userId}
           AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
         ORDER BY c.last_activity_at DESC
         LIMIT ${limit}
      `);

      return result.rows.map((row) => ({
        id: row.id,
        title: row.title ?? 'Hội thoại',
        departmentSlug: row.department_slug,
        messageCount: Number(row.message_count),
        lastActivityAt: toIsoString(row.last_activity_at),
      }));
    });

  /** Đổi hoặc tắt bộ lọc phòng ban ngay, không đợi tới lượt hỏi kế tiếp. */
  readonly setHint = async (
    conversationId: string,
    slug: string | null,
    userId: string,
  ): Promise<void> => {
    await this.tenantDb.run(async (tx) => {
      let departmentId: string | null = null;

      if (slug !== null) {
        const found = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(
            and(eq(departments.slug, slug), eq(departments.isActive, true)),
          )
          .limit(1);

        const department = found[0];
        if (department === undefined) {
          throw new NotFoundException('Phòng ban không tồn tại');
        }

        departmentId = department.id;
      }

      const updated = await tx
        .update(conversations)
        .set({ departmentHintId: departmentId })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId),
          ),
        )
        .returning({ id: conversations.id });

      if (updated[0] === undefined) {
        throw new NotFoundException('Không tìm thấy hội thoại');
      }
    });
  };

  readonly rateMessage = async (input: {
    messageId: string;
    rating: 'up' | 'down';
    comment: string | null;
    ratedBy: string;
  }): Promise<void> => {
    await this.tenantDb.run(async (tx, tenantId) => {
      const found = await tx
        .select({ id: messages.id })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .where(
          and(
            eq(messages.id, input.messageId),
            eq(conversations.userId, input.ratedBy),
          ),
        )
        .limit(1);

      if (found[0] === undefined) {
        throw new NotFoundException('Không tìm thấy câu trả lời để chấm');
      }

      await tx
        .insert(messageRatings)
        .values({
          tenantId,
          messageId: input.messageId,
          rating: input.rating,
          comment: input.comment,
          ratedBy: input.ratedBy,
        })
        .onConflictDoUpdate({
          target: [messageRatings.messageId, messageRatings.ratedBy],
          set: { rating: input.rating, comment: input.comment },
        });
    });
  };

  /**
   * Người ngoài hội thoại chỉ đọc được khi đang xử lý phiếu chuyển của chính
   * hội thoại đó — FR-5 bắt người phụ trách phải thấy ngữ cảnh để trả lời.
   * Không có phiếu thì trả 404 y như hội thoại không tồn tại, đừng xác nhận
   * cho người hỏi biết là có một hội thoại mang id đó.
   */
  readonly transcript = async (
    conversationId: string,
    viewer: { userId: string; role: UserRole },
  ) =>
    this.tenantDb.run(async (tx) => {
      const found = await tx
        .select({
          id: conversations.id,
          ownerId: conversations.userId,
          hintSlug: departments.slug,
          hintName: departments.name,
        })
        .from(conversations)
        .leftJoin(
          departments,
          eq(departments.id, conversations.departmentHintId),
        )
        .where(eq(conversations.id, conversationId))
        .limit(1);

      const conversation = found[0];
      if (conversation === undefined) {
        throw new NotFoundException('Không tìm thấy hội thoại');
      }

      if (conversation.ownerId !== viewer.userId) {
        const tickets = await tx
          .select({ id: escalationTickets.id })
          .from(escalationTickets)
          .where(eq(escalationTickets.conversationId, conversationId))
          .limit(1);

        const handling =
          hasRole(viewer.role, 'manager') && tickets[0] !== undefined;

        if (!handling) {
          throw new NotFoundException('Không tìm thấy hội thoại');
        }
      }

      const rows = await tx
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          citedChunkIds: messages.citedChunkIds,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);

      const ratingByMessage = new Map<string, 'up' | 'down'>();
      if (rows.length > 0) {
        const ratings = await tx
          .select({
            messageId: messageRatings.messageId,
            rating: messageRatings.rating,
          })
          .from(messageRatings)
          .where(
            and(
              inArray(
                messageRatings.messageId,
                rows.map((row) => row.id),
              ),
              eq(messageRatings.ratedBy, viewer.userId),
            ),
          );

        for (const row of ratings) {
          ratingByMessage.set(row.messageId, row.rating);
        }
      }

      const attachmentsByMessage = new Map<string, { imageId: string }[]>();
      if (rows.length > 0) {
        const attachmentRows = await tx
          .select({
            messageId: messageAttachments.messageId,
            imageAssetId: messageAttachments.imageAssetId,
          })
          .from(messageAttachments)
          .where(
            inArray(
              messageAttachments.messageId,
              rows.map((row) => row.id),
            ),
          )
          .orderBy(messageAttachments.ord);

        for (const row of attachmentRows) {
          const list = attachmentsByMessage.get(row.messageId) ?? [];
          list.push({ imageId: row.imageAssetId });
          attachmentsByMessage.set(row.messageId, list);
        }
      }

      return {
        id: conversation.id,
        departmentSlug: conversation.hintSlug,
        departmentName: conversation.hintName,
        messages: rows.map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          citedChunkIds: row.citedChunkIds ?? [],
          attachments: attachmentsByMessage.get(row.id) ?? [],
          myRating: ratingByMessage.get(row.id) ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    });

  private readonly resolveConversation = async (
    tx: Transaction,
    tenantId: string,
    conversationId: string | null,
    userId: string,
  ): Promise<string> => {
    if (conversationId !== null) {
      const found = await tx
        .select({
          id: conversations.id,
          lastActivityAt: conversations.lastActivityAt,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId),
          ),
        )
        .limit(1);

      const conversation = found[0];
      const idleMs = Date.now() - (conversation?.lastActivityAt.getTime() ?? 0);

      if (conversation !== undefined && idleMs <= IDLE_MINUTES * 60_000) {
        return conversation.id;
      }
    }

    const created = await tx
      .insert(conversations)
      .values({ tenantId, userId })
      .returning({ id: conversations.id });

    const conversation = created[0];
    if (conversation === undefined) {
      throw new Error('Không mở được hội thoại');
    }

    return conversation.id;
  };

  readonly deleteConversation = async (id: string): Promise<void> => {
    await this.tenantDb.run(async (tx) => {
      await tx.delete(conversations).where(eq(conversations.id, id));
    });
  };
}
