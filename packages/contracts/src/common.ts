import { z } from 'zod';

/** Ai được đọc tài liệu. Mặc định `internal`, chỉ mở ra `public` khi Owner chủ động đổi. */
export const audienceSchema = z.enum(['internal', 'public']);
export type Audience = z.infer<typeof audienceSchema>;

export const documentStatusSchema = z.enum(['draft', 'published', 'archived']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentSourceTypeSchema = z.enum(['upload', 'escalation']);
export type DocumentSourceType = z.infer<typeof documentSourceTypeSchema>;

/** Vai trò theo từng phòng ban. `admin` là cờ toàn hệ thống, không nằm ở đây. */
export const membershipRoleSchema = z.enum(['viewer', 'editor', 'owner']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

// `/all` là lệnh xóa bộ lọc phòng ban, nên một phòng ban tên `all` sẽ đụng lệnh.
export const RESERVED_DEPARTMENT_SLUGS = ['all'] as const;

const isReservedSlug = (slug: string): boolean =>
  (RESERVED_DEPARTMENT_SLUGS as readonly string[]).includes(slug);

export const departmentSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9-]+$/,
    'Chỉ cho phép chữ thường không dấu, chữ số và dấu gạch ngang',
  )
  .refine((slug) => !isReservedSlug(slug), {
    message: `Không được dùng từ khóa hệ thống: ${RESERVED_DEPARTMENT_SLUGS.join(', ')}`,
  });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof paginationSchema>;
