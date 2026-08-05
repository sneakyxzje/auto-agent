import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { conversations } from './conversation';
import { messageRoleEnum, ratingEnum } from './enums';
import { tenantIdColumn } from './tenant';
import type {
  CostBreakdown,
  LatencyBreakdown,
  RetrievedChunkRef,
} from './types';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),

    /**
     * Câu hỏi đã viết lại thành dạng độc lập. Luôn ghi, kể cả khi không phải câu
     * hỏi nối tiếp (lúc đó bằng nguyên văn câu gốc) — đây là trường đầu tiên phải
     * nhìn khi debug "sao bot tìm sai".
     */
    rewrittenQuery: text('rewritten_query'),
    isFollowup: boolean('is_followup'),

    retrievedChunks: jsonb('retrieved_chunks').$type<RetrievedChunkRef[]>(),
    citedChunkIds: jsonb('cited_chunk_ids').$type<string[]>(),

    tokensInput: integer('tokens_input'),
    tokensOutput: integer('tokens_output'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    latencyBreakdown: jsonb('latency_breakdown').$type<LatencyBreakdown>(),
    costBreakdown: jsonb('cost_breakdown').$type<CostBreakdown>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('messages_conversation_created_idx').on(
      table.conversationId,
      table.createdAt,
    ),
    // Cộng dồn chi phí LLM theo từng khách hàng, sau này còn để xuất hóa đơn.
    index('messages_tenant_created_idx').on(table.tenantId, table.createdAt),
  ],
);

/**
 * Chấm điểm gắn vào từng câu trả lời chứ không phải cả hội thoại: hội thoại 5 lượt
 * mà chỉ 1 lượt sai thì rating mức hội thoại không chỉ ra được lượt nào để đưa vào
 * golden set.
 */
export const messageRatings = pgTable(
  'message_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    rating: ratingEnum('rating').notNull(),
    comment: text('comment'),
    ratedBy: varchar('rated_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('message_ratings_message_rater_key').on(
      table.messageId,
      table.ratedBy,
    ),
  ],
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageRating = typeof messageRatings.$inferSelect;
