import { z } from 'zod';
import { audienceSchema } from './common.js';

export const ticketStatusSchema = z.enum([
  'open',
  'answered',
  'overdue',
  'closed',
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const escalationTicketSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  departmentId: z.uuid(),
  departmentName: z.string(),
  question: z.string(),
  status: ticketStatusSchema,
  dueAt: z.string(),
  answerText: z.string().nullable(),
  answeredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type EscalationTicket = z.infer<typeof escalationTicketSchema>;

export const answerTicketSchema = z.object({
  answer: z.string().min(1).max(8000),
});
export type AnswerTicketInput = z.infer<typeof answerTicketSchema>;

export const reassignTicketSchema = z.object({
  departmentId: z.uuid(),
});
export type ReassignTicketInput = z.infer<typeof reassignTicketSchema>;

export const candidateStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
]);
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;

/**
 * Đoạn tài liệu sẵn có gần giống ứng viên. Đặt cạnh nhau để Owner tự đối chiếu —
 * hệ thống cố ý KHÔNG dùng model để phán "có mâu thuẫn hay không", việc đó model
 * làm sai nhiều trên văn bản hành chính tiếng Việt và Owner mới có thẩm quyền.
 */
export const similarChunkSchema = z.object({
  chunkId: z.string(),
  documentId: z.uuid(),
  documentTitle: z.string(),
  similarity: z.number(),
  content: z.string(),
});
export type SimilarChunk = z.infer<typeof similarChunkSchema>;

export const knowledgeCandidateSchema = z.object({
  id: z.uuid(),
  ticketId: z.uuid(),
  departmentId: z.uuid(),
  departmentName: z.string(),
  question: z.string(),
  /** Nguyên văn người phụ trách viết, đã lọc thông tin cá nhân. */
  rawAnswer: z.string(),
  /** Bản model viết lại thành văn phong tài liệu. */
  normalizedAnswer: z.string().nullable(),
  suggestedTitle: z.string(),
  similarChunks: z.array(similarChunkSchema),
  audience: audienceSchema,
  status: candidateStatusSchema,
  createdAt: z.string(),
});
export type KnowledgeCandidate = z.infer<typeof knowledgeCandidateSchema>;

export const approveCandidateSchema = z.object({
  title: z.string().min(1).max(512),
  /** Owner sửa được trước khi duyệt — "sửa rồi duyệt" là một hành động, không phải hai. */
  content: z.string().min(1).max(20000),
  audience: audienceSchema,
  /** Chặn kiểu "tháng này đang giảm 10%" nhiễm kho tri thức vĩnh viễn. */
  effectiveTo: z.iso.date().nullable(),
});
export type ApproveCandidateInput = z.infer<typeof approveCandidateSchema>;
