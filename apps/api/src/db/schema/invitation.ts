import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant';
import { users } from './user';

/**
 * Mã mời để người đã có tài khoản gia nhập một công ty có sẵn.
 *
 * `code` duy nhất trên toàn hệ thống chứ không phải trong từng công ty: lúc người
 * dùng nhập mã, hệ thống chưa biết họ định vào đâu, phải tra ngược từ mã ra công ty.
 *
 * Vào được công ty nghĩa là đọc được tài liệu `internal`, nên mã luôn có hạn dùng
 * và số lượt dùng. Mặc định 1 lượt trong 7 ngày; admin muốn onboard cả phòng thì
 * tạo mã nhiều lượt.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    code: varchar('code', { length: 32 }).notNull().unique(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Admin thu hồi mã trước hạn. Khác với hết lượt hoặc hết hạn. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Cho phép mời thẳng một người làm admin, thay vì mời vào rồi nâng quyền sau. */
    grantsTenantAdmin: boolean('grants_tenant_admin').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('invitations_tenant_idx').on(table.tenantId, table.createdAt),
  ],
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
