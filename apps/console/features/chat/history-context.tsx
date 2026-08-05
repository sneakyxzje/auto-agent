'use client';

import type { ConversationSummary } from '@chatbot/contracts';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { listConversations } from './api';

type HistoryValue = {
  conversations: ConversationSummary[];
  loading: boolean;
  reload: () => Promise<void>;
};

const HistoryContext = createContext<HistoryValue | null>(null);

/**
 * Lịch sử sống ở layout chứ không ở trang chat: thanh bên hiện nó ở mọi màn hình,
 * còn trang chat chỉ báo "vừa xong một lượt, tải lại đi". Để state trong trang thì
 * chuyển sang màn khác là mất, mà mỗi màn tự gọi API thì lại có nhiều bản dữ liệu
 * lệch nhau.
 */
export const HistoryProvider = ({ children }: { children: ReactNode }) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <HistoryContext.Provider value={{ conversations, loading, reload }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = (): HistoryValue => {
  const value = useContext(HistoryContext);

  if (value === null) {
    throw new Error('useHistory() phải nằm trong <WorkspaceShell>');
  }

  return value;
};
