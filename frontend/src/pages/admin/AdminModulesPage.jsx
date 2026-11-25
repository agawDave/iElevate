import { useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import AdminTrainingDesign from './AdminTrainingDesign';
import AdminModules from './AdminModules';

// Admin → Modules: the Phases and Waiting Approval tabs (?tab=approval).
// Both stay loaded, so switching tabs is instant and keeps each tab's search.
export default function AdminModulesPage() {
  const [searchParams] = useSearchParams();
  const approval = searchParams.get('tab') === 'approval';
  return (
    <AppLayout>
      <div hidden={approval}><AdminTrainingDesign /></div>
      <div hidden={!approval}><AdminModules /></div>
    </AppLayout>
  );
}
