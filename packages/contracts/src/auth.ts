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
  isTenantAdmin: z.boolean(),
  tenant: z
    .object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
    })
    .nullable(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
