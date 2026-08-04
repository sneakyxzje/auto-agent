import { type SseEvent, sseEventSchema } from '@chatbot/contracts';

/**
 * Đừng thay bằng `EventSource`: nó chỉ gửi được GET và không set được header
 * Authorization, mà POST /api/v1/chat cần cả hai. Nên phải tự đọc ReadableStream
 * của fetch.
 */

export class SseHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Máy chủ trả về HTTP ${status}`);
    this.name = 'SseHttpError';
  }
}

export type StreamSseOptions = {
  url: string;
  body: unknown;
  accessToken?: string;
  signal?: AbortSignal;
  onEvent: (event: SseEvent) => void;
};

const FRAME_SEPARATOR = '\n\n';
const DATA_FIELD_PREFIX = 'data:';

/** Gom các dòng `data:` của một frame thành payload. `null` nếu frame chỉ có heartbeat. */
const readFramePayload = (frame: string): string | null => {
  const payload = frame
    .split('\n')
    .filter((line) => line.startsWith(DATA_FIELD_PREFIX))
    .map((line) => line.slice(DATA_FIELD_PREFIX.length).trimStart())
    .join('\n');

  return payload.length > 0 ? payload : null;
};

const emitFrame = (frame: string, onEvent: (event: SseEvent) => void): void => {
  const payload = readFramePayload(frame);
  if (payload === null) return;

  const parsed = sseEventSchema.safeParse(JSON.parse(payload));
  if (!parsed.success) {
    throw new Error(`Sự kiện SSE không hợp lệ: ${parsed.error.message}`);
  }

  onEvent(parsed.data);
};

export const streamSse = async ({
  url,
  body,
  accessToken,
  signal,
  onEvent,
}: StreamSseOptions): Promise<void> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      ...(accessToken !== undefined ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new SseHttpError(response.status, await response.text());
  }

  if (response.body === null) {
    throw new Error('Phản hồi SSE không có body — kiểm tra `proxy_buffering off` ở nginx');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Chuẩn hóa CRLF để chỉ phải cắt frame theo một loại ký tự xuống dòng.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      const frames = buffer.split(FRAME_SEPARATOR);
      // Phần tử cuối là frame chưa nhận đủ, giữ lại cho vòng sau.
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        emitFrame(frame, onEvent);
      }
    }

    if (buffer.trim().length > 0) {
      emitFrame(buffer, onEvent);
    }
  } finally {
    reader.releaseLock();
  }
};
