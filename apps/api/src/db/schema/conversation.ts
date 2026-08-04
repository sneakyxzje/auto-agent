import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { departments } from './department';
import { conversationStatusEnum } from './enums';
import { tenantIdColumn } from './tenant';
import { users } from './user';

/**
 * `departmentHintId` là bộ lọc phòng ban dính cả hội thoại — người dùng gõ
 * `/account` một lần rồi hỏi tiếp không cần gõ lại. Lưu khóa ngoại thay vì slug
 * để đổi tên slug không làm hỏng ngữ cảnh hội thoại đang mở.
 *
 * Chỉ `/slug` (đổi) và `/all` (xóa) được ghi vào trường này. Khi hệ thống tự nới
 * lọc lúc không tìm đủ đoạn thì đừng đụng vào — nới chỉ có hiệu lực cho đúng lượt
 * đó, không thì một lần nới là mất ngữ cảnh cả hội thoại.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    departmentHintId: uuid('department_hint_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    status: conversationStatusEnum('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Quá 30 phút im lặng thì tính là hội thoại mới, hint reset về rỗng. */
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('conversations_user_activity_idx').on(table.tenantId, table.userId, table.lastActivityAt),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
