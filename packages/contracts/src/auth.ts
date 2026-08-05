import { z } from 'zod';

/**
 * Đăng ký chỉ tạo tài khoản, chưa gắn với công ty nào. Sau khi đăng nhập, người
 * dùng mới chọn tạo công ty mới hay vào công ty có sẵn bằng mã mời.
 */
export const registerSchema = z.object({
  displayName: z.string().min(1).max(255),
  email: z.email().max(320),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Bước 2a: tự tạo công ty. Người tạo trở thành admin của công ty đó. */
export const createTenantSchema = z.object({
  companyName: z.string().min(2).max(255),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/** Bước 2b: vào công ty có sẵn bằng mã mời do admin công ty đó phát. */
export const joinTenantSchema = z.object({
  inviteCode: z.string().min(6).max(32),
});
export type JoinTenantInput = z.infer<typeof joinTenantSchema>;

/**
 * Vai trò trong một công ty. Mỗi mức bao trùm mức dưới:
 *
 *   user     hỏi đáp, xem tài liệu và phòng ban
 *   manager  + tải tài liệu, trả lời phiếu chuyển, duyệt tri thức vào kho
 *   admin    + tạo phòng ban, phát mã mời, đổi vai trò người khác
 */
export const userRoleSchema = z.enum(['user', 'manager', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

const RANK: Record<UserRole, number> = { user: 0, manager: 1, admin: 2 };

/** Dùng chung cho cả guard ở server lẫn phần ẩn/hiện ở giao diện. */
export const hasRole = (actual: UserRole, required: UserRole): boolean =>
  RANK[actual] >= RANK[required];

export const createInvitationSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(200).default(1),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(7),
  grantsRole: userRoleSchema.default('user'),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  maxUses: z.number(),
  usedCount: z.number(),
  expiresAt: z.string(),
  grantsRole: userRoleSchema,
});
export type Invitation = z.infer<typeof invitationSchema>;

export const memberSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  role: userRoleSchema,
  status: z.enum(['active', 'suspended']),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Member = z.infer<typeof memberSchema>;

export const updateMemberRoleSchema = z.object({
  role: userRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Thông tin trả về cho `GET /auth/me`. Không bao giờ có mật khẩu ở đây.
 *
 * `tenant` là `null` khi vừa đăng ký xong mà chưa tạo hay tham gia công ty nào —
 * đây là tín hiệu để giao diện hiện màn hình "tạo công ty hay nhập mã mời".
 */
export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  isExternal: z.boolean(),
  role: userRoleSchema,
  tenant: z
    .object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
