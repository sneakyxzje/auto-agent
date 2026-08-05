import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { conversations } from './conversation';
import { departments } from './department';
import { audienceEnum, candidateStatusEnum, ticketStatusEnum } from './enums';
import { tenantIdColumn } from './tenant';
import type { SimilarChunkRef } from './types';
import { users } from './user';

/** Phiếu chuyển câu hỏi bot không trả lời được sang người phụ trách. */
export const escalationTickets = pgTable(
  'escalation_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    question: text('question').notNull(),
    assigneeId: uuid('assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: ticketStatusEnum('status').notNull().default('open'),
    /** Hạn SLA. Chuyển phiếu sang phòng khác thì tính lại từ đầu. */
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    answerText: text('answer_text'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Màn hình người phụ trách: phiếu đang mở của phòng mình.
    index('escalation_tickets_department_status_idx').on(
      table.tenantId,
      table.departmentId,
      table.status,
    ),
    // Job quét SLA chạy cho mọi khách hàng nên cố ý không có tenant_id đứng đầu.
    index('escalation_tickets_status_due_idx').on(table.status, table.dueAt),
  ],
);

/**
 * Ứng viên tri thức sinh từ câu trả lời của người phụ trách.
 *
 * Không được ghi thẳng vào `documents`. Đường duy nhất để một ứng viên thành tri
 * thức là đi qua API publish chung, nơi xử lý tăng phiên bản và ghi sourceType.
 */
export const knowledgeCandidates = pgTable(
  'knowledge_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => escalationTickets.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    /** Nguyên văn câu trả lời, đã lọc thông tin cá nhân. */
    rawAnswer: text('raw_answer').notNull(),
    /** Bản model viết lại thành văn phong tài liệu, bỏ ngữ cảnh cá nhân. */
    normalizedAnswer: text('normalized_answer'),
    /** Tiêu đề model đề xuất, Owner sửa được trước khi duyệt. */
    suggestedTitle: varchar('suggested_title', { length: 512 }),
    /** Đoạn tài liệu tương tự, đặt cạnh bên để Owner đối chiếu trước khi duyệt. */
    similarChunks: jsonb('similar_chunks').$type<SimilarChunkRef[]>(),
    /** Mặc định internal cho tới khi Owner chủ động mở ra public. */
    audience: audienceEnum('audience').notNull().default('internal'),
    reviewerId: uuid('reviewer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: candidateStatusEnum('status').notNull().default('pending'),
    /** Hạn hiệu lực, chặn kiểu "tháng này đang giảm 10%" nhiễm kho vĩnh viễn. */
    ttlUntil: timestamp('ttl_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Cho cảnh báo hàng đợi duyệt bị dồn ứ.
    index('knowledge_candidates_status_created_idx').on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);

export type EscalationTicket = typeof escalationTickets.$inferSelect;
export type KnowledgeCandidate = typeof knowledgeCandidates.$inferSelect;
