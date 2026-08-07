'use client';

import type {
  ConversationTranscript,
  EscalationTicket,
} from '@chatbot/contracts';
import { Spinner } from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { getTranscript } from '@/features/chat/api';
import { useDepartments } from '@/features/departments/use-departments';
import { PageView } from '@/features/workspace/page-view';
import { API_BASE_URL, ApiError } from '@/lib/api-client';
import { answerTicket, listTickets, reassignTicket } from './api';

const HISTORY_TURNS = 8;

const ConversationPreview = ({
  transcript,
}: {
  transcript: ConversationTranscript | null;
}) => {
  if (transcript === null || transcript.messages.length === 0) return null;

  const recent = transcript.messages.slice(-HISTORY_TURNS);

  return (
    <div className="bg-background border-border max-h-72 overflow-y-auto rounded-xl border p-4">
      <p className="text-muted text-xs">
        Hội thoại của người hỏi ({HISTORY_TURNS} lượt gần nhất)
      </p>

      <div className="mt-2 flex flex-col gap-3">
        {recent.map((message) => (
          <div key={message.id}>
            <p className="text-muted text-[11px]">
              {message.role === 'user' ? 'Người hỏi' : 'Bot'}
            </p>

            {message.attachments.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {message.attachments.map(({ imageId }) => (
                  <a
                    key={imageId}
                    href={`${API_BASE_URL}/v1/images/${imageId}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Mở ảnh gốc"
                  >
                    <img
                      src={`${API_BASE_URL}/v1/images/${imageId}`}
                      alt="Ảnh người hỏi gửi kèm"
                      className="border-border max-h-28 rounded-lg border object-cover"
                    />
                  </a>
                ))}
              </div>
            )}

            {message.content.length > 0 && (
              <p className="mt-0.5 line-clamp-3 text-sm whitespace-pre-wrap">
                {message.content}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const STATUS_OPTIONS = [
  { value: 'open', label: 'Đang chờ trả lời' },
  { value: 'answered', label: 'Đã trả lời' },
  { value: 'closed', label: 'Đã đưa vào kho' },
  { value: '', label: 'Tất cả' },
];

const STATUS_LABELS: Record<EscalationTicket['status'], string> = {
  open: 'Đang chờ',
  answered: 'Đã trả lời',
  overdue: 'Quá hạn',
  closed: 'Đã đưa vào kho',
};

const STATUS_TONES: Record<EscalationTicket['status'], string> = {
  open: 'bg-amber-50 text-amber-700',
  answered: 'bg-sky-50 text-sky-700',
  overdue: 'bg-red-50 text-red-700',
  closed: 'bg-emerald-50 text-emerald-700',
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const EscalationsView = () => {
  const { departments } = useDepartments();
  const [tickets, setTickets] = useState<EscalationTicket[]>([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<EscalationTicket | null>(null);
  const [history, setHistory] = useState<ConversationTranscript | null>(null);
  const [answer, setAnswer] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async (wanted: string) => {
    setLoading(true);

    try {
      setTickets(await listTickets(wanted));
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(status);
  }, [reload, status]);

  const open = (ticket: EscalationTicket): void => {
    setActive(ticket);
    setAnswer(ticket.answerText ?? '');
    setMoveTo(ticket.departmentId);
    setError(null);

    setHistory(null);
    void getTranscript(ticket.conversationId)
      .then(setHistory)
      .catch(() => setHistory(null));
  };

  const submit = async (): Promise<void> => {
    if (active === null || answer.trim().length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      if (moveTo !== active.departmentId) {
        await reassignTicket(active.id, { departmentId: moveTo });
      }

      await answerTicket(active.id, { answer: answer.trim() });
      await reload(status);
      setActive(null);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Không gửi được câu trả lời',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageView
      title="Ticket"
      subtitle="Nếu câu hỏi Agent không có căn cứ để trả lời thì câu hỏi sẽ được đẩy vào tại đây."
    >
      <div className="max-w-xs">
        <SelectField
          label="Trạng thái"
          name="status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
        />
      </div>

      {loading && tickets.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-muted border-border rounded-xl border border-dashed p-8 text-center text-sm">
          Không có phiếu nào ở trạng thái này.
        </p>
      ) : (
        <ul className="border-border divide-separator bg-surface divide-y overflow-hidden rounded-2xl border">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="flex items-start justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{ticket.question}</p>
                <p className="text-muted mt-1 text-sm">
                  {ticket.departmentName} · tạo {formatDate(ticket.createdAt)} ·
                  hạn {formatDate(ticket.dueAt)}
                </p>

                {ticket.answerText !== null && (
                  <p className="text-muted mt-2 line-clamp-2 text-sm">
                    {ticket.answerText}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${STATUS_TONES[ticket.status]}`}
                >
                  {STATUS_LABELS[ticket.status]}
                </span>

                {ticket.status !== 'closed' && (
                  <Button variant="secondary" onClick={() => open(ticket)}>
                    Trả lời
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        title="Trả lời câu hỏi"
        subtitle="Viết như đang trả lời đồng nghiệp. Hệ thống sẽ tự lọc thông tin cá nhân và biên tập lại thành văn phong tài liệu trước khi đưa ra hàng đợi duyệt."
        open={active !== null}
        onClose={() => setActive(null)}
        size="lg"
      >
        {active !== null && (
          <div className="flex flex-col gap-4">
            {error !== null && <Alert tone="danger">{error}</Alert>}

            <div className="bg-background border-border rounded-xl border p-4">
              <p className="text-muted text-xs">Câu hỏi</p>
              <p className="mt-1 text-base">{active.question}</p>
            </div>

            <ConversationPreview transcript={history} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="answer" className="text-sm font-medium">
                Câu trả lời
              </label>
              <textarea
                id="answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows={7}
                disabled={submitting}
                className="border-border bg-surface min-h-40 resize-none rounded-xl border p-3 text-base outline-none"
              />
            </div>

            <SelectField
              label="Phòng ban phụ trách"
              name="moveTo"
              value={moveTo}
              options={departments.map((department) => ({
                value: department.id,
                label: department.name,
              }))}
              onChange={setMoveTo}
              disabled={submitting}
            />

            {moveTo !== active.departmentId && (
              <p className="text-muted -mt-2 text-xs">
                Phiếu sẽ chuyển sang phòng này và hạn xử lý tính lại từ đầu.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => setActive(null)}
                disabled={submitting}
              >
                Huỷ
              </Button>

              <Button onClick={submit} disabled={submitting}>
                {submitting ? 'Đang gửi...' : 'Gửi câu trả lời'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </PageView>
  );
};
