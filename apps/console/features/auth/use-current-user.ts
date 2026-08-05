'use client';

import type { CurrentUser } from '@chatbot/contracts';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

type State = {
  user: CurrentUser | null;
  loading: boolean;
};

export const useCurrentUser = () => {
  const [state, setState] = useState<State>({ user: null, loading: true });

  const reload = useCallback(async () => {
    try {
      const user = await apiRequest<CurrentUser>('/v1/auth/me');
      setState({ user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
};
