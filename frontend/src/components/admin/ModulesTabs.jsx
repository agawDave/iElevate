import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { HeaderTabs } from './Directory';

// The admin Modules page's two tabs, like the Activity log's (?tab=approval):
// the training design, and approving the modules specialists make for it.
export default function ModulesTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [counts, setCounts] = useState({});
  useEffect(() => {
    const load = () => axiosClient.get('/admin/nav-counts').then((response) => setCounts(response.data.data)).catch(() => {});
    load();
    // Both tabs announce changes (a module added, a review), so the counts update at once.
    window.addEventListener('admin-counts-changed', load);
    return () => window.removeEventListener('admin-counts-changed', load);
  }, []);

  function choose(value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('tab', value); else next.delete('tab');
    setSearchParams(next);
  }

  return (
    <HeaderTabs
      compact={false}
      label="Modules"
      value={searchParams.get('tab') || ''}
      onChange={choose}
      tabs={[
        { value: '', label: 'Phases', count: counts.design_modules },
        { value: 'approval', label: 'Waiting Approval', count: counts.pending_modules, alert: counts.pending_modules > 0 },
      ]}
    />
  );
}
