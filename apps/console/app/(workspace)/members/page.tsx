import { MembersView } from '@/features/members/members-view';
import { RequireRole } from '@/features/workspace/require-role';

const MembersPage = () => (
  <RequireRole minRole="admin">
    <MembersView />
  </RequireRole>
);

export default MembersPage;
