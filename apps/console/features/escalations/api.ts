import type {
  AnswerTicketInput,
  EscalationTicket,
  ReassignTicketInput,
} from '@chatbot/contracts';
import { apiRequest, postJson } from '@/lib/api-client';

export const listTickets = (status: string): Promise<EscalationTicket[]> =>
  apiRequest<EscalationTicket[]>(
    status === '' ? '/v1/escalations' : `/v1/escalations?status=${status}`,
  );

export const answerTicket = (
  id: string,
  input: AnswerTicketInput,
): Promise<{ ok: true }> =>
  postJson<{ ok: true }>(`/v1/escalations/${id}/answer`, input);

export const reassignTicket = (
  id: string,
  input: ReassignTicketInput,
): Promise<{ ok: true }> =>
  postJson<{ ok: true }>(`/v1/escalations/${id}/reassign`, input);
