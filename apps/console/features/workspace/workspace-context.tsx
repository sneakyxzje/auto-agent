'use client';

import type { CurrentUser } from '@chatbot/contracts';
import { createContext, type ReactNode, useContext } from 'react';

type WorkspaceValue = {
  user: CurrentUser;
  reload: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export const WorkspaceProvider = ({
  value,
  children,
}: {
  value: WorkspaceValue;
  children: ReactNode;
}) => (
  <WorkspaceContext.Provider value={value}>
    {children}
  </WorkspaceContext.Provider>
);

export const useWorkspace = (): WorkspaceValue => {
  const value = useContext(WorkspaceContext);

  if (value === null) {
    throw new Error('useWorkspace() phải nằm trong <WorkspaceShell>');
  }

  return value;
};
