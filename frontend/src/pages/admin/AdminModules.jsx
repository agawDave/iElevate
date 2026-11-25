import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { AdminHeader, DetailPanel, DirectoryTable, HeaderTabs, Pagination, PersonCell, SearchBox, formatDate, useDirectory } from '../../components/admin/Directory';
import ModulesTabs from '../../components/admin/ModulesTabs';
import { SkeletonLines } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import LineIcon from '../../components/ui/LineIcon';
import { MODULE_STATUS, contentSummary } from '../../lib/moduleStatus';

const TABS = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'changes_requested', label: 'Changes requested' },
];
const MATERIAL_TYPES = { pdf: 'PDF', docx: 'Document', video: 'Video', link: 'Link', xlsx: 'Spreadsheet', pptx: 'Slides' };

function Section({ title, children }) {
  return (
    <section className="py-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-1.5 text-sm text-slate-800">{children}</div>
    </section>
  );
}

// One module in the side panel: what the specialist made, and the review.
function ModuleReview({ moduleId, onReviewed }) {
  const [module, setModule] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setModule(null);
    setError('');
    setNote('');
    axiosClient.get(`/admin/modules/${moduleId}`)
      .then((response) => setModule(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to open this module.'));
  }, [moduleId]);

  async function review(status) {
    if (status === 'changes_requested' && note.trim().length < 5) {
      setError('Write a note telling the specialist what to change.');
      return;
    }
    setBusy(status);
    setError('');
    try {
      const response = await axiosClient.patch(`/admin/modules/${moduleId}`, { status, note });
      onReviewed(`${module.title}: ${response.data.message.toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to review this module.');
      setBusy('');
    }
  }

  if (error && !module) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!module) return <SkeletonLines lines={8} label="Loading the module…" />;
  const statusInfo = MODULE_STATUS[module.status] || MODULE_STATUS.none;
  return (
    <div className="divide-y divide-stone-100">
      <div className="pb-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-accent-600">{module.topicTitle} · {module.phase}</p>
        <h3 className="mt-1 text-xl font-extrabold text-slate-900">{module.title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PersonCell name={module.specialist.name} avatar={module.specialist.avatar} detail={module.specialist.email} />
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.style}`}>{statusInfo.check && <LineIcon name="check" strokeWidth={2.5} className="h-3 w-3" />}{statusInfo.label}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {module.hours} hours{module.topicHours ? ` (training design: ${module.topicHours})` : ''} · sent {formatDate(module.submittedAt)}
          {module.reviewedAt ? ` · reviewed ${formatDate(module.reviewedAt)}${module.reviewerName ? ` by ${module.reviewerName}` : ''}` : ''}
        </p>
      </div>
      <Section title="Overview"><p className="whitespace-pre-line">{module.overview || '—'}</p></Section>
      <Section title={`Materials (${module.materials.length})`}>
        {module.materials.length ? (
          <ul className="space-y-1">
            {module.materials.map((item) => (
              <li key={item.id} className="flex gap-2"><span className="w-20 shrink-0 text-xs font-semibold uppercase text-slate-500">{MATERIAL_TYPES[item.type] || item.type}</span><span className="min-w-0 break-words">{item.title}{item.url ? <span className="block truncate text-xs text-slate-500">{item.url}</span> : null}</span></li>
            ))}
          </ul>
        ) : <p className="text-slate-500">None</p>}
      </Section>
      <Section title="Pre/post-test">{module.testQuestions ? `${module.testQuestions} question${module.testQuestions === 1 ? '' : 's'}` : 'None'}</Section>

      {module.status === 'pending' && (
        <div className="pt-4">
          <div className="rounded-xl border border-stone-200 p-4">
            <label htmlFor="review-note" className="text-sm font-medium text-slate-700">
              Note to the specialist <span className="font-normal text-slate-500">(needed to ask for changes)</span>
            </label>
            <textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200" placeholder="e.g. Please add the pre/post-test before resubmitting." />
            {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={() => review('approved')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy === 'approved' ? 'Approving…' : 'Approve'}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => review('changes_requested')} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50 disabled:opacity-50">{busy === 'changes_requested' ? 'Sending…' : 'Ask for changes'}</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Once approved, beneficiaries who need {module.topicTitle} can apply to {module.specialist.name.split(' ')[0]}.</p>
          </div>
        </div>
      )}
      {module.status === 'changes_requested' && module.reviewNote && (
        <Section title="Your note"><p className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-red-900">{module.reviewNote}</p></Section>
      )}
    </div>
  );
}

// Modules → Approval: the modules specialists create for ELEVATE topics,
// waiting for the admin, approved, or sent back with a note.
export default function AdminModules() {
  const { rows, pagination, extra, loading, error, params, setParam, setParams, reload } = useDirectory('/admin/modules', { status: 'pending' });
  const [openId, setOpenId] = useState(null);
  const [notice, setNotice] = useState('');
  const counts = extra.counts || {};
  const close = useCallback(() => setOpenId(null), []);

  function reviewed(message) {
    setOpenId(null);
    setNotice(message);
    reload();
    window.dispatchEvent(new Event('admin-counts-changed'));
  }

  const columns = [
    { key: 'specialist', label: 'Specialist', render: (row) => <PersonCell name={row.specialist.name} avatar={row.specialist.avatar} /> },
    {
      key: 'module',
      label: 'Module',
      render: (row) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-slate-900">{row.title}</span>
          <span className="block text-xs text-slate-500">{row.topicTitle} · {row.phase}</span>
        </span>
      ),
    },
    { key: 'content', label: 'Content', render: (row) => <span className="text-xs text-slate-600">{contentSummary(row.counts)}</span> },
    {
      key: 'date',
      label: params.status === 'pending' ? 'Sent' : 'Reviewed',
      render: (row) => <span className="whitespace-nowrap">{formatDate(params.status === 'pending' ? row.submittedAt : row.reviewedAt)}</span>,
    },
  ];

  return (
    <>
      <AdminHeader
        title="Modules"
        meta="Modules specialists create for the ELEVATE topics. Beneficiaries can apply once you approve one."
        below={<ModulesTabs />}
      >
        <SearchBox value={params.q} onChange={(value) => setParam('q', value)} placeholder="Module, topic or specialist…" label="Search modules" />
        <HeaderTabs
          label="Review status"
          value={params.status}
          onChange={(value) => setParams({ status: value })}
          tabs={TABS.map((tab) => ({ ...tab, count: counts[tab.value] ?? 0, alert: tab.value === 'pending' && counts.pending > 0 }))}
        />
      </AdminHeader>

      {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {!loading && !error && !rows.length && !params.q ? (
          params.status === 'pending'
            ? <EmptyState icon="check" className="py-8" title="Nothing to review">Modules that specialists submit wait here for your approval.</EmptyState>
            : params.status === 'approved'
              ? <EmptyState icon="doc" compact className="py-8" title="No approved modules yet">Approved modules show here. Beneficiaries can apply to them.</EmptyState>
              : <EmptyState icon="doc" compact className="py-8" title="No modules sent back">Modules you ask to change show here until the specialist resubmits them.</EmptyState>
        ) : (
          <DirectoryTable
            columns={columns}
            rows={rows}
            onRowClick={(row) => setOpenId(row.id)}
            viewLabel={params.status === 'pending' ? 'Review' : 'View'}
            loading={loading}
            error={error}
            emptyText="No modules match your search"
            selectedKey={openId}
          />
        )}
        <Pagination pagination={pagination} onPage={(page) => setParam('page', String(page))} noun="modules" />
      </section>

      <DetailPanel open={Boolean(openId)} title="Module" onClose={close}>
        {openId && <ModuleReview moduleId={openId} onReviewed={reviewed} />}
      </DetailPanel>
    </>
  );
}
