'use client';

import { type FormEvent, useState } from 'react';
import type { ZodType } from 'zod';
import { ApiError } from '@/lib/api-client';

type UseAuthFormOptions<TInput> = {
  /** Schema lấy thẳng từ @chatbot/contracts — đúng cái server dùng để kiểm tra. */
  schema: ZodType<TInput>;
  initialValues: Record<string, string>;
  onSubmit: (input: TInput) => Promise<void>;
};

/**
 * Gom toàn bộ phần lặp lại của một form: giá trị các ô, lỗi từng ô, lỗi chung,
 * trạng thái đang gửi. Hai trang đăng nhập và đăng ký chỉ khác nhau ở schema và
 * hàm gọi API, nên phần còn lại nằm hết ở đây.
 *
 * Kiểm tra ở client bằng ĐÚNG schema mà server dùng — nhờ monorepo nên không có
 * chuyện hai bên lệch luật. Nhưng client chỉ để báo lỗi sớm cho người dùng, server
 * vẫn kiểm lại; ai cũng gọi thẳng API được, không bao giờ tin dữ liệu từ trình duyệt.
 */
export const useAuthForm = <TInput>({
  schema,
  initialValues,
  onSubmit,
}: UseAuthFormOptions<TInput>) => {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (name: string, value: string): void => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      const { [name]: _removed, ...rest } = current;
      return rest;
    });
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.'),
            issue.message,
          ]),
        ),
      );
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      await onSubmit(parsed.data);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError('Không kết nối được máy chủ');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValue, fieldErrors, formError, submitting, handleSubmit };
};
