import { z } from 'zod';
import { departmentSlugSchema } from './common.js';

/** POST /api/v1/chat */
export const chatRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().min(1).max(4000),
  /** Id của ảnh đã upload trước đó. */
  imageIds: z.array(z.uuid()).max(3).optional(),
  /** Từ lệnh `/tenphongban`. Bỏ trống thì giữ bộ lọc cũ của hội thoại. */
  departmentSlug: departmentSlugSchema.optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Câu trả lời được stream dưới dạng text thuần kèm marker trích dẫn `[^c_xxxx]`,
 * không phải JSON. Các sự kiện dưới đây là kênh điều khiển bao quanh dòng text
 * đó. Bản v0, sẽ mở rộng khi làm phần hỏi–đáp.
 */
export const sseEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    conversationId: z.uuid(),
    messageId: z.uuid(),
  }),
  z.object({
    type: z.literal('delta'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('sources'),
    chunks: z.array(
      z.object({
        chunkId: z.string(),
        documentId: z.uuid(),
        documentTitle: z.string(),
        departmentSlug: departmentSlugSchema,
      }),
    ),
  }),
  /** Stream bị ngắt giữa chừng vì marker trích dẫn không hợp lệ. */
  z.object({
    type: z.literal('retracted'),
    reason: z.enum(['invalid_citation']),
  }),
  /** Bot không đủ căn cứ, đã chuyển câu hỏi cho người phụ trách. */
  z.object({
    type: z.literal('escalated'),
    ticketId: z.uuid(),
    departmentSlug: departmentSlugSchema,
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('done'),
  }),
]);
export type SseEvent = z.infer<typeof sseEventSchema>;
