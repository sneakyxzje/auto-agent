'use client';

import type { SseEvent } from '@chatbot/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTranscript, setConversationDepartment, streamChat } from './api';

export type SourceRef = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  departmentSlug: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceRef[];
  streaming: boolean;
  /** Marker trích dẫn sai, phần đã hiện bị thu hồi. */
  retracted: boolean;
  /** Trả lời xong mà không có trích dẫn nào. */
  unverified: boolean;
  escalatedTo: string | null;
  error: string | null;
};

export type DepartmentFilter = {
  slug: string;
  name: string;
} | null;

const COMMAND_PATTERN = /^\/([a-z0-9-]+)\s*/;

/**
 * Model trả về từng mẩu to nhỏ thất thường, đổ thẳng ra màn hình sẽ thành giật cục.
 * Đệm lại rồi nhả đều mỗi 20ms cho ra nhịp gõ chữ như Claude hay Gemini.
 *
 * Bước nhả tỉ lệ với độ dài hàng đợi để không bao giờ tụt lại phía sau model, và
 * có trần để đoạn dài không bị "xổ" ra một lúc.
 */
const TICK_MS = 20;
const MAX_STEP = 12;

const blankAssistant = (id: string): ChatMessage => ({
  id,
  role: 'assistant',
  content: '',
  sources: [],
  streaming: true,
  retracted: false,
  unverified: false,
  escalatedTo: null,
  error: null,
});

export const useChat = ({
  onTurnEnd,
}: {
  onTurnEnd: (conversationId: string | null) => void;
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DepartmentFilter>(null);
  const [busy, setBusy] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef('');
  const targetRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  const tickerRef = useRef<number | null>(null);
  const conversationRef = useRef<string | null>(null);
  const turnEndRef = useRef(onTurnEnd);

  turnEndRef.current = onTurnEnd;

  const patchAssistant = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      );
    },
    [],
  );

  const stopTicker = useCallback(() => {
    if (tickerRef.current === null) return;

    clearInterval(tickerRef.current);
    tickerRef.current = null;
  }, []);

  const startTicker = useCallback(() => {
    if (tickerRef.current !== null) return;

    tickerRef.current = window.setInterval(() => {
      const id = targetRef.current;
      if (id === null) return;

      const queue = queueRef.current;

      if (queue.length === 0) {
        if (!finishedRef.current) return;

        stopTicker();
        patchAssistant(id, { streaming: false });
        setBusy(false);
        turnEndRef.current(conversationRef.current);
        return;
      }

      const step = Math.min(
        MAX_STEP,
        Math.max(1, Math.ceil(queue.length / 10)),
      );

      queueRef.current = queue.slice(step);
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? { ...message, content: message.content + queue.slice(0, step) }
            : message,
        ),
      );
    }, TICK_MS);
  }, [patchAssistant, stopTicker]);

  useEffect(() => stopTicker, [stopTicker]);

  const send = useCallback(
    async (raw: string, departmentSlug: string | null) => {
      const text = raw.trim();
      if (text.length === 0 || busy) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      queueRef.current = '';
      finishedRef.current = false;

      /**
       * Id của tin nhắn giữ nguyên suốt lượt, không đổi theo `messageId` server
       * gửi về. Đổi id giữa chừng là mở ra một khoảng mà bộ gõ chữ trỏ vào một id
       * còn state trỏ vào id kia — chữ bị nuốt mất mà không báo lỗi gì.
       */
      const askedAt = Date.now();
      const assistantId = `turn-${askedAt}`;
      targetRef.current = assistantId;

      setMessages((current) => [
        ...current,
        {
          ...blankAssistant(`local-${askedAt}`),
          role: 'user',
          content: text,
          streaming: false,
        },
        blankAssistant(assistantId),
      ]);

      startTicker();

      const handle = (event: SseEvent): void => {
        if (event.type === 'start') {
          conversationRef.current = event.conversationId;
          setConversationId(event.conversationId);
          return;
        }

        if (event.type === 'delta') {
          queueRef.current += event.text;
          return;
        }

        if (event.type === 'sources') {
          patchAssistant(assistantId, { sources: event.chunks });
          return;
        }

        if (event.type === 'retracted') {
          // Thu hồi đúng nghĩa: xoá cả phần đã hiện lẫn phần còn nằm trong đệm.
          queueRef.current = '';
          patchAssistant(assistantId, { content: '', retracted: true });
          return;
        }

        if (event.type === 'unverified') {
          patchAssistant(assistantId, { unverified: true });
          return;
        }

        if (event.type === 'escalated') {
          patchAssistant(assistantId, { escalatedTo: event.departmentSlug });
          return;
        }

        if (event.type === 'error') {
          patchAssistant(assistantId, { error: event.message });
        }
      };

      try {
        await streamChat(
          {
            ...(conversationRef.current === null
              ? {}
              : { conversationId: conversationRef.current }),
            message: text,
            ...(departmentSlug === null ? {} : { departmentSlug }),
          },
          handle,
          controller.signal,
        );
      } catch {
        queueRef.current = '';
        patchAssistant(assistantId, { error: 'Mất kết nối tới máy chủ' });
      } finally {
        // Ticker mới là chỗ tắt cờ bận: nó còn phải gõ nốt phần đang đệm.
        finishedRef.current = true;
        abortRef.current = null;
      }

      const command = COMMAND_PATTERN.exec(text);
      const commandSlug = command?.[1] ?? null;

      if (commandSlug === 'all') setFilter(null);
      else if (commandSlug !== null) {
        setFilter({ slug: commandSlug, name: commandSlug });
      } else if (departmentSlug !== null) {
        setFilter({ slug: departmentSlug, name: departmentSlug });
      }
    },
    [busy, patchAssistant, startTicker],
  );

  /** Mở lại một hội thoại cũ từ thanh bên và hỏi tiếp ngay trong đó. */
  const load = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      stopTicker();
      queueRef.current = '';
      targetRef.current = null;
      setBusy(false);

      try {
        const transcript = await getTranscript(id);

        conversationRef.current = transcript.id;
        setConversationId(transcript.id);
        setMessages(
          transcript.messages.map((message) => ({
            ...blankAssistant(message.id),
            role: message.role,
            content: message.content,
            streaming: false,
          })),
        );
        setFilter(
          transcript.departmentSlug === null
            ? null
            : {
                slug: transcript.departmentSlug,
                name: transcript.departmentName ?? transcript.departmentSlug,
              },
        );
      } catch {
        setMessages([]);
        conversationRef.current = null;
        setConversationId(null);
      }
    },
    [stopTicker],
  );

  /** Bấm ✕ trên chip: bỏ lọc ngay lập tức, không đợi lượt hỏi kế tiếp. */
  const clearFilter = useCallback(async () => {
    setFilter(null);
    if (conversationId === null) return;

    try {
      await setConversationDepartment(conversationId, null);
    } catch {
      // Hội thoại chưa kịp lưu thì lượt sau vẫn không dính lọc, bỏ qua.
    }
  }, [conversationId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopTicker();
    queueRef.current = '';
    targetRef.current = null;
    conversationRef.current = null;
    setMessages([]);
    setConversationId(null);
    setFilter(null);
    setBusy(false);
  }, [stopTicker]);

  return {
    messages,
    busy,
    filter,
    conversationId,
    send,
    load,
    clearFilter,
    reset,
  };
};
