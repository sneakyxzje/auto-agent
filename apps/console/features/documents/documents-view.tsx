'use client';

import { type Document, hasRole } from '@chatbot/contracts';
import { Spinner } from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/select-field';
import { useDepartments } from '@/features/departments/use-departments';
import { PageView } from '@/features/workspace/page-view';
import { useWorkspace } from '@/features/workspace/workspace-context';
import {
  archiveDocument,
  documentFileUrl,
  listDocuments,
  reingestDocument,
} from './api';
import { UploadForm } from './upload-form';

const STATUS_LABELS: Record<Document['status'], string> = {
  draft: 'Nháp',
  published: 'Đang dùng để trả lời',
  archived: 'Đã gỡ',
};

const STATUS_TONES: Record<Document['status'], string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-background text-muted',
};

const INGEST_LABELS: Record<Document['ingestStatus'], string> = {
  pending: 'Đang chờ xử lý',
  processing: 'Đang tách đoạn và tạo embedding',
  done: 'Đã xử lý',
  failed: 'Xử lý hỏng',
};

const INGEST_TONES: Record<Document['ingestStatus'], string> = {
  pending: 'bg-background text-muted',
  processing: 'bg-sky-50 text-sky-700',
  done: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
};

/** Nhịp hỏi lại khi còn tài liệu đang xử lý. */
const POLL_MS = 3_000;

const formatSize = (bytes: number | null): string =>
  bytes === null ? '—' : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('vi-VN');

export const DocumentsView = () => {
  const { user } = useWorkspace();
  const { departments } = useDepartments();

  const canManage = hasRole(user.role, 'manager');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async (departmentId: string, silent = false) => {
    if (!silent) setLoading(true);

    try {
      setDocuments(await listDocuments(departmentId));
    } catch {
      setDocuments([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(filter);
  }, [reload, filter]);

  const working = documents.some(
    (document) =>
      document.ingestStatus === 'pending' ||
      document.ingestStatus === 'processing',
  );

  /**
   * Ingest chạy ở worker nên trang không tự biết lúc nào xong. Chỉ hỏi lại khi
   * còn tài liệu đang chờ, và hỏi lặng lẽ để danh sách không nhấp nháy.
   */
  useEffect(() => {
    if (!working) return;

    const timer = setInterval(() => {
      void reload(filter, true);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [working, reload, filter]);

  const finishUpload = async (): Promise<void> => {
    await reload(filter);
    setFormOpen(false);
  };

  const archive = async (id: string): Promise<void> => {
    await archiveDocument(id);
    await reload(filter);
  };

  const retry = async (id: string): Promise<void> => {
    await reingestDocument(id);
    await reload(filter);
  };

  return (
    <PageView
      title='Tài liệu'
      subtitle='Tài liệu agent sử dụng để trả lời.'
      action={
        canManage && departments.length > 0 ? (
          <Button onClick={() => setFormOpen(true)}>Upload</Button>
        ) : null
      }
    >
      {departments.length === 0 ? (
        <p className='text-muted border-border rounded-xl border border-dashed p-8 text-center text-sm'>
          Chưa có phòng ban nào — tạo phòng ban trước rồi mới tải tài liệu lên
          được.
        </p>
      ) : (
        <>
          <Dialog
            title='Tải tài liệu lên'
            subtitle='Tài liệu thuộc đúng một phòng ban và một mức đọc — hai thứ này quyết định ai hỏi được nội dung trong đó.'
            open={formOpen}
            onClose={() => setFormOpen(false)}
            size='lg'
          >
            <UploadForm
              departments={departments.filter(
                (department) => department.isActive,
              )}
              onDone={finishUpload}
              onCancel={() => setFormOpen(false)}
            />
          </Dialog>

          <div className='max-w-xs'>
            <SelectField
              label='Lọc theo phòng ban'
              name='filter'
              value={filter}
              options={departments.map((department) => ({
                value: department.id,
                label: department.name,
              }))}
              onChange={setFilter}
              placeholder='Tất cả phòng ban'
            />
          </div>

          {loading && documents.length === 0 ? (
            <div className='flex justify-center py-10'>
              <Spinner />
            </div>
          ) : documents.length === 0 ? (
            <p className='text-muted border-border rounded-xl border border-dashed p-8 text-center text-sm'>
              Chưa có tài liệu nào ở đây.
            </p>
          ) : (
            <ul
              className={`border-border divide-separator bg-surface divide-y overflow-hidden rounded-2xl border transition-opacity ${
                loading ? 'opacity-60' : ''
              }`}
            >
              {documents.map((document) => (
                <li key={document.id} className='flex flex-col gap-2 px-5 py-4'>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>{document.title}</p>
                      <p className='text-muted mt-0.5 truncate text-sm'>
                        {document.departmentName} · {document.fileName ?? '—'} ·{' '}
                        {formatSize(document.fileSize)} · bản v
                        {document.version} · {formatDate(document.createdAt)}
                      </p>
                    </div>

                    <div className='flex shrink-0 items-center gap-2'>
                      <a
                        href={documentFileUrl(document.id)}
                        className='border-border hover:bg-surface-secondary rounded-lg border px-2.5 py-1.5 text-xs'
                      >
                        Tải về
                      </a>

                      {canManage && document.status !== 'archived' && (
                        <button
                          type='button'
                          onClick={() => retry(document.id)}
                          disabled={working}
                          title='Bóc lại text, chia đoạn và tạo embedding từ đầu'
                          className='border-border hover:bg-surface-secondary cursor-pointer rounded-lg border bg-transparent px-2.5 py-1.5 text-xs disabled:cursor-default disabled:opacity-40'
                        >
                          {document.ingestStatus === 'pending' ||
                          document.ingestStatus === 'processing'
                            ? 'Xử lý ngay'
                            : 'Xử lý lại'}
                        </button>
                      )}

                      {canManage && document.status !== 'archived' && (
                        <button
                          type='button'
                          onClick={() => archive(document.id)}
                          className='border-border text-danger hover:bg-surface-secondary cursor-pointer rounded-lg border bg-transparent px-2.5 py-1.5 text-xs'
                        >
                          Gỡ
                        </button>
                      )}
                    </div>
                  </div>

                  <div className='flex flex-wrap items-center gap-2'>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${STATUS_TONES[document.status]}`}
                    >
                      {STATUS_LABELS[document.status]}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${INGEST_TONES[document.ingestStatus]}`}
                    >
                      {INGEST_LABELS[document.ingestStatus]}
                      {document.ingestStatus === 'done' &&
                        ` · ${document.chunkCount} đoạn`}
                    </span>

                    <span className='border-border text-muted rounded-full border px-2.5 py-1 text-xs'>
                      {document.audience === 'public'
                        ? 'Khách ngoài đọc được'
                        : 'Chỉ nội bộ'}
                    </span>

                    {document.effectiveTo !== null && (
                      <span className='border-border text-muted rounded-full border px-2.5 py-1 text-xs'>
                        Hết hiệu lực {formatDate(document.effectiveTo)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageView>
  );
};
