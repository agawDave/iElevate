import { useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import {
  AdminHeader,
  DateCell,
  DirectoryTable,
  FilterSelect,
  HeaderTabs,
  Pagination,
  PersonCell,
  SearchBox,
  STATUS_FILTER,
  StatusBadge,
  clearButtonClass,
  useDirectory,
} from '../../components/admin/Directory';

const TYPE_LABELS = { beneficiary: 'Beneficiary', specialist: 'Specialist' };

function accountType(row) {
  if (['admin', 'moderator'].includes(row.role)) return row.role === 'admin' ? 'Admin' : 'Moderator';
  return TYPE_LABELS[row.user_type] || row.user_type || '—';
}

export default function AdminUsers() {
  const { user } = useAuth();
  const { rows, pagination, extra, loading, error, params, setParam, clearAll, reload } = useDirectory('/admin/users', { sort: 'newest' });
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const counts = extra.counts || {};
  const filtered = Object.keys(params).some((key) => !['sort', 'page', 'type'].includes(key));
  const actionButton = 'rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50';

  async function setStatus(account, status) {
    const verb = { suspended: 'Suspend', banned: 'Ban', active: 'Activate' }[status];
    if (status !== 'active' && !window.confirm(`${verb} ${account.full_name}? They won’t be able to sign in until an admin activates them again.`)) return;
    setBusyId(account.id);
    setNotice('');
    try {
      await axiosClient.patch(`/admin/users/${account.id}/status`, { status });
      setNotice(`${account.full_name} is now ${status}.`);
      reload();
    } catch (requestError) {
      setNotice(requestError.response?.data?.message || 'Unable to update this account.');
    } finally {
      setBusyId(null);
    }
  }

  const columns = [
    { key: 'name', label: 'Account', render: (row) => <PersonCell name={row.full_name} detail={row.email} avatar={row.avatar_url} note={String(row.id) === String(user?.id) ? '(you)' : ''} /> },
    { key: 'type', label: 'Type', render: accountType },
    // Only problems get a colored badge; "Active" stays quiet.
    { key: 'status', label: 'Status', render: (row) => (row.status === 'active' ? <span className="text-xs text-slate-500">Active</span> : <StatusBadge status={row.status} />) },
    { key: 'joined', label: 'Joined', render: (row) => <DateCell value={row.created_at} /> },
    { key: 'last', label: 'Last login', render: (row) => <DateCell value={row.last_login_at} /> },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (String(row.id) === String(user?.id) ? <span className="text-xs text-slate-400">—</span> : (
        <span className="inline-flex flex-wrap justify-end gap-2">
          {row.status === 'active'
            ? <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row, 'suspended')} className={`${actionButton} border-amber-300 text-amber-800 hover:bg-amber-50`}>Suspend</button>
            : <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row, 'active')} className={`${actionButton} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>Activate</button>}
          {row.status !== 'banned' && <button type="button" disabled={busyId === row.id} onClick={() => setStatus(row, 'banned')} className={`${actionButton} border-red-200 text-red-600 hover:bg-red-50`}>Ban</button>}
        </span>
      )),
    },
  ];

  return (
    <AppLayout>
      <AdminHeader
        title="Manage users"
        tabs={(
          <HeaderTabs
            label="Account type"
            value={params.type}
            onChange={(value) => setParam('type', value)}
            tabs={[
              { value: '', label: 'All', count: counts.everyone },
              { value: 'beneficiary', label: 'Beneficiaries', count: counts.beneficiary },
              { value: 'specialist', label: 'Specialists', count: counts.specialist },
              { value: 'admin', label: 'Admins', count: counts.admin },
            ]}
          />
        )}
      >
        <SearchBox value={params.q} onChange={(value) => setParam('q', value)} placeholder="Name or email…" label="Search users" />
        <FilterSelect label="Status" value={params.status} onChange={(value) => setParam('status', value)} options={STATUS_FILTER} />
        <FilterSelect label="Sort" value={params.sort} onChange={(value) => setParam('sort', value)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'name', label: 'Name A–Z' }, { value: 'last_login', label: 'Recently active' }]} />
        {filtered && <button type="button" onClick={() => clearAll(['type'])} className={clearButtonClass}>Clear filters</button>}
      </AdminHeader>

      {notice && <p role="status" className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-slate-700">{notice}</p>}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <DirectoryTable columns={columns} rows={rows} loading={loading} error={error} emptyText={filtered ? 'No accounts match these filters.' : 'No accounts yet.'} />
        <Pagination pagination={pagination} onPage={(page) => setParam('page', String(page))} noun="accounts" />
      </section>
    </AppLayout>
  );
}
