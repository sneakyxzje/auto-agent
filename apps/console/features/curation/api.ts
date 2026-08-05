import type {
  ApproveCandidateInput,
  KnowledgeCandidate,
} from '@chatbot/contracts';
import { apiRequest, postJson } from '@/lib/api-client';

export const listCandidates = (status: string): Promise<KnowledgeCandidate[]> =>
  apiRequest<KnowledgeCandidate[]>(`/v1/candidates?status=${status}`);

export const approveCandidate = (
  id: string,
  input: ApproveCandidateInput,
): Promise<{ ok: true }> =>
  postJson<{ ok: true }>(`/v1/candidates/${id}/approve`, input);

export const rejectCandidate = (id: string): Promise<{ ok: true }> =>
  postJson<{ ok: true }>(`/v1/candidates/${id}/reject`, {});
