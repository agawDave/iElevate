import { useEffect, useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import axiosClient from '../../api/axiosClient';
import { WeeklyTrendChart } from '../../components/charts/PipelineCharts';
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

const PROGRESS = { incoming: 'Incoming', ongoing: 'Ongoing', completed: 'Completed' };
const PROGRESS_STYLES = { incoming: 'text-accent-600', ongoing: 'text-brand-600', completed: 'text-emerald-700' };
const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' };

function SpecialistDetail({ id, onChat }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [learnerFilter, setLearnerFilter] = useState('');
  useEffect(() => {
    setData(null);
    axiosClient.get(`/admin/specialists/${id}`)
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load this specialist.'));
  }, [id]);
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!data) return <SkeletonLines lines={8} label="Loading this specialist…" />;
  const learners = data.learners.filter((learner) => !learnerFilter
    || `${learner.name} ${learner.topic}`.toLowerCase().includes(learnerFilter.toLowerCase()));
  return (
    <div className="space-y-6">
      <ProfileHeader name={data.full_name} email={data.email} src={data.avatar_url} status={data.status} />
      <div className="flex flex-wrap items-center gap-2"><MessageButton userId={id} onOpen={onChat} /></div>
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-600">Profile</h3>
        <dl>
          <DetailRow label="Status"><StatusBadge status={data.status} /></DetailRow>
          <DetailRow label="Organization">{data.school_or_org}</DetailRow>
          <DetailRow label="Mobile">{data.mobile_number}</DetailRow>
          <DetailRow label="Face-to-face area">{[data.barangay && `Brgy. ${data.barangay}`, data.city, data.province].filter(Boolean).join(', ')}</DetailRow>
          <DetailRow label="Teaches by">{data.learning_modes.join(', ').replace(/_/g, '-')}</DetailRow>
          <DetailRow label="Joined">{formatDate(data.created_at)}</DetailRow>
          <DetailRow label="Last login">{formatDate(data.last_login_at)}</DetailRow>
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-600">Learners</h3>
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          {Object.entries(PROGRESS).map(([key, label]) => (
            <div key={key} className="rounded-lg border border-stone-200 p-2">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-extrabold text-brand-600">{data.summary[key]}</p>
            </div>
          ))}
        </div>
        <h4 className="mb-1 text-sm font-semibold">Weekly trend</h4>
        <div className="mb-4 rounded-lg border border-stone-200 p-3">
          <WeeklyTrendChart trend={data.trend} />
        </div>
        <h4 className="mb-1 text-sm font-semibold">Topics</h4>
        <ul className="mb-4 divide-y divide-stone-100 rounded-lg border border-stone-200">
          {data.topics.map((topic) => (
            <li key={topic.module_id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block font-medium">{topic.title}</span>
                <span className="block text-xs text-slate-500">
                  {[LEVEL_LABELS[topic.proficiency], topic.max_learners ? `limit ${topic.max_learners}` : null].filter(Boolean).join(' · ') || 'No teaching details yet'}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-slate-600">{topic.incoming} / {topic.ongoing} / {topic.completed}</span>
            </li>
          ))}
          {!data.topics.length && <li className="px-3 py-2 text-sm text-slate-500">No topics registered yet.</li>}
        </ul>
        {data.learners.length > 0 && (
          <>
            <input
              type="search"
              value={learnerFilter}
              onChange={(event) => setLearnerFilter(event.target.value)}
              placeholder="Find a learner or topic…"
              aria-label="Find a learner"
              className="mb-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
              {learners.map((learner) => (
                <li key={`${learner.name}-${learner.topic}`} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{learner.name}</span><span className="block truncate text-xs text-slate-500">{learner.topic}</span></span>
                  <span className={`shrink-0 text-xs font-semibold ${PROGRESS_STYLES[learner.status]}`}>{PROGRESS[learner.status]}</span>
                </li>
              ))}
              {!learners.length && <li className="px-3 py-2 text-sm text-slate-500">No learners match.</li>}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

export default function AdminSpecialists() {
  const { rows, pagination, extra, loading, error, params, setParam, setParams, clearAll, reload } = useDirectory('/admin/specialists', { sort: 'name' });
  const [selected, setSelected] = useState(null);
  const [chat, setChat] = useState(null);
  const topics = extra.filters?.topics || [];
  const counts = extra.counts || {};
  const filtered = Object.keys(params).some((key) => !['sort', 'page', 'topics'].includes(key));

  const columns = [
    { key: 'name', label: 'Specialist', render: (row) => <div className="flex items-center gap-2"><PersonCell name={row.full_name} detail={row.email} status={row.status} avatar={row.avatar_url} />{row.unread_messages > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{row.unread_messages}<span className="sr-only"> unread messages</span></span>}</div> },
    { key: 'topics', label: 'Topics taught', render: (row) => <span className="line-clamp-2 max-w-xs text-slate-700">{row.topics_taught || <span className="text-slate-400">None yet</span>}</span> },
    { key: 'incoming', label: 'Incoming', align: 'right' },
    { key: 'ongoing', label: 'Ongoing', align: 'right' },
    { key: 'completed', label: 'Completed', align: 'right' },
    { key: 'last', label: 'Last login', render: (row) => <DateCell value={row.last_login_at} /> },
  ];

  return (
    <AppLayout>
      <AdminHeader
        title="Specialists"
        tabs={(
          <HeaderTabs
            label="Topics"
            value={params.topics === 'none' ? 'none' : ''}
            onChange={(value) => setParams({ topics: value, topicId: '' })}
            tabs={[
              { value: '', label: 'All', count: counts.everyone },
              { value: 'none', label: 'No topics yet', count: counts.none, alert: counts.none > 0 },
              { value: 'messages', label: 'Messages', count: counts.messages, alert: counts.unread > 0 },
            ]}
          />
        )}
      >
        <SearchBox value={params.q} onChange={(value) => setParam('q', value)} placeholder="Name, email, city or topic…" label="Search specialists" />
        {params.topics !== 'none' && (
          <FilterSelect
            label="Teaches"
            value={params.topicId}
            onChange={(value) => setParam('topicId', value)}
            options={[{ value: '', label: 'Any topic' }, ...topics.map((topic) => ({ value: String(topic.id), label: topic.title }))]}
          />
        )}
        <FilterSelect label="Sort" value={params.sort} onChange={(value) => setParam('sort', value)} options={[{ value: 'name', label: 'Name A–Z' }, { value: 'learners', label: 'Most learners' }, { value: 'newest', label: 'Newest first' }]} />
        <MoreFilters active={params.status ? 1 : 0}>
          <FilterSelect label="Status" value={params.status} onChange={(value) => setParam('status', value)} options={STATUS_FILTER} />
        </MoreFilters>
        {filtered && <button type="button" onClick={() => clearAll(['topics'])} className={clearButtonClass}>Clear filters</button>}
      </AdminHeader>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <DirectoryTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRowClick={(row) => setSelected(row)}
          selectedKey={selected?.id}
          emptyText={filtered ? 'No specialists match these filters.' : params.topics === 'messages' ? 'No specialist has replied yet. Write to one with Message in their View panel.' : 'No specialists yet.'}
        />
        <Pagination pagination={pagination} onPage={(page) => setParam('page', String(page))} noun="specialists" />
      </section>

      <DetailPanel open={Boolean(selected)} title={selected?.full_name || ''} onClose={() => setSelected(null)}>
        {selected && <SpecialistDetail id={selected.id} onChat={setChat} />}
      </DetailPanel>
      {chat && <DirectChatPanel conversation={chat} subtitle="Specialist" onClose={() => { setChat(null); reload(); }} onChanged={() => window.dispatchEvent(new Event('admin-counts-changed'))} />}
    </AppLayout>
  );
}
