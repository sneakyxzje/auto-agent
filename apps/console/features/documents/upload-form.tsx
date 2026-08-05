'use client';

import { DOCUMENT_EXTENSIONS, MAX_DOCUMENT_BYTES } from '@chatbot/contracts';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import type { DepartmentSummary } from '@/features/departments/api';
import { ApiError } from '@/lib/api-client';
import { uploadDocument } from './api';

type UploadFormProps = {
  departments: DepartmentSummary[];
  onDone: () => Promise<void>;
  onCancel: () => void;
};

const ACCEPT = DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(
  ',',
);

const AUDIENCE_OPTIONS = [
  { value: 'internal', label: 'Nội bộ — chỉ nhân viên đọc được' },
  { value: 'public', label: 'Công khai — khách ngoài cũng đọc được' },
];

const titleFromFileName = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, '');

export const UploadForm = ({
  departments,
  onDone,
  onCancel,
}: UploadFormProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '');
  const [audience, setAudience] = useState('internal');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickFile = (picked: File | null): void => {
    setFile(picked);
    if (picked !== null && title.trim().length === 0) {
      setTitle(titleFromFileName(picked.name));
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (file === null) return setError('Hãy chọn file tài liệu');
    if (file.size > MAX_DOCUMENT_BYTES) return setError('File vượt quá 50MB');
    if (departmentId === '') return setError('Hãy chọn phòng ban');
    if (title.trim().length === 0) return setError('Hãy đặt tiêu đề tài liệu');

    setSubmitting(true);

    try {
      await uploadDocument({
        file,
        title: title.trim(),
        departmentId,
        audience: audience === 'public' ? 'public' : 'internal',
        effectiveTo,
      });
      await onDone();
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : 'Không tải lên được, thử lại sau',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {error !== null && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm font-medium">
          File tài liệu
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept={ACCEPT}
          disabled={submitting}
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          className="border-border file:bg-background hover:border-accent cursor-pointer rounded-xl border border-dashed p-3 text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="text-muted text-xs">
          Nhận {DOCUMENT_EXTENSIONS.join(', ')} — tối đa 50MB. Tài liệu phải có
          sẵn text, bản scan chưa hỗ trợ.
        </p>
      </div>

      <TextField
        label="Tiêu đề"
        name="title"
        value={title}
        onChange={setTitle}
        disabled={submitting}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Phòng ban"
          name="departmentId"
          value={departmentId}
          options={departments.map((department) => ({
            value: department.id,
            label: department.name,
          }))}
          onChange={setDepartmentId}
          placeholder="Chọn phòng ban"
          disabled={submitting}
        />

        <SelectField
          label="Ai được đọc"
          name="audience"
          value={audience}
          options={AUDIENCE_OPTIONS}
          onChange={setAudience}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="effectiveTo" className="text-sm font-medium">
          Hiệu lực đến (tuỳ chọn)
        </label>
        <input
          id="effectiveTo"
          name="effectiveTo"
          type="date"
          value={effectiveTo}
          disabled={submitting}
          onChange={(event) => setEffectiveTo(event.target.value)}
          className="border-border bg-surface h-11 rounded-xl border px-3 text-sm"
        />
        <p className="text-muted text-xs">
          Quá ngày này tài liệu tự ngừng được dùng để trả lời.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Huỷ
        </Button>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Đang tải lên...' : 'Tải lên'}
        </Button>
      </div>
    </form>
  );
};
