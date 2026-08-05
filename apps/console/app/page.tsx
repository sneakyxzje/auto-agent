'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logout } from '@/features/auth/api';
import { RequireAuth } from '@/features/auth/require-auth';
import { OnboardingModal } from '@/features/onboarding/onboarding-modal';

const PLANNED_SCREENS = [
  { path: '/chat', label: 'Hỏi – đáp' },
  { path: '/documents', label: 'Tài liệu' },
  { path: '/escalations', label: 'Phiếu chuyển' },
  { path: '/curation', label: 'Duyệt tri thức' },
  { path: '/dashboard', label: 'Chỉ số' },
] as const;

const HomePage = () => {
  const router = useRouter();

  const signOut = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <RequireAuth>
      {({ user, reload }) => (
        <main className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Chatbot nội bộ</h1>
              <p className="text-default-500 mt-1">
                {user.displayName}
                {user.tenant !== null && ` — ${user.tenant.name}`}
              </p>
            </div>

            <Button variant="ghost" onClick={signOut}>
              Đăng xuất
            </Button>
          </div>

          <p className="mt-10 text-sm font-medium">Màn hình sắp có</p>
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
      )}
    </RequireAuth>
  );
};

export default HomePage;
