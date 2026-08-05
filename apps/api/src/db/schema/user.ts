import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { departments } from './department';
import { membershipRoleEnum, userRoleEnum, userStatusEnum } from './enums';
import { tenantIdColumn, tenants } from './tenant';

/**
 * Email duy nhất trên toàn hệ thống chứ không phải trong từng khách hàng: đăng
 * nhập chỉ có email + mật khẩu, nên phải tra ra được đúng một tài khoản mà không
 * cần hỏi người dùng họ thuộc công ty nào.
 *
 * `tenantId` để rỗng được, vì đăng ký xong là đã có tài khoản nhưng chưa chọn tạo
 * công ty hay vào công ty bằng mã mời. Trong lúc rỗng, mọi policy RLS đều không
 * khớp nên họ không thấy dữ liệu của bất kỳ công ty nào — không cần luật riêng.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'restrict',
    }),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    isExternal: boolean('is_external').notNull().default(true),
    /** Vai trò trong công ty này, không phải quyền trên cả dịch vụ. */
    role: userRoleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('users_email_key').on(table.email),
    index('users_tenant_idx').on(table.tenantId),
  ],
);

/** Vai trò gắn theo từng phòng ban, không phải toàn công ty. */
export const departmentMemberships = pgTable(
  'department_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('department_memberships_user_department_key').on(
      table.userId,
      table.departmentId,
    ),
    // Cho truy vấn "phòng X có những Owner nào" khi gán phiếu escalation.
    index('department_memberships_department_role_idx').on(
      table.tenantId,
      table.departmentId,
      table.role,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DepartmentMembership = typeof departmentMemberships.$inferSelect;
