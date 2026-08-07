import type { ReactNode } from 'react';
import { WorkspaceShell } from '@/features/workspace/workspace-shell';

/**
 * Shell nằm ở layout chứ không ở từng trang: Next giữ nguyên instance của layout
 * khi đổi route, nên sidebar không bị dựng lại và `/auth/me` chỉ gọi một lần cho
 * cả phiên. Đặt ở trang thì mỗi lần chuyển là một vòng unmount – fetch – spinner.
 */
const WorkspaceLayout = ({ children }: { children: ReactNode }) => (
  <WorkspaceShell>{children}</WorkspaceShell>
);

export default WorkspaceLayout;
