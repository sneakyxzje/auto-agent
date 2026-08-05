'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { OnboardingModal } from '@/features/onboarding/onboarding-modal';

const PLANNED_SCREENS = [
  { path: '/chat', label: 'Hỏi – đáp' },
  { path: '/documents', label: 'Tài liệu' },
  { path: '/escalations', label: 'Phiếu chuyển' },
  { path: '/curation', label: 'Duyệt tri thức' },
  { path: '/dashboard', label: 'Chỉ số' },
] as const;

const HomePage = () => {
  const { user, loading, reload } = useCurrentUser();

  if (loading) {
    return (
      <main
        style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1.5rem' }}
      >
        <p>Đang tải...</p>
      </main>
    );
  }

  if (user === null) {
    return (
      <main
        style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1.5rem' }}
      >
        <h1>Chatbot nội bộ — Console</h1>
        <p>
          <Link href="/login">Đăng nhập</Link> ·{' '}
          <Link href="/register">Đăng ký</Link>
        </p>
      </main>
    );
  }

  return (
    <main
      style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1.5rem' }}
    >
      <h1>Chatbot nội bộ — Console</h1>
      <p>
        {user.displayName}
        {user.tenant !== null && ` — ${user.tenant.name}`}
      </p>

      <p>Các màn hình dưới đây chưa được triển khai.</p>
      <ul>
        {PLANNED_SCREENS.map((screen) => (
          <li key={screen.path}>
            <code>{screen.path}</code> — {screen.label}
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
