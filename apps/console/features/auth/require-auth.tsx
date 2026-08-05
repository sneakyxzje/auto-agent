'use client';

import type { CurrentUser } from '@chatbot/contracts';
import { Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useCurrentUser } from './use-current-user';

type RequireAuthProps = {
  children: (props: {
    user: CurrentUser;
    reload: () => Promise<void>;
  }) => ReactNode;
};

export const RequireAuth = ({ children }: RequireAuthProps) => {
  const router = useRouter();
  const { user, loading, reload } = useCurrentUser();

  useEffect(() => {
    if (!loading && user === null) router.replace('/login');
  }, [loading, user, router]);

  if (loading || user === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children({ user, reload })}</>;
};
