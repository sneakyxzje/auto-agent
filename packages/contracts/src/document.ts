import { z } from 'zod';
import { audienceSchema, documentStatusSchema } from './common.js';

/** Khớp `MAX_UPLOAD_BYTES` trong bootstrap của API và giới hạn 50MB ở FR-2. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

/**
 * Chỉ nhận tài liệu dạng text. PDF scan nằm ngoài phạm vi, và trình duyệt hay gửi
 * `application/octet-stream` cho `.md`, nên phần đuôi file mới là căn cứ chính.
 */
export const DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const;

/** Trạng thái pipeline ingest, tách khỏi `status` của chính tài liệu. */
export const ingestStatusSchema = z.enum([
  'pending',
  'processing',
  'done',
  'failed',
]);
export type IngestStatus = z.infer<typeof ingestStatusSchema>;

export const documentSchema = z.object({
  id: z.uuid(),
  departmentId: z.uuid(),
  departmentName: z.string(),
  title: z.string(),
  audience: audienceSchema,
  status: documentStatusSchema,
  ingestStatus: ingestStatusSchema,
  ingestError: z.string().nullable(),
  chunkCount: z.number(),
  version: z.number(),
  fileName: z.string().nullable(),
  fileSize: z.number().nullable(),
  effectiveTo: z.string().nullable(),
  uploadedBy: z.string().nullable(),
  createdAt: z.string(),
});
export type Document = z.infer<typeof documentSchema>;

/**
 * Phần metadata đi kèm file trong multipart. Mọi trường tới nơi đều là chuỗi nên
 * `audience` và `effectiveTo` phải chịu được chuỗi rỗng khi người dùng bỏ trống.
 */
export const uploadDocumentSchema = z.object({
  departmentId: z.uuid(),
  title: z.string().min(1).max(512),
  audience: audienceSchema.default('internal'),
  effectiveTo: z
    .string()
    .transform((value) => (value.trim().length === 0 ? null : value))
    .pipe(z.iso.date().nullable())
    .nullish()
    .default(null),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

/**
 * Đổi `audience`, `status` hay `effectiveTo` bắt buộc kéo theo cập nhật `chunks` —
 * xem chú thích ở schema chunk. Đây là đường rò tài liệu nội bộ dễ quên nhất.
 */
export const updateDocumentSchema = z
  .object({
    audience: audienceSchema,
    status: documentStatusSchema,
    effectiveTo: z.iso.date().nullable(),
  })
  .partial();
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
