import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant';

/**
 * Ngưỡng, tên model và prompt của luồng hỏi–đáp. Brief cấm hardcode mấy thứ này:
 * chỉnh độ chặt của bot là việc phải làm được lúc chạy, không phải mỗi lần lại
 * deploy.
 *
 * Không có dòng nào cho một khách hàng thì dùng mặc định trong `chat-defaults.ts`,
 * nên bảng này chỉ chứa phần khách đó cố ý đổi khác.
 */
export const chatSettings = pgTable(
  'chat_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),

    /** Số đoạn lấy về từ RRF ở bước [1]. */
    retrievalTopK: integer('retrieval_top_k'),
    /** Số đoạn thực sự đưa vào bước [2] — ngân sách độ trễ nằm ở đây. */
    gateTopK: integer('gate_top_k'),
    /** Cắt mỗi đoạn còn bấy nhiêu ký tự trước khi đưa vào bước [2]. */
    gateChunkChars: integer('gate_chunk_chars'),
    /**
     * Ngưỡng RRF tối thiểu để một đoạn được vào bước [2]. Chỉ để lọc rác, đặt
     * thấp — quyết định trả lời hay không là `enough_to_answer`, không phải số này.
     */
    minRetrievalScore: numeric('min_retrieval_score', {
      precision: 8,
      scale: 6,
    }),
    /** Số lượt hội thoại gần nhất đưa vào bước viết lại và bước sinh câu trả lời. */
    contextTurns: integer('context_turns'),
    escalationSlaHours: integer('escalation_sla_hours'),
    rateLimitEmployeePerHour: integer('rate_limit_employee_per_hour'),
    rateLimitExternalPerHour: integer('rate_limit_external_per_hour'),

    modelBig: varchar('model_big', { length: 128 }),
    modelSmall: varchar('model_small', { length: 128 }),

    promptRewrite: text('prompt_rewrite'),
    promptGate: text('prompt_gate'),
    promptAnswer: text('prompt_answer'),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('chat_settings_tenant_key').on(table.tenantId)],
);

export type ChatSettingsRow = typeof chatSettings.$inferSelect;
