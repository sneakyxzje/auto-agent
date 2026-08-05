'use client';

import { type ReactNode, useState } from 'react';
import { RequireAuth } from '@/features/auth/require-auth';
import { HistoryProvider } from '@/features/chat/history-context';
import { OnboardingModal } from '@/features/onboarding/onboarding-modal';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { WorkspaceProvider } from './workspace-context';

type WorkspaceShellProps = { children: ReactNode };

export const WorkspaceShell = ({ children }: WorkspaceShellProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <RequireAuth>
      {({ user, reload }) =>
        user.tenant === null ? (
          <div className="bg-background min-h-dvh">
            <OnboardingModal displayName={user.displayName} onDone={reload} />
          </div>
        ) : (
          <WorkspaceProvider value={{ user, reload }}>
            <HistoryProvider>
              <div className="bg-background flex h-dvh overflow-hidden">
                {sidebarOpen && (
                  <Sidebar
                    user={user}
                    onCollapse={() => setSidebarOpen(false)}
                  />
                )}

                <div className="bg-surface border-border flex min-w-0 flex-1 flex-col border-l">
                  <Topbar
                    sidebarOpen={sidebarOpen}
                    onExpand={() => setSidebarOpen(true)}
                  />

                  <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-6">
                    {children}
                  </main>
                </div>
              </div>
            </HistoryProvider>
          </WorkspaceProvider>
        )
      }
    </RequireAuth>
  );
};
