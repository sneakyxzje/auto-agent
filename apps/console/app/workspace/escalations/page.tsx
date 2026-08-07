import { EscalationsView } from '@/features/escalations/escalations-view';
import { RequireRole } from '@/features/workspace/require-role';

const EscalationsPage = () => (
  <RequireRole minRole="manager">
    <EscalationsView />
  </RequireRole>
);

export default EscalationsPage;
