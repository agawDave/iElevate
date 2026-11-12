import { useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { headerButtonClass } from '../../components/layout/PageHeader';
import axiosClient from '../../api/axiosClient';
import {
  AdminHeader, DirectoryTable, FilterSelect, HeaderTabs, MoreFilters, Pagination, PersonCell, SearchBox,
  clearButtonClass, filterInputClass, filterLabelClass, useDirectory,
} from '../../components/admin/Directory';
import { ACTIVITY_GROUPS, ACTIVITY_GROUP_STYLES as GROUP_STYLES, ACTIVITY_LABELS } from '../../lib/activityLabels';
import { csvDate, downloadCsv } from '../../lib/csv';

const TYPE_LABELS = { beneficiary: 'Beneficiary', specialist: 'Specialist' };

function when(value) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

function userTypeLabel(row) {
  if (['admin', 'moderator'].includes(row.user_role)) return 'Admin';
  return TYPE_LABELS[row.user_type] || '';
}

// Every recorded action, newest first: who did what, on which topic, with whom.
export default function AdminActivityLog() {
  const { rows, pagination, extra, loading, error, params, setParam, setParams, clearAll } = useDirectory('/admin/activity');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const actions = extra.filters?.actions || Object.keys(ACTIVITY_LABELS);
  const counts = extra.counts || {};
  const filtered = Object.keys(params).some((key) => !['page', 'userType'].includes(key));

  const columns = [
    {
      key: 'when',
      label: 'When',
      render: (row) => {
        const { day, time } = when(row.created_at);
        return <span className="whitespace-nowrap"><span className="block text-slate-800">{day}</span><span className="text-xs text-slate-500">{time}</span></span>;
      },
    },
    {
      key: 'who',
      label: 'Who',
      render: (row) => <PersonCell name={row.user_name} detail={userTypeLabel(row)} avatar={row.user_avatar} />,
    },
    {
      key: 'what',
      label: 'What they did',
      render: (row) => (
        <span className="flex items-start gap-2">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${GROUP_STYLES[ACTIVITY_GROUPS[row.action]] || 'bg-stone-400'}`} aria-hidden="true" />
          <span>
            <span className="text-slate-800">{ACTIVITY_LABELS[row.action] || row.action}</span>
            {row.details && <span className="block text-xs text-slate-500">{row.details}</span>}
          </span>
        </span>
      ),
    },
    { key: 'topic', label: 'Topic', render: (row) => row.module_title || <span className="text-slate-400">—</span> },
    { key: 'with', label: 'With', render: (row) => row.target_name || <span className="text-slate-400">—</span> },
  ];

  async function exportCsv() {
    setExporting(true);
    setExportError('');
    try {
      const { page, ...query } = params;
      const response = await axiosClient.get('/admin/activity', { params: { ...query, all: '1' } });
      downloadCsv(`ielevate-activity-log-${new Date().toISOString().slice(0, 10)}.csv`, response.data.data, [
        { label: 'When', value: (row) => csvDate(row.created_at) },
        { label: 'Who', value: (row) => row.user_name },
        { label: 'Role', value: (row) => userTypeLabel(row) },
        { label: 'What they did', value: (row) => ACTIVITY_LABELS[row.action] || row.action },
        { label: 'Details', value: (row) => row.details },
        { label: 'Topic', value: (row) => row.module_title },
        { label: 'With', value: (row) => row.target_name },
      ]);
    } catch (requestError) {
      setExportError(requestError.response?.data?.message || 'Could not download the log.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppLayout>
      <AdminHeader
        title="Activity log"
        tabs={(
          <HeaderTabs
            label="Who"
            value={params.userType}
            onChange={(value) => setParam('userType', value)}
            tabs={[
              { value: '', label: 'Everyone', count: counts.everyone },
              { value: 'beneficiary', label: 'Beneficiaries', count: counts.beneficiary },
              { value: 'specialist', label: 'Specialists', count: counts.specialist },
              { value: 'admin', label: 'Admins', count: counts.admin },
            ]}
          />
        )}
        actions={(
          <button type="button" onClick={exportCsv} disabled={exporting} className={`${headerButtonClass} disabled:opacity-50`}>
            {exporting ? 'Preparing…' : 'Download CSV'}
          </button>
        )}
      >
        <SearchBox value={params.q} onChange={(value) => setParam('q', value)} placeholder="People or topics…" label="Search the activity log" />
        <FilterSelect
          label="What"
          value={params.action}
          onChange={(value) => setParam('action', value)}
          options={[{ value: '', label: 'Everything' }, ...actions.map((action) => ({ value: action, label: ACTIVITY_LABELS[action] || action }))]}
        />
        {/* Logins are hidden unless asked for: they would bury everything else. */}
        {!params.action && (
          <label className={`${filterLabelClass} cursor-pointer`}>
            <input type="checkbox" checked={params.logins === '1'} onChange={(event) => setParam('logins', event.target.checked ? '1' : '')} className="h-4 w-4 accent-accent-500" />
            Show logins
          </label>
        )}
        <MoreFilters active={params.from || params.to ? 1 : 0}>
          <label className={filterLabelClass}>
            From
            <input type="date" value={params.from || ''} max={params.to || undefined} onChange={(event) => setParams({ from: event.target.value })} className={filterInputClass} />
          </label>
          <label className={filterLabelClass}>
            To
            <input type="date" value={params.to || ''} min={params.from || undefined} onChange={(event) => setParams({ to: event.target.value })} className={filterInputClass} />
          </label>
        </MoreFilters>
        {filtered && <button type="button" onClick={() => clearAll(['userType'])} className={clearButtonClass}>Clear filters</button>}
      </AdminHeader>
      {exportError && <p role="alert" className="mb-3 text-sm text-red-600">{exportError}</p>}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <DirectoryTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          emptyText={filtered ? 'Nothing matches these filters.' : 'Nothing has been recorded yet.'}
        />
        <Pagination pagination={pagination} onPage={(page) => setParam('page', String(page))} noun="entries" />
      </section>
      <p className="mt-3 text-xs text-slate-500">
        Logins are hidden unless you tick &ldquo;Show logins&rdquo; or choose &ldquo;Logged in&rdquo;. They are recorded one by one from when the activity log was added. Earlier messages, applications, acceptances, sessions, answers and certificates were filled in from their saved dates, but for each user only their last login before that is known.
      </p>
    </AppLayout>
  );
}
