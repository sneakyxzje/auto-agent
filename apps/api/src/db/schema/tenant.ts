import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenantStatusEnum } from './enums';

/** Một khách hàng của dịch vụ — thường là một công ty. */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  /** Dành sẵn cho subdomain kiểu `congty-a.chatbot.com`. */
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  status: tenantStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cột `tenant_id` dùng chung cho mọi bảng. Dùng `restrict` chứ không `cascade`:
 * xóa nhầm một khách hàng mà kéo theo toàn bộ dữ liệu của họ thì không cứu được.
 * Ngừng phục vụ một khách là một quy trình riêng, không phải một câu DELETE.
 */
export const tenantIdColumn = () =>
  uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' });

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
