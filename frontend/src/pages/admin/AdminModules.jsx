import { useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import axiosClient from '../../api/axiosClient';
import { AdminHeader, HeaderTabs, Pagination, SearchBox, StatusBadge, formatDate, useDirectory } from '../../components/admin/Directory';
import { SkeletonLines } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// Specialist-submitted modules waiting for review. The ELEVATE topic modules
// come from the program's training designs and aren't reviewed here.
export default function AdminModules() {
  const { rows, pagination, extra, loading, error, params, setParam, setParams, reload } = useDirectory('/admin/modules', { status: 'pending' });
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const counts = extra.counts || {};

  async function review(module, status) {
    if (status === 'rejected' && !window.confirm(`Reject “${module.title}”?`)) return;
    setBusyId(module.id);
    setNotice('');
    try {
      const response = await axiosClient.patch(`/admin/modules/${module.id}`, { status });
      setNotice(`${module.title}: ${response.data.message.toLowerCase()}.`);
      reload();
      window.dispatchEvent(new Event('admin-counts-changed'));
    } catch (requestError) {
      setNotice(requestError.response?.data?.message || 'Unable to review this module.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppLayout>
      <AdminHeader
        title="Module approval"
        meta="Modules specialists submit. ELEVATE topics don’t need approval."
        tabs={(
          <HeaderTabs
            label="Review status"
            value={params.status}
            onChange={(value) => setParams({ status: value })}
            tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.value] ?? 0, alert: tab.value === 'pending' && counts.pending > 0 }))}
          />
        )}
      >
        <SearchBox value={params.q} onChange={(value) => setParam('q', value)} placeholder="Title, description or specialist…" label="Search modules" />
      </AdminHeader>

      {notice && <p role="status" className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-slate-700">{notice}</p>}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {error ? (
          <p role="alert" className="px-4 py-8 text-center text-sm text-red-600">{error}</p>
        ) : loading && !rows.length ? (
          <SkeletonLines lines={5} label="Loading modules…" className="px-5 py-6" />
        ) : rows.length ? (
          <ul className="divide-y divide-stone-100">
            {rows.map((module) => (
              <li key={module.id} className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${loading ? 'opacity-60' : ''}`}>
                <div className="min-w-0 max-w-2xl">
                  <p className="text-xs uppercase tracking-wider text-slate-500">{module.phase} · {module.hours} hours · submitted {formatDate(module.created_at)}</p>
                  <h2 className="mt-1 font-semibold text-slate-900">{module.title} <StatusBadge status={module.approval_status} /></h2>
                  <p className="mt-0.5 text-sm text-slate-500">By {module.specialist_name || 'unknown'}{module.specialist_email ? ` · ${module.specialist_email}` : ''}</p>
                  <p className="mt-2 text-sm text-slate-700">{module.description}</p>
                  {module.reviewed_at && <p className="mt-1 text-xs text-slate-500">Reviewed {formatDate(module.reviewed_at)}{module.reviewer_name ? ` by ${module.reviewer_name}` : ''}</p>}
                </div>
                {module.approval_status === 'pending' && (
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === module.id} onClick={() => review(module, 'approved')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                    <button type="button" disabled={busyId === module.id} onClick={() => review(module, 'rejected')} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          params.q
            ? <EmptyState icon="search" compact className="py-8" title="No modules match your search" />
            : params.status === 'pending'
              ? <EmptyState icon="check" className="py-8" title="Nothing to review">Modules that specialists submit wait here for your approval.</EmptyState>
              : <EmptyState icon="doc" compact className="py-8" title={`No ${params.status} modules`} />
        )}
        <Pagination pagination={pagination} onPage={(page) => setParam('page', String(page))} noun="modules" />
      </section>
    </AppLayout>
  );
}
