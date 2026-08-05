'use client';

import { Link } from '@heroui/react';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { OnboardingModal } from '@/features/onboarding/onboarding-modal';

const PLANNED_SCREENS = [
  { path: '/chat', label: 'Hỏi – đáp' },
  { path: '/documents', label: 'Tài liệu' },
  { path: '/escalations', label: 'Phiếu chuyển' },
  { path: '/curation', label: 'Duyệt tri thức' },
  { path: '/dashboard', label: 'Chỉ số' },
] as const;

const SHELL_CLASS = 'mx-auto max-w-3xl px-6 py-12';

const HomePage = () => {
  const { user, loading, reload } = useCurrentUser();

  if (loading) {
    return (
      <main className={SHELL_CLASS}>
        <p className="text-default-500">Đang tải...</p>
      </main>
    );
  }

  if (user === null) {
    return (
      <main className={SHELL_CLASS}>
        <h1 className="text-2xl font-semibold">Chatbot nội bộ</h1>
        <p className="mt-4 flex gap-3">
          <Link href="/login">Đăng nhập</Link>
          <Link href="/register">Đăng ký</Link>
        </p>
      </main>
    );
  }

  return (
    <main className={SHELL_CLASS}>
      <h1 className="text-2xl font-semibold">Chatbot nội bộ</h1>
      <p className="text-default-500 mt-1">
        {user.displayName}
        {user.tenant !== null && ` — ${user.tenant.name}`}
      </p>

      <p className="mt-8 text-sm font-medium">Màn hình sắp có</p>
      <ul className="text-default-500 mt-2 flex flex-col gap-1 text-sm">
        {PLANNED_SCREENS.map((screen) => (
          <li key={screen.path}>
            <code className="text-foreground">{screen.path}</code> —{' '}
            {screen.label}
          </li>
        ))}
      </ul>

      {user.tenant === null && (
        <OnboardingModal displayName={user.displayName} onDone={reload} />
      )}
    </main>
  );
};

export default HomePage;
