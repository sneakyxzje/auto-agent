'use client';

import { Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useCurrentUser } from './use-current-user';

export const RedirectWhenSignedIn = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && user !== null) router.replace('/workspace');
  }, [loading, user, router]);

  if (loading || user !== null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
};
