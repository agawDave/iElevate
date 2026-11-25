import { useEffect, useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import AdminPipelineAnalytics from '../../components/charts/AdminPipelineAnalytics';
import { Card, DashboardBanner, SideColumn, StatTiles } from '../../components/dashboard/DashboardParts';
import { ACTIVITY_GROUPS, ACTIVITY_GROUP_STYLES, ACTIVITY_LABELS } from '../../lib/activityLabels';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

// Admin overview: a navy banner, the program's numbers, how far beneficiaries
// got, the pre/post-test gains, the latest activity, and the program trends.

const TILES = [
  { key: 'beneficiaries', label: 'Beneficiaries', icon: 'users', style: 'bg-brand-50 text-brand-600', to: '/admin/beneficiaries' },
  { key: 'specialists', label: 'Specialists', icon: 'board', style: 'bg-accent-50 text-accent-600', to: '/admin/specialists' },
  { key: 'inProgress', label: 'Topics in progress', icon: 'progress', style: 'bg-brand-100 text-brand-700', to: '/admin/reports' },
  { key: 'certificates', label: 'Certificates issued', icon: 'award', style: 'bg-emerald-50 text-emerald-600', to: '/admin/reports' },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(value) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// How far beneficiaries got: one bar per step, as a share of everyone who signed up.
function Funnel({ steps }) {
  const top = steps[0]?.value || 0;
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const percent = top ? Math.round((step.value / top) * 100) : 0;
        return (
          <li key={step.key} title={`${step.label}: ${step.value} of ${top} (${percent}%)`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-slate-700">{step.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold text-slate-900">{step.value.toLocaleString()}</span>
                {index > 0 && <span className="ml-1.5 text-xs text-slate-500">{percent}%</span>}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${step.value ? Math.max(percent, 2) : 0}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Gains({ gains }) {
  if (!gains) return <EmptyState icon="chart" compact title="No test results yet">Shows once a learner takes both a topic&apos;s pre-test and post-test.</EmptyState>;
  const change = gains.post - gains.pre;
  return (
    <>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-xs text-slate-500">Pre-test</p>
          <p className="text-3xl font-extrabold tabular-nums text-slate-500">{gains.pre}%</p>
        </div>
        <span className="pb-1.5 text-xl text-slate-400" aria-hidden="true">→</span>
        <div>
          <p className="text-xs text-slate-500">Post-test</p>
          <p className="text-3xl font-extrabold tabular-nums text-brand-600">{gains.post}%</p>
        </div>
        <span className={`mb-1.5 ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {change >= 0 ? '+' : ''}{change} points
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Average score before and after learning, from {gains.topics} topic{gains.topics === 1 ? '' : 's'} finished by {gains.learners} learner{gains.learners === 1 ? '' : 's'}.
      </p>
    </>
  );
}

function ActivityRow({ item }) {
  return (
    <li className="flex gap-3 py-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTIVITY_GROUP_STYLES[ACTIVITY_GROUPS[item.action]] || 'bg-stone-400'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800"><span className="font-semibold">{item.who}</span> · {ACTIVITY_LABELS[item.action] || item.action}</p>
        <p className="truncate text-xs text-slate-500">{[item.topic, item.with && `with ${item.with}`, timeAgo(item.at)].filter(Boolean).join(' · ')}</p>
      </div>
    </li>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosClient.get('/admin/overview')
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load the overview.'));
  }, []);

  return (
    <AppLayout>
      <DashboardBanner
        title={`${greeting()}, ${user?.fullName?.split(' ')[0] || 'Admin'} 👋`}
        subtitle="Here's how the ELEVATE program is doing."
      />

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <DashboardSkeleton label="Loading the overview…" />}

      {data && (
        <>
          <StatTiles tiles={TILES} values={data.summary} />

          <div className="mb-8 grid gap-5 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-3">
              <Card title="Program progress" link={{ to: '/admin/reports', label: 'Reports' }}>
                <Funnel steps={data.funnel} />
                <p className="mt-4 text-xs text-slate-500">
                  Each beneficiary is counted once at every step they reached; % of everyone who signed up.
                  {data.summary.hoursCompleted > 0 && ` ${data.summary.hoursCompleted.toLocaleString()} training hours completed in all.`}
                </p>
              </Card>
            </div>

            <SideColumn className="lg:col-span-2">
              <Card plain title="Learning gains">
                <Gains gains={data.gains} />
              </Card>
              <Card plain title="Recent activity" link={{ to: '/admin/activity', label: 'Activity log' }}>
                {data.recent.length
                  ? <ul className="divide-y divide-stone-100">{data.recent.map((item) => <ActivityRow key={item.id} item={item} />)}</ul>
                  : <EmptyState icon="inbox" compact title="Nothing yet">Applications, answers and certificates show here as they happen.</EmptyState>}
              </Card>
            </SideColumn>
          </div>

          <AdminPipelineAnalytics showTiles={false} />
        </>
      )}
    </AppLayout>
  );
}
