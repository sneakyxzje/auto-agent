import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Transaction } from '../db/database.tokens';
import { conversations } from '../db/schema/conversation';
import { departments } from '../db/schema/department';
import { messages } from '../db/schema/message';
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
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(turns * 2);

      const ordered = rows.reverse();
      const history: HistoryTurn[] = [];

      for (const row of ordered) {
        if (row.role === 'user') {
          history.push({ question: row.content, answerPreview: '' });
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
    conversationId: string;
    content: string;
    rewrittenQuery: string;
    isFollowup: boolean;
  }): Promise<void> => {
    await this.tenantDb.run(async (tx, tenantId) => {
      await tx.insert(messages).values({
        tenantId,
        conversationId: input.conversationId,
        role: 'user',
        content: input.content,
        rewrittenQuery: input.rewrittenQuery,
        isFollowup: input.isFollowup,
      });

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
  ): Promise<void> => {
    await this.tenantDb.run(async (tx) => {
      if (slug === null) {
        await tx
          .update(conversations)
          .set({ departmentHintId: null })
          .where(eq(conversations.id, conversationId));

        return;
      }

      const found = await tx
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.slug, slug), eq(departments.isActive, true)))
        .limit(1);

      const department = found[0];
      if (department === undefined) {
        throw new NotFoundException('Phòng ban không tồn tại');
      }

      await tx
        .update(conversations)
        .set({ departmentHintId: department.id })
        .where(eq(conversations.id, conversationId));
    });
  };

  readonly transcript = async (conversationId: string) =>
    this.tenantDb.run(async (tx) => {
      const found = await tx
        .select({
          id: conversations.id,
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

      return {
        id: conversation.id,
        departmentSlug: conversation.hintSlug,
        departmentName: conversation.hintName,
        messages: rows.map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          citedChunkIds: row.citedChunkIds ?? [],
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
}
