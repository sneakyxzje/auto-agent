import { CurationView } from '@/features/curation/curation-view';
import { RequireRole } from '@/features/workspace/require-role';

const CurationPage = () => (
  <RequireRole minRole="manager">
    <CurationView />
  </RequireRole>
);

export default CurationPage;
