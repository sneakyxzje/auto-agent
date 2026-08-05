import type {
  CreateInvitationInput,
  Invitation,
  Member,
  UpdateMemberRoleInput,
} from '@chatbot/contracts';
import { apiRequest, patchJson, postJson } from '@/lib/api-client';

export const listMembers = (): Promise<Member[]> =>
  apiRequest<Member[]>('/v1/members');

export const setMemberRole = (
  id: string,
  input: UpdateMemberRoleInput,
): Promise<Member> => patchJson<Member>(`/v1/members/${id}/role`, input);

export const createInvitation = (
  input: CreateInvitationInput,
): Promise<Invitation> => postJson<Invitation>('/v1/invitations', input);
