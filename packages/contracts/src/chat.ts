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
  /**
   * Hết stream mà không có marker nào: câu trả lời vẫn giữ, nhưng phải gắn nhãn
   * "chưa xác minh được nguồn" và một phiếu chuyển được tạo song song.
   */
  z.object({
    type: z.literal('unverified'),
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

/**
 * GET /api/v1/conversations — danh sách cho thanh bên.
 *
 * `title` là câu hỏi đầu tiên của hội thoại, không phải một cột riêng: bỏ hẳn
 * bước đặt tên nên không có gì để quên, và tiêu đề luôn khớp thứ đã hỏi.
 */
export const conversationSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  departmentSlug: departmentSlugSchema.nullable(),
  messageCount: z.number(),
  lastActivityAt: z.string(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

/**
 * PATCH /api/v1/conversations/{id} — bấm ✕ trên chip phòng ban.
 *
 * Phải là một lệnh riêng chứ không đợi tin nhắn kế tiếp: người dùng bấm tắt lọc
 * mà bộ lọc vẫn còn hiệu lực cho câu hỏi ngay sau đó thì họ tưởng bot hỏng.
 */
export const updateConversationSchema = z.object({
  departmentSlug: departmentSlugSchema.nullable(),
});
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

/** GET /api/v1/conversations/{id} — tải lại lịch sử khi refresh trang. */
export const conversationTranscriptSchema = z.object({
  id: z.uuid(),
  /** Bộ lọc phòng ban đang dính, giao diện phải hiện thành chip có nút tắt. */
  departmentSlug: departmentSlugSchema.nullable(),
  departmentName: z.string().nullable(),
  messages: z.array(
    z.object({
      id: z.uuid(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      citedChunkIds: z.array(z.string()),
      createdAt: z.string(),
    }),
  ),
});
export type ConversationTranscript = z.infer<
  typeof conversationTranscriptSchema
>;
