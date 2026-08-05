import type {
  ChatRequest,
  ConversationSummary,
  ConversationTranscript,
  SseEvent,
} from '@chatbot/contracts';
import {
  API_BASE_URL,
  ApiError,
  apiRequest,
  patchJson,
  refreshSession,
} from '@/lib/api-client';

export const listConversations = (): Promise<ConversationSummary[]> =>
  apiRequest<ConversationSummary[]>('/v1/conversations');

export const getTranscript = (id: string): Promise<ConversationTranscript> =>
  apiRequest<ConversationTranscript>(`/v1/conversations/${id}`);

export const setConversationDepartment = (
  id: string,
  departmentSlug: string | null,
): Promise<ConversationTranscript> =>
  patchJson<ConversationTranscript>(`/v1/conversations/${id}`, {
    departmentSlug,
  });

const postChat = (body: ChatRequest, signal: AbortSignal): Promise<Response> =>
  fetch(`${API_BASE_URL}/v1/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

/**
 * Chat không dùng chung `apiRequest` được: hàm đó đọc hết body rồi mới trả về, còn
 * ở đây phải xử lý từng mẩu ngay khi tới. Phần làm mới phiên khi 401 thì vẫn dùng
 * lại của api-client để hai đường không lệch nhau.
 */
export const streamChat = async (
  body: ChatRequest,
  onEvent: (event: SseEvent) => void,
  signal: AbortSignal,
): Promise<void> => {
  let response = await postChat(body, signal);

  if (response.status === 401 && (await refreshSession())) {
    response = await postChat(body, signal);
  }

  if (!response.ok || response.body === null) {
    const text = await response.text();
    throw new ApiError(response.status, text || 'Không gửi được câu hỏi');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Một sự kiện SSE kết thúc bằng dòng trống; mẩu cuối cùng có thể còn dở.
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const line = block
        .split('\n')
        .find((candidate) => candidate.startsWith('data: '));

      if (line === undefined) continue;

      onEvent(JSON.parse(line.slice(6)) as SseEvent);
    }
  }
};
