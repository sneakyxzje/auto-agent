import type {
  ApproveCandidateInput,
  KnowledgeCandidate,
} from '@chatbot/contracts';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DEFAULT_CURATION_PROMPT } from '../chat/chat-defaults';
import { ChatSettingsService } from '../chat/chat-settings.service';
import { departments } from '../db/schema/department';
import {
  escalationTickets,
  knowledgeCandidates,
} from '../db/schema/escalation';
import type { SimilarChunkRef } from '../db/schema/types';
import { TenantDb } from '../db/tenant-db.service';
import { PublishService } from '../knowledge/publish/publish.service';
import { EmbeddingService } from '../llm/embedding.service';
import { LlmService } from '../llm/llm.service';
import { redactPii } from './pii';

/**
 * Chỉ lấy đoạn thật sự gần nghĩa. Ngưỡng thấp hơn thì màn hình duyệt đầy đoạn
 * chẳng liên quan, Owner sẽ quen mắt bỏ qua — mà đọc đối chiếu mới là mục đích.
 */
const SIMILARITY_THRESHOLD = 0.85;
const SIMILAR_LIMIT = 3;

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    normalized_answer: { type: 'string' },
  },
  required: ['title', 'normalized_answer'],
  additionalProperties: false,
};

type SimilarRow = {
  id: string;
  document_id: string;
  document_title: string;
  content: string;
  similarity: string;
};

@Injectable()
export class CurationService {
  private readonly logger = new Logger(CurationService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly settings: ChatSettingsService,
    private readonly llm: LlmService,
    private readonly embedding: EmbeddingService,
    private readonly publish: PublishService,
  ) {}

  /**
   * Câu trả lời của người phụ trách KHÔNG đi thẳng vào kho. Nó thành "ứng viên"
   * và phải qua Owner duyệt.
   *
   * Bốn kiểu hỏng mà chuỗi bước dưới đây chặn: ngoại lệ bị nâng thành quy tắc,
   * thông tin có thời hạn nhiễm kho vĩnh viễn, mâu thuẫn với tài liệu sẵn có, và
   * lộ thông tin cá nhân. Bỏ bước nào là mở lại đúng kiểu hỏng đó.
   */
  readonly createFromAnswer = async (input: {
    ticketId: string;
    question: string;
    rawAnswer: string;
  }): Promise<void> => {
    const config = await this.settings.load();

    // 1. Lọc thông tin cá nhân bằng regex trước khi đưa cho model.
    const redacted = redactPii(input.rawAnswer);

    if (redacted.redactedCount > 0) {
      this.logger.log(
        `Đã ẩn ${redacted.redactedCount} thông tin cá nhân trong câu trả lời phiếu ${input.ticketId}`,
      );
    }

    // 2. Viết lại thành văn phong tài liệu, bỏ ngữ cảnh cá nhân còn sót.
    const { value } = await this.llm.structured({
      model: config.modelSmall,
      system: DEFAULT_CURATION_PROMPT,
      user: `CÂU HỎI\n${input.question}\n\nCÂU TRẢ LỜI CỦA NGƯỜI PHỤ TRÁCH\n${redacted.text}`,
      schemaName: 'knowledge_candidate',
      jsonSchema: SCHEMA,
      parse: (raw) => {
        const parsed = raw as { title?: unknown; normalized_answer?: unknown };

        return {
          title:
            typeof parsed.title === 'string' ? parsed.title : input.question,
          content:
            typeof parsed.normalized_answer === 'string'
              ? parsed.normalized_answer
              : redacted.text,
        };
      },
      maxOutputTokens: 1200,
    });

    // 3. Tìm đoạn tài liệu gần giống để Owner đối chiếu.
    const similar = await this.findSimilar(value.content);

    await this.tenantDb.run(async (tx, tenantId) => {
      await tx.insert(knowledgeCandidates).values({
        tenantId,
        ticketId: input.ticketId,
        question: input.question,
        rawAnswer: redacted.text,
        normalizedAnswer: value.content,
        suggestedTitle: value.title,
        similarChunks: similar,
        audience: 'internal',
      });
    });
  };

  readonly list = async (
    status: 'pending' | 'approved' | 'rejected',
  ): Promise<KnowledgeCandidate[]> =>
    this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: knowledgeCandidates.id,
          ticketId: knowledgeCandidates.ticketId,
          departmentId: escalationTickets.departmentId,
          departmentName: departments.name,
          question: knowledgeCandidates.question,
          rawAnswer: knowledgeCandidates.rawAnswer,
          normalizedAnswer: knowledgeCandidates.normalizedAnswer,
          suggestedTitle: knowledgeCandidates.suggestedTitle,
          similarChunks: knowledgeCandidates.similarChunks,
          audience: knowledgeCandidates.audience,
          status: knowledgeCandidates.status,
          createdAt: knowledgeCandidates.createdAt,
        })
        .from(knowledgeCandidates)
        .innerJoin(
          escalationTickets,
          eq(escalationTickets.id, knowledgeCandidates.ticketId),
        )
        .innerJoin(
          departments,
          eq(departments.id, escalationTickets.departmentId),
        )
        .where(eq(knowledgeCandidates.status, status))
        .orderBy(desc(knowledgeCandidates.createdAt));

      return rows.map((row) => ({
        ...row,
        suggestedTitle: row.suggestedTitle ?? row.question,
        similarChunks: row.similarChunks ?? [],
        createdAt: row.createdAt.toISOString(),
      }));
    });

  /**
   * Duyệt là đường DUY NHẤT tri thức mới vào kho, và nó đi qua `PublishService`
   * y hệt tài liệu tải lên tay — cùng cách tăng phiên bản, cùng cách chia đoạn.
   */
  readonly approve = async (
    candidateId: string,
    input: ApproveCandidateInput,
    reviewerId: string,
  ): Promise<void> => {
    const candidate = await this.tenantDb.run(async (tx, tenantId) => {
      const rows = await tx
        .select({
          id: knowledgeCandidates.id,
          status: knowledgeCandidates.status,
          ticketId: knowledgeCandidates.ticketId,
          departmentId: escalationTickets.departmentId,
        })
        .from(knowledgeCandidates)
        .innerJoin(
          escalationTickets,
          eq(escalationTickets.id, knowledgeCandidates.ticketId),
        )
        .where(eq(knowledgeCandidates.id, candidateId))
        .limit(1);

      const found = rows[0];
      if (found === undefined) {
        throw new NotFoundException('Không tìm thấy ứng viên tri thức');
      }

      return { ...found, tenantId };
    });

    await this.publish.publishText({
      tenantId: candidate.tenantId,
      departmentId: candidate.departmentId,
      title: input.title,
      content: input.content,
      audience: input.audience,
      effectiveTo:
        input.effectiveTo === null ? null : new Date(input.effectiveTo),
      sourceType: 'escalation',
      createdBy: reviewerId,
    });

    await this.tenantDb.run(async (tx) => {
      await tx
        .update(knowledgeCandidates)
        .set({
          status: 'approved',
          reviewerId,
          audience: input.audience,
          normalizedAnswer: input.content,
          suggestedTitle: input.title,
          ttlUntil:
            input.effectiveTo === null ? null : new Date(input.effectiveTo),
          updatedAt: new Date(),
        })
        .where(eq(knowledgeCandidates.id, candidateId));

      await tx
        .update(escalationTickets)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(escalationTickets.id, candidate.ticketId));
    });
  };

  readonly reject = async (
    candidateId: string,
    reviewerId: string,
  ): Promise<void> => {
    await this.tenantDb.run(async (tx) => {
      const updated = await tx
        .update(knowledgeCandidates)
        .set({ status: 'rejected', reviewerId, updatedAt: new Date() })
        .where(
          and(
            eq(knowledgeCandidates.id, candidateId),
            eq(knowledgeCandidates.status, 'pending'),
          ),
        )
        .returning({ id: knowledgeCandidates.id });

      if (updated[0] === undefined) {
        throw new NotFoundException('Không tìm thấy ứng viên đang chờ duyệt');
      }
    });
  };

  private readonly findSimilar = async (
    content: string,
  ): Promise<SimilarChunkRef[]> => {
    const vector = await this.embedding.embedOne(content);
    const literal = `[${vector.join(',')}]`;

    return this.tenantDb.run(async (tx) => {
      const result = await tx.execute<SimilarRow>(sql`
        SELECT c.id,
               c.document_id,
               c.content,
               d.title AS document_title,
               1 - (c.embedding <=> ${literal}::vector) AS similarity
          FROM chunks c
          JOIN documents d ON d.id = c.document_id
         WHERE c.doc_status = 'published'
           AND 1 - (c.embedding <=> ${literal}::vector) > ${SIMILARITY_THRESHOLD}
         ORDER BY c.embedding <=> ${literal}::vector
         LIMIT ${SIMILAR_LIMIT}
      `);

      return result.rows.map((row) => ({
        chunkId: row.id,
        documentId: row.document_id,
        documentTitle: row.document_title,
        similarity: Number(row.similarity),
        content: row.content,
      }));
    });
  };
}
