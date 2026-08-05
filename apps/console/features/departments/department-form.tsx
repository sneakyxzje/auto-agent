'use client';

import {
  type CreateDepartment,
  createDepartmentSchema,
} from '@chatbot/contracts';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { TextAreaField } from '@/components/ui/textarea-field';
import { useAuthForm } from '@/features/auth/use-auth-form';
import { createDepartment, toSlug } from './api';

type DepartmentFormProps = {
  onDone: () => Promise<void>;
  onCancel: () => void;
};

export const DepartmentForm = ({ onDone, onCancel }: DepartmentFormProps) => {
  const [slugEdited, setSlugEdited] = useState(false);

  const form = useAuthForm<CreateDepartment>({
    schema: createDepartmentSchema,
    initialValues: { name: '', slug: '', description: '' },
    onSubmit: async (input) => {
      await createDepartment(input);
      await onDone();
    },
  });

  const changeName = (value: string): void => {
    form.setValue('name', value);
    if (!slugEdited) form.setValue('slug', toSlug(value));
  };

  const changeSlug = (value: string): void => {
    setSlugEdited(true);
    form.setValue('slug', toSlug(value));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit}
      noValidate
    >
      {form.formError !== null && <Alert tone="danger">{form.formError}</Alert>}

      <TextField
        label="Tên phòng ban"
        name="name"
        value={form.values.name ?? ''}
        onChange={changeName}
        error={form.fieldErrors.name}
        disabled={form.submitting}
      />

      <TextField
        label="Mã phòng ban"
        name="slug"
        value={form.values.slug ?? ''}
        onChange={changeSlug}
        error={form.fieldErrors.slug}
        disabled={form.submitting}
      />

      <p className="text-muted -mt-2 text-xs">
        Người dùng gõ{' '}
        <span className="font-medium">
          /{form.values.slug || 'ma-phong-ban'}
        </span>{' '}
        trong khung chat để hỏi riêng phòng này. Chỉ chữ thường không dấu, số và
        dấu gạch ngang.
      </p>

      <TextAreaField
        label="Mô tả"
        name="description"
        value={form.values.description ?? ''}
        onChange={(value) => form.setValue('description', value)}
        error={form.fieldErrors.description}
        disabled={form.submitting}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel} disabled={form.submitting}>
          Huỷ
        </Button>

        <Button type="submit" disabled={form.submitting}>
          {form.submitting ? 'Đang tạo...' : 'Tạo phòng ban'}
        </Button>
      </div>
    </form>
  );
};
