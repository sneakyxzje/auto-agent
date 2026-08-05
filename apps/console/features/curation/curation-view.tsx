'use client';

import type { KnowledgeCandidate } from '@chatbot/contracts';
import { Spinner } from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { PageView } from '@/features/workspace/page-view';
import { ApiError } from '@/lib/api-client';
import { approveCandidate, listCandidates, rejectCandidate } from './api';

const AUDIENCE_OPTIONS = [
  { value: 'internal', label: 'Nội bộ — chỉ nhân viên đọc được' },
  { value: 'public', label: 'Công khai — khách ngoài cũng đọc được' },
];

/** Cảnh báo hàng đợi dồn ứ, theo tiêu chí nghiệm thu của FR-6. */
const QUEUE_WARNING = 10;
const STALE_DAYS = 5;

const daysSince = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export const CurationView = () => {
  const [candidates, setCandidates] = useState<KnowledgeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<KnowledgeCandidate | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('internal');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      setCandidates(await listCandidates('pending'));
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = (candidate: KnowledgeCandidate): void => {
    setActive(candidate);
    setTitle(candidate.suggestedTitle);
    setContent(candidate.normalizedAnswer ?? candidate.rawAnswer);
    setAudience(candidate.audience);
    setEffectiveTo('');
    setError(null);
  };

  const approve = async (): Promise<void> => {
    if (active === null) return;

    setSubmitting(true);
    setError(null);

    try {
      await approveCandidate(active.id, {
        title: title.trim(),
        content: content.trim(),
        audience: audience === 'public' ? 'public' : 'internal',
        effectiveTo: effectiveTo === '' ? null : effectiveTo,
      });
      await reload();
      setActive(null);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'Không duyệt được',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async (): Promise<void> => {
    if (active === null) return;

    setSubmitting(true);

    try {
      await rejectCandidate(active.id);
      await reload();
      setActive(null);
    } finally {
      setSubmitting(false);
    }
  };

  const oldest = candidates.at(-1);
  const stale =
    oldest !== undefined && daysSince(oldest.createdAt) > STALE_DAYS;

  return (
    <PageView
      title="Duyệt tri thức"
      subtitle="Câu trả lời của người phụ trách chờ được đưa vào kho. Duyệt xong là mọi người hỏi lại đều được trả lời."
    >
      {(candidates.length > QUEUE_WARNING || stale) && (
        <Alert tone="danger">
          {candidates.length > QUEUE_WARNING
            ? `Hàng đợi đang có ${candidates.length} mục chờ duyệt.`
            : `Mục cũ nhất đã chờ ${daysSince(oldest?.createdAt ?? '')} ngày.`}{' '}
          Hàng đợi dồn ứ là cơ chế bot tự học ngừng chạy.
        </Alert>
      )}

      {loading && candidates.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-muted border-border rounded-xl border border-dashed p-8 text-center text-sm">
          Không có ứng viên nào chờ duyệt.
        </p>
      ) : (
        <ul className="border-border divide-separator bg-surface divide-y overflow-hidden rounded-2xl border">
          {candidates.map((candidate) => (
            <li
              key={candidate.id}
              className="flex items-start justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{candidate.suggestedTitle}</p>
                <p className="text-muted mt-1 text-sm">
                  {candidate.departmentName} · từ câu hỏi "{candidate.question}"
                </p>

                {candidate.similarChunks.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Có {candidate.similarChunks.length} đoạn tài liệu gần giống
                    — cần đối chiếu trước khi duyệt
                  </p>
                )}
              </div>

              <Button variant="secondary" onClick={() => open(candidate)}>
                Xem & duyệt
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        title="Duyệt tri thức mới"
        subtitle="Duyệt là nội dung này vào kho ngay, mọi người hỏi trúng đều nhận được. Đọc kỹ phần đối chiếu bên dưới trước khi bấm."
        open={active !== null}
        onClose={() => setActive(null)}
        size="lg"
      >
        {active !== null && (
          <div className="flex flex-col gap-4">
            {error !== null && <Alert tone="danger">{error}</Alert>}

            <div className="bg-background border-border rounded-xl border p-4">
              <p className="text-muted text-xs">Câu hỏi gốc</p>
              <p className="mt-1 text-sm">{active.question}</p>
              <p className="text-muted mt-3 text-xs">
                Người phụ trách viết (đã lọc thông tin cá nhân)
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {active.rawAnswer}
              </p>
            </div>

            <TextField
              label="Tiêu đề tài liệu"
              name="title"
              value={title}
              onChange={setTitle}
              disabled={submitting}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="content" className="text-sm font-medium">
                Nội dung sẽ vào kho
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={8}
                disabled={submitting}
                className="border-border bg-surface min-h-44 resize-none rounded-xl border p-3 text-base outline-none"
              />
              <p className="text-muted text-xs">
                Sửa thẳng ở đây trước khi duyệt nếu thấy chưa ổn.
              </p>
            </div>

            {active.similarChunks.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  Tài liệu sẵn có gần giống ({active.similarChunks.length})
                </p>
                <p className="text-muted -mt-1 text-xs">
                  Nếu nội dung mới mâu thuẫn với các đoạn này, sửa lại hoặc bỏ
                  qua — hai đoạn chọi nhau trong kho sẽ khiến bot trả lời lúc
                  đúng lúc sai.
                </p>

                {active.similarChunks.map((chunk) => (
                  <div
                    key={chunk.chunkId}
                    className="border-border bg-background rounded-xl border p-3"
                  >
                    <p className="text-muted text-xs">
                      {chunk.documentTitle} · giống{' '}
                      {Math.round(chunk.similarity * 100)}%
                    </p>
                    <p className="mt-1 line-clamp-6 text-sm whitespace-pre-wrap">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Ai được đọc"
                name="audience"
                value={audience}
                options={AUDIENCE_OPTIONS}
                onChange={setAudience}
                disabled={submitting}
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="effectiveTo" className="text-sm font-medium">
                  Hiệu lực đến (tuỳ chọn)
                </label>
                <input
                  id="effectiveTo"
                  type="date"
                  value={effectiveTo}
                  disabled={submitting}
                  onChange={(event) => setEffectiveTo(event.target.value)}
                  className="border-border bg-surface h-11 rounded-xl border px-3 text-sm"
                />
              </div>
            </div>

            <p className="text-muted -mt-2 text-xs">
              Nội dung có tính thời điểm ("tháng này", "đợt này") thì bắt buộc
              đặt hạn, không thì nó nằm trong kho vĩnh viễn.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={reject} disabled={submitting}>
                Bỏ ứng viên
              </Button>

              <Button onClick={approve} disabled={submitting}>
                {submitting ? 'Đang duyệt...' : 'Duyệt và đưa vào kho'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </PageView>
  );
};
