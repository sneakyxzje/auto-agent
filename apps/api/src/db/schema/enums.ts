import { pgEnum } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended']);

export const audienceEnum = pgEnum('audience', ['internal', 'public']);

export const documentStatusEnum = pgEnum('document_status', ['draft', 'published', 'archived']);

export const documentSourceTypeEnum = pgEnum('document_source_type', ['upload', 'escalation']);

export const membershipRoleEnum = pgEnum('membership_role', ['viewer', 'editor', 'owner']);

export const conversationStatusEnum = pgEnum('conversation_status', ['active', 'ended']);

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant']);

export const ratingEnum = pgEnum('rating', ['up', 'down']);

export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'answered', 'overdue', 'closed']);

export const candidateStatusEnum = pgEnum('candidate_status', ['pending', 'approved', 'rejected']);
