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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
                  <div className="hidden md:flex">
                    <Sidebar
                      user={user}
                      onCollapse={() => setSidebarOpen(false)}
                    />
                  </div>
                )}

                {mobileNavOpen && (
                  <div className="md:hidden">
                    <button
                      type="button"
                      aria-label="Đóng menu"
                      onClick={() => setMobileNavOpen(false)}
                      className="fixed inset-0 z-30 cursor-default bg-black/40"
                    />
                    <div className="fixed inset-y-0 left-0 z-40 shadow-xl">
                      <Sidebar
                        user={user}
                        onCollapse={() => setMobileNavOpen(false)}
                        onNavigate={() => setMobileNavOpen(false)}
                      />
                    </div>
                  </div>
                )}

                <div className="bg-surface border-border flex min-w-0 flex-1 flex-col border-l">
                  <Topbar
                    sidebarOpen={sidebarOpen}
                    onExpand={() => setSidebarOpen(true)}
                    onMobileNav={() => setMobileNavOpen(true)}
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
