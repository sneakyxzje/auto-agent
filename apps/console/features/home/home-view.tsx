'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatComposer } from '@/features/chat/chat-composer';
import { useHistory } from '@/features/chat/history-context';
import { MessageContent } from '@/features/chat/message-content';
import { type ChatMessage, useChat } from '@/features/chat/use-chat';
import { useImageAttachments } from '@/features/chat/use-image-attachments';
import { useDepartments } from '@/features/departments/use-departments';
import {
  DocumentIcon,
  LogoIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from '@/features/workspace/icons';
import { API_BASE_URL } from '@/lib/api-client';
import { useWorkspace } from '../workspace/workspace-context';

const COLUMN_CLASS = 'mx-auto w-full max-w-3xl';
const GREETING_TEMPLATES = [
  (name: string) => `Hôm nay bạn muốn hỏi gì, ${name}?`,
  (name: string) => `Xin chào ${name}, bạn cần hỏi gì hôm nay?`,
  (name: string) => `Chào ${name}, hôm nay tôi có thể giúp gì?`,
  (name: string) => `Chào ngày mới, ${name}!`,
];
const AssistantNote = ({ message }: { message: ChatMessage }) => {
  if (message.error !== null) {
    return <p className="text-danger text-sm">{message.error}</p>;
  }

  if (message.retracted) {
    return (
      <p className="text-danger text-sm">
        Câu trả lời bị thu hồi vì trích dẫn không khớp tài liệu nào. Câu hỏi đã
        được chuyển cho người phụ trách.
      </p>
    );
  }

  if (message.unverified) {
    return (
      <p className="text-sm text-amber-700">
        Chưa xác minh được nguồn — câu trả lời này không kèm trích dẫn nào.
      </p>
    );
  }

  return null;
};

/**
 * Nguồn chỉ hiện khi đã gõ xong: hiện sớm thì nó nhảy ra trước cả câu trả lời,
 * người đọc chưa biết nội dung đã phải nhìn danh sách tài liệu.
 *
 * Gộp theo tài liệu — một câu trả lời thường lấy vài đoạn của cùng một file, liệt
 * kê từng đoạn chỉ làm dài dòng mà không thêm thông tin gì.
 */
const Sources = ({ message }: { message: ChatMessage }) => {
  if (message.streaming || message.sources.length === 0) return null;

  const documents = [
    ...new Map(
      message.sources.map((source) => [source.documentId, source]),
    ).values(),
  ];

  return (
    <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <span>Nguồn:</span>

      {documents.map((source) => (
        <span key={source.documentId} className="flex items-center gap-1">
          <DocumentIcon className="size-3" />
          {source.documentTitle}
          <span className="text-muted/70">/{source.departmentSlug}</span>
        </span>
      ))}
    </div>
  );
};

const RatingButtons = ({
  message,
  onRate,
}: {
  message: ChatMessage;
  onRate: (rating: 'up' | 'down') => void;
}) => {
  if (message.streaming || message.serverId === null) return null;
  if (message.content.length === 0 || message.error !== null) return null;

  return (
    <div className="text-muted flex items-center gap-1">
      <button
        type="button"
        aria-label="Câu trả lời hữu ích"
        onClick={() => onRate('up')}
        className={`hover:text-foreground cursor-pointer rounded-md bg-transparent p-1 ${
          message.myRating === 'up' ? 'text-emerald-600' : ''
        }`}
      >
        <ThumbUpIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Câu trả lời chưa tốt"
        onClick={() => onRate('down')}
        className={`hover:text-foreground cursor-pointer rounded-md bg-transparent p-1 ${
          message.myRating === 'down' ? 'text-red-500' : ''
        }`}
      >
        <ThumbDownIcon className="size-4" />
      </button>
    </div>
  );
};

const ThinkingIndicator = () => (
  <p className="text-muted flex items-center gap-2 text-sm">
    <span className="flex items-end gap-1.5" aria-hidden="true">
      <span className="thinking-wave bg-current/70 size-1.5 rounded-full" />
      <span className="thinking-wave thinking-wave-2 bg-current/70 size-1.5 rounded-full" />
      <span className="thinking-wave thinking-wave-3 bg-current/70 size-1.5 rounded-full" />
    </span>
  </p>
);

const Greetings = () => {
  const workspace = useWorkspace();
  const [greeting, setGreeting] = useState<string>('');

  useEffect(() => {
    const random = Math.floor(Math.random() * GREETING_TEMPLATES.length);
    const selected = GREETING_TEMPLATES[random];
    if (!selected) return;
    setGreeting(selected(workspace.user.displayName));
  }, [workspace.user.displayName]);
  return (
    <h1 className="text-center text-2xl font-semibold tracking-tight">
      {greeting}
    </h1>
  );
};
export const HomeView = () => {
  const router = useRouter();
  const params = useSearchParams();
  const { departments } = useDepartments();
  const { reload: reloadHistory } = useHistory();
  const openId = params.get('c');

  /**
   * Gắn id vào URL SAU khi lượt hỏi kết thúc, không phải ngay lúc server báo id.
   * Điều hướng giữa chừng làm hiệu ứng mở hội thoại cũ chạy đè lên lượt đang
   * stream — luồng bị huỷ và câu trả lời mất sạch.
   */
  const finishTurn = useCallback(
    (id: string | null) => {
      void reloadHistory();

      if (id !== null && openId === null) router.replace(`/workspace?c=${id}`);
    },
    [openId, reloadHistory, router],
  );

  const {
    messages,
    busy,
    filter,
    conversationId,
    send,
    load,
    rate,
    clearFilter,
    reset,
  } = useChat({ onTurnEnd: finishTurn });

  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<string | null>(null);
  const attachments = useImageAttachments();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const active = departments.filter((department) => department.isActive);
  const empty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mở hội thoại cũ từ thanh bên. Đang stream thì không đụng vào.
  useEffect(() => {
    if (openId === null || openId === conversationId || busy) return;

    void load(openId);
  }, [openId, conversationId, busy, load]);

  const wantsNew = params.get('new');
  useEffect(() => {
    if (wantsNew === null) return;

    reset();
    router.replace('/workspace');
  }, [wantsNew, reset, router]);

  const submit = (): void => {
    if (attachments.uploading) return;

    void send(question, scope, attachments.readyIds);
    setQuestion('');
    attachments.clear();
  };

  const canSend =
    !attachments.uploading &&
    (question.trim().length > 0 || attachments.readyIds.length > 0);

  const startNew = (): void => {
    reset();
    router.replace('/workspace');
  };

  const composer = (
    <ChatComposer
      value={question}
      onChange={setQuestion}
      onSubmit={submit}
      departments={active}
      scope={scope}
      onScopeChange={setScope}
      busy={busy}
      images={attachments.images}
      onAddImages={attachments.add}
      onRemoveImage={attachments.remove}
      canSend={canSend}
      compact={!empty}
    />
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="flex items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          {filter !== null && (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-800">
              Đang hỏi: {filter.name}
              <button
                type="button"
                onClick={() => void clearFilter()}
                aria-label="Bỏ lọc phòng ban"
                className="cursor-pointer bg-transparent px-0.5"
              >
                ✕
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!empty && (
            <Button variant="ghost" onClick={startNew}>
              Cuộc hỏi mới
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className={`${COLUMN_CLASS} flex flex-col gap-8 pt-14 pb-8`}>
            <Greetings />

            {composer}
            {/* <QuickCards /> */}
          </div>
        ) : (
          <div className={`${COLUMN_CLASS} flex flex-col gap-7 py-6`}>
            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="bg-background border-border max-w-[80%] rounded-2xl rounded-br-md border px-4 py-2.5">
                    {message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pb-2">
                        {message.attachments.map((imageId) => (
                          <img
                            key={imageId}
                            src={`${API_BASE_URL}/v1/images/${imageId}`}
                            alt="Ảnh đính kèm"
                            className="border-border max-h-40 rounded-lg border object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {message.content.length > 0 && (
                      <p className="text-base whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.streaming && message.content.length === 0
                      ? 'items-center'
                      : 'items-start'
                  }`}
                >
                  <span className="bg-foreground text-background flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <LogoIcon className="size-4" />
                  </span>

                  <div className="flex min-w-0 flex-col gap-2.5">
                    {message.content.length > 0 && (
                      <MessageContent content={message.content} />
                    )}

                    {message.streaming && message.content.length === 0 && (
                      <ThinkingIndicator />
                    )}

                    <AssistantNote message={message} />
                    <Sources message={message} />
                    <RatingButtons
                      message={message}
                      onRate={(rating) => {
                        if (message.serverId === null) return;
                        void rate(
                          message.id,
                          message.serverId,
                          rating,
                          message.myRating,
                        );
                      }}
                    />

                    {message.escalatedTo !== null && (
                      <p className="text-muted text-sm">
                        Đã chuyển câu hỏi cho phòng{' '}
                        <span className="text-foreground">
                          /{message.escalatedTo}
                        </span>
                        .
                      </p>
                    )}
                  </div>
                </div>
              ),
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!empty && <div className={`${COLUMN_CLASS} pt-3`}>{composer}</div>}
    </div>
  );
};
