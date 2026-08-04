import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantIdColumn } from './tenant';

/**
 * Hai ràng buộc `check` bên dưới cố ý trùng với kiểm tra ở tầng ứng dụng: `slug`
 * được dùng làm lệnh `/slug` trong chat, nên một bản ghi sai định dạng hoặc trùng
 * từ khóa `all` sẽ làm hỏng bộ lọc phòng ban. Chặn ở CSDL để không đường ghi nào
 * lách được.
 */
export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Slug chỉ duy nhất trong phạm vi một khách hàng — công ty nào cũng có quyền
    // đặt phòng `hr` của riêng mình.
    unique('departments_tenant_slug_key').on(table.tenantId, table.slug),
    check('departments_slug_format', sql`${table.slug} ~ '^[a-z0-9-]+$'`),
    check('departments_slug_not_reserved', sql`${table.slug} <> 'all'`),
  ],
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
