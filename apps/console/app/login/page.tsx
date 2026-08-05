'use client';

import { type LoginInput, loginSchema } from '@chatbot/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { login } from '@/features/auth/api';
import { AuthCard, authFormClassName } from '@/features/auth/auth-card';
import { useAuthForm } from '@/features/auth/use-auth-form';

const LoginPage = () => {
  const router = useRouter();

  const form = useAuthForm<LoginInput>({
    schema: loginSchema,
    initialValues: { email: '', password: '' },
    onSubmit: async (input) => {
      await login(input);
      router.push('/');
      router.refresh();
    },
  });

  return (
    <AuthCard
      title="Đăng nhập"
      subtitle="Chatbot nội bộ"
      footer={
        <>
          Chưa có tài khoản? <Link href="/register">Đăng ký</Link>
        </>
      }
    >
      <form
        className={authFormClassName}
        onSubmit={form.handleSubmit}
        noValidate
      >
        {form.formError !== null && (
          <Alert tone="danger">{form.formError}</Alert>
        )}

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.values.email ?? ''}
          onChange={(value) => form.setValue('email', value)}
          error={form.fieldErrors.email}
          disabled={form.submitting}
        />

        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.values.password ?? ''}
          onChange={(value) => form.setValue('password', value)}
          error={form.fieldErrors.password}
          disabled={form.submitting}
        />

        <Button type="submit" block disabled={form.submitting}>
          {form.submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>
    </AuthCard>
  );
};

export default LoginPage;
