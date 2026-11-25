import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import axiosClient from '../../api/axiosClient';
import { formatPlace } from '../../lib/places';
import { openCertificate } from '../../lib/certificates';
import { SkeletonLines } from '../../components/ui/Skeleton';
import DirectChatPanel, { MessageButton } from '../../components/chat/DirectChatPanel';
import {
  AdminHeader,
  DateCell,
  DetailPanel,
  DetailRow,
  DirectoryTable,
  FilterSelect,
  HeaderTabs,
  MoreFilters,
  Pagination,
  PersonCell,
  ProfileHeader,
  SearchBox,
  STATUS_FILTER,
  StatusBadge,
  clearButtonClass,
  formatDate,
  useDirectory,
} from '../../components/admin/Directory';

const SECTOR_LABELS = { pwd: 'PWD', four_ps: '4Ps', indigenous: 'IP', solo_parent: 'Solo parent', out_of_school_youth: 'Out-of-school youth' };
const SEX_LABELS = { female: 'Female', male: 'Male', prefer_not_to_say: 'Prefer not to say' };
const CIVIL_LABELS = { single: 'Single', married: 'Married', widowed: 'Widowed', separated: 'Separated' };
const EDUCATION_LABELS = { elementary: 'Elementary', high_school: 'High school', senior_high: 'Senior high school', vocational: 'Vocational / TESDA', college_level: 'College level', college_graduate: 'College graduate', postgraduate: 'Postgraduate' };
const WORK_LABELS = { unemployed: 'Unemployed', employed: 'Employed', self_employed: 'Self-employed', student: 'Student' };
const PROGRESS_LABELS = { incoming: 'Incoming', ongoing: 'Ongoing', completed: 'Completed' };
const ASSIGNMENT_LABELS = { suggested: 'Not applied yet', waiting: 'Waiting for a specialist', queued: 'Next up' };

function placeOf(row) {
  return formatPlace({ country: row.country || 'Philippines', regionCode: row.region_code, province: row.province, city: row.city, barangay: row.barangay, stateRegion: row.state_region })
    || [row.barangay && `Brgy. ${row.barangay}`, row.city, row.province].filter(Boolean).join(', ');
}

function BeneficiaryDetail({ id, onChat }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  useEffect(() => {
    setData(null);
    axiosClient.get(`/admin/beneficiaries/${id}`)
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load this beneficiary.'));
  }, [id]);
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!data) return <SkeletonLines lines={8} label="Loading this beneficiary…" />;
  return (
    <div className="space-y-6">
      <ProfileHeader name={data.full_name} email={data.email} src={data.avatar_url} status={data.status} />
      <div className="flex flex-wrap items-center gap-2">
        <MessageButton userId={id} onOpen={onChat} />
        <Link to={`/admin/beneficiaries/${id}/portfolio`} className="inline-block rounded-lg border border-brand-600 px-3.5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          View learning portfolio
        </Link>
      </div>
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-600">Profile</h3>
        <dl>
          <DetailRow label="Status"><StatusBadge status={data.status} /></DetailRow>
          <DetailRow label="Sex">{SEX_LABELS[data.sex]}</DetailRow>
          <DetailRow label="Birthdate / age">{data.birthdate ? `${formatDate(data.birthdate)} (${data.age})` : data.age}</DetailRow>
          <DetailRow label="Civil status">{CIVIL_LABELS[data.civil_status]}</DetailRow>
          <DetailRow label="Education">{EDUCATION_LABELS[data.education]}</DetailRow>
          <DetailRow label="Work">{WORK_LABELS[data.work_status]}</DetailRow>
          <DetailRow label="Sectors">{data.sector_tags.map((tag) => SECTOR_LABELS[tag]).join(', ')}</DetailRow>
          <DetailRow label="Mobile">{data.mobile_number}</DetailRow>
          <DetailRow label="Address">{placeOf(data)}</DetailRow>
          <DetailRow label="Joined">{formatDate(data.created_at)}</DetailRow>
          <DetailRow label="Last login">{formatDate(data.last_login_at)}</DetailRow>
        </dl>
      </section>
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-600">Learning plan</h3>
        <dl>
          <DetailRow label="Main goal">{data.goal_label}</DetailRow>
          <DetailRow label="Pre-assessment taken">{formatDate(data.skill_check_at)}</DetailRow>
          <DetailRow label="Device / internet">{[data.device_access, data.internet_access].filter(Boolean).join(' · ')}</DetailRow>
          <DetailRow label="Learning modes">{data.learning_modes.join(', ').replace(/_/g, '-')}</DetailRow>
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-600">Topics ({data.topics.length})</h3>
        {fileError && <p role="alert" className="mb-2 text-sm text-red-600">{fileError}</p>}
        {data.topics.length ? (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {data.topics.map((topic) => (
              <li key={topic.module_id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">{topic.title}</span>
                  <span className="block text-xs text-slate-500">
                    {topic.specialist_name ? `with ${topic.specialist_name}` : ASSIGNMENT_LABELS[topic.assignment_status] || topic.assignment_status}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-xs font-semibold text-slate-600">
                    {topic.progress ? PROGRESS_LABELS[topic.progress] : ASSIGNMENT_LABELS[topic.assignment_status] || ''}
                  </span>
                  {topic.certificate_has_file && (
                    <button
                      type="button"
                      onClick={() => { setFileError(''); openCertificate(topic.certificate_id).catch(() => setFileError('Unable to open that certificate.')); }}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      View certificate
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No topics yet.</p>}
      </section>
    </div>
  );
}

export default function AdminBeneficiaries() {
  const directory = useDirectory('/admin/beneficiaries', { sort: 'newest' });
  const { rows, pagination, extra, loading, error, params, setParam, clearAll } = directory;
  const [selected, setSelected] = useState(null);
  const [chat, setChat] = useState(null);
  const topics = extra.filters?.topics || [];
  const counts = extra.counts || {};
  const filtered = Object.keys(params).some((key) => !['sort', 'page', 'match'].includes(key));
  const moreActive = ['topicId', 'sex', 'sector'].filter((key) => params[key]).length;

  const columns = [
    { key: 'name', label: 'Beneficiary', render: (row) => <div className="flex items-center gap-2"><PersonCell name={row.full_name} detail={row.email} status={row.status} avatar={row.avatar_url} />{row.unread_messages > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{row.unread_messages}<span className="sr-only"> unread messages</span></span>}</div> },
    { key: 'place', label: 'Address', render: (row) => <span className="text-slate-700">{[row.barangay, row.city].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'demo', label: 'Sex · age', render: (row) => [SEX_LABELS[row.sex], row.age].filter(Boolean).join(' · ') || '—' },
    { key: 'topics_matched', label: 'Matched', align: 'right' },
    { key: 'topics_waiting', label: 'Waiting', align: 'right', render: (row) => <span className={row.topics_waiting ? 'font-semibold text-amber-700' : ''}>{row.topics_waiting}</span> },
    { key: 'topics_completed', label: 'Completed', align: 'right' },
    { key: 'last', label: 'Last login', render: (row) => <DateCell value={row.last_login_at} /> },
  ];

  return (
    <AppLayout>
      <AdminHeader
        title="Beneficiaries"
        tabs={(
          <HeaderTabs
            label="Matching"
            value={params.match}
            onChange={(value) => setParam('match', value)}
            tabs={[
              { value: '', label: 'All', count: counts.everyone },
              { value: 'waiting', label: 'Topic waiting', count: counts.waiting, alert: counts.waiting > 0 },
              { value: 'none', label: 'No topics yet', count: counts.none },
              { value: 'messages', label: 'Messages', count: counts.messages, alert: counts.unread > 0 },
            ]}
          />
        )}
      >
        <SearchBox value={params.q} onChange={(value) => setParam('q', value)} placeholder="Name, email, barangay or city…" label="Search beneficiaries" />
        <FilterSelect label="Status" value={params.status} onChange={(value) => setParam('status', value)} options={STATUS_FILTER} />
        <FilterSelect label="Sort" value={params.sort} onChange={(value) => setParam('sort', value)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'name', label: 'Name A–Z' }, { value: 'last_login', label: 'Recently active' }]} />
        <MoreFilters active={moreActive}>
          <FilterSelect label="Topic" value={params.topicId} onChange={(value) => setParam('topicId', value)} options={[{ value: '', label: 'Any topic' }, ...topics.map((topic) => ({ value: String(topic.id), label: topic.title }))]} />
          <FilterSelect label="Sex" value={params.sex} onChange={(value) => setParam('sex', value)} options={[{ value: '', label: 'Any' }, ...Object.entries(SEX_LABELS).map(([value, label]) => ({ value, label }))]} />
          <FilterSelect label="Sector" value={params.sector} onChange={(value) => setParam('sector', value)} options={[{ value: '', label: 'Any' }, ...Object.entries(SECTOR_LABELS).map(([value, label]) => ({ value, label }))]} />
        </MoreFilters>
        {filtered && <button type="button" onClick={() => clearAll(['match'])} className={clearButtonClass}>Clear filters</button>}
      </AdminHeader>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <DirectoryTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRowClick={(row) => setSelected(row)}
          selectedKey={selected?.id}
          emptyText={filtered ? 'No beneficiaries match these filters.' : params.match === 'messages' ? 'No beneficiary has replied yet. Write to one with Message in their View panel.' : 'No beneficiaries yet.'}
        />
        <Pagination pagination={pagination} onPage={(page) => setParam('page', String(page))} noun="beneficiaries" />
      </section>

      <DetailPanel open={Boolean(selected)} title={selected?.full_name || ''} onClose={() => setSelected(null)}>
        {selected && <BeneficiaryDetail id={selected.id} onChat={setChat} />}
      </DetailPanel>
      {chat && <DirectChatPanel conversation={chat} subtitle="Beneficiary" onClose={() => { setChat(null); directory.reload(); }} onChanged={() => window.dispatchEvent(new Event('admin-counts-changed'))} />}
    </AppLayout>
  );
}
