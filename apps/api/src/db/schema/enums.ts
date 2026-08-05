import { pgEnum } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'suspended',
]);

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended']);

/**
 * Vai trò trong phạm vi một công ty. Thứ tự từ ít quyền tới nhiều quyền, và mỗi
 * mức bao trùm mức dưới:
 *
 *   user     hỏi đáp, xem tài liệu và phòng ban
 *   manager  + tải tài liệu, trả lời phiếu chuyển, duyệt tri thức vào kho
 *   admin    + tạo phòng ban, phát mã mời, đổi vai trò người khác
 */
export const userRoleEnum = pgEnum('user_role', ['user', 'manager', 'admin']);

export const audienceEnum = pgEnum('audience', ['internal', 'public']);

export const documentStatusEnum = pgEnum('document_status', [
  'draft',
  'published',
  'archived',
]);

export const documentSourceTypeEnum = pgEnum('document_source_type', [
  'upload',
  'escalation',
]);

/**
 * Trạng thái của pipeline ingest, tách khỏi `document_status`: một tài liệu có thể
 * đang `published` (bản cũ vẫn trả lời được) trong lúc bản mới đang `processing`.
 */
export const ingestStatusEnum = pgEnum('ingest_status', [
  'pending',
  'processing',
  'done',
  'failed',
]);

export const membershipRoleEnum = pgEnum('membership_role', [
  'viewer',
  'editor',
  'owner',
]);

export const conversationStatusEnum = pgEnum('conversation_status', [
  'active',
  'ended',
]);

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant']);

export const ratingEnum = pgEnum('rating', ['up', 'down']);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'answered',
  'overdue',
  'closed',
]);

export const candidateStatusEnum = pgEnum('candidate_status', [
  'pending',
  'approved',
  'rejected',
]);
