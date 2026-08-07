'use client';

import { type RegisterInput, registerSchema } from '@chatbot/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { register } from '@/features/auth/api';
import { AuthCard, authFormClassName } from '@/features/auth/auth-card';
import { RedirectWhenSignedIn } from '@/features/auth/redirect-when-signed-in';
import { useAuthForm } from '@/features/auth/use-auth-form';

const RegisterPage = () => {
  const router = useRouter();

  const form = useAuthForm<RegisterInput>({
    schema: registerSchema,
    initialValues: { displayName: '', email: '', password: '' },
    onSubmit: async (input) => {
      await register(input);
      router.push('/workspace');
      router.refresh();
    },
  });

  return (
    <RedirectWhenSignedIn>
      <AuthCard
        title='Tạo tài khoản'
        subtitle='Xong bước này bạn sẽ chọn tạo công ty hoặc nhập mã mời'
        footer={
          <>
            Đã có tài khoản? <Link href='/login'>Đăng nhập</Link>
          </>
        }
      >
        <form
          className={authFormClassName}
          onSubmit={form.handleSubmit}
          noValidate
        >
          {form.formError !== null && (
            <Alert tone='danger'>{form.formError}</Alert>
          )}

          <TextField
            label='Họ tên'
            name='displayName'
            autoComplete='name'
            value={form.values.displayName ?? ''}
            onChange={(value) => form.setValue('displayName', value)}
            error={form.fieldErrors.displayName}
            disabled={form.submitting}
          />

          <TextField
            label='Email'
            name='email'
            type='email'
            autoComplete='email'
            value={form.values.email ?? ''}
            onChange={(value) => form.setValue('email', value)}
            error={form.fieldErrors.email}
            disabled={form.submitting}
          />

          <TextField
            label='Mật khẩu'
            name='password'
            type='password'
            autoComplete='new-password'
            value={form.values.password ?? ''}
            onChange={(value) => form.setValue('password', value)}
            error={form.fieldErrors.password}
            disabled={form.submitting}
          />

          <Button type='submit' block disabled={form.submitting}>
            {form.submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
          </Button>
        </form>
      </AuthCard>
    </RedirectWhenSignedIn>
  );
};

export default RegisterPage;
