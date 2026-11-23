import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Card, DashboardBanner, ProgressBar, SessionRow, SideColumn, StatTiles } from './DashboardParts';
import LineIcon from '../ui/LineIcon';
import { DashboardSkeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { TopicTile } from '../ui/TopicFace';

// The beneficiary's dashboard: a navy banner, their numbers, their topics with
// progress, upcoming sessions, and the latest replies from specialists.

const TILES = [
  { key: 'learning', label: 'Topics in progress', icon: 'progress', style: 'bg-brand-50 text-brand-600', to: '/modules?tab=ongoing' },
  { key: 'completed', label: 'Topics completed', icon: 'check', style: 'bg-emerald-50 text-emerald-600', to: '/modules?tab=completed' },
  { key: 'certificates', label: 'Certificates', icon: 'star', style: 'bg-accent-50 text-accent-600', to: '/portfolio' },
  { key: 'hoursCompleted', label: 'Training hours', icon: 'clock', style: 'bg-brand-100 text-brand-700', to: '/portfolio' },
];

const STAGES = {
  learning: { label: 'In progress', style: 'bg-brand-50 text-brand-600' },
  applied: { label: 'Waiting to be accepted', style: 'bg-amber-50 text-amber-800' },
  completed: { label: 'Completed', style: 'bg-emerald-50 text-emerald-700', check: true },
};
const STAGE_ORDER = { learning: 0, applied: 1, completed: 2 };

function TopicRow({ topic }) {
  const stage = STAGES[topic.stage];
  const { done, total } = topic.activities;
  const testLine = topic.test && (topic.test.pre
    ? `Pre-test ${topic.test.pre.score}/${topic.test.pre.total} → Post-test ${topic.test.post ? `${topic.test.post.score}/${topic.test.post.total}` : '—'}`
    : topic.test.preOpen ? 'Pre-test waiting' : null);
  const to = topic.stage === 'applied' ? '/modules?tab=incoming' : `/modules/${topic.moduleId}`;
  return (
    <li className="flex gap-3.5 py-3">
      <TopicTile slug={topic.slug} title={topic.title} phase={topic.phase} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={to} className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-600">{topic.title}</Link>
            <p className="text-xs text-slate-500">{[topic.phase, topic.specialist && `with ${topic.specialist}`].filter(Boolean).join(' · ')}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${stage.style}`}>{stage.check && <LineIcon name="check" strokeWidth={2.5} className="h-3 w-3" />}{stage.label}</span>
        </div>
        {topic.stage === 'learning' && (
          <div className="mt-2 flex items-center gap-3">
            {total > 0 ? (
              <>
                <ProgressBar done={done} total={total} label={`${topic.title} activities done`} />
                <span className="shrink-0 text-xs tabular-nums text-slate-600">{done} of {total} activities</span>
              </>
            ) : <span className="flex-1 text-xs text-slate-500">No activities yet</span>}
            <Link to={to} className="shrink-0 rounded-lg bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">Open</Link>
          </div>
        )}
        {testLine && <p className="mt-1 text-xs text-slate-500">{testLine}</p>}
      </div>
    </li>
  );
}

function FeedbackRow({ item }) {
  return (
    <li className="py-2.5">
      <Link to={`/modules/${item.moduleId}`} className="group block">
        <p className="line-clamp-2 text-sm italic text-slate-800 group-hover:text-brand-700">&ldquo;{item.feedback || 'Seen ✓'}&rdquo;</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{item.specialist} · {item.topic}</span>
          {item.rubricTotal !== null && <span className="rounded-full bg-accent-50 px-2 py-0.5 font-semibold text-accent-600">Rubric {item.rubricTotal}/12</span>}
        </p>
      </Link>
    </li>
  );
}

export default function LearnerDashboard({ greeting, firstName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosClient.get('/elevate/dashboard/me')
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load your dashboard.'));
  }, []);

  const topics = data ? [...data.topics].sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]).slice(0, 6) : [];

  return (
    <div>
      <DashboardBanner title={`${greeting}, ${firstName} 👋`} subtitle="Here's what's happening with your learning journey." />

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <DashboardSkeleton />}

      {data && (
        <>
          <StatTiles tiles={TILES} values={data.summary} />

          <div className="grid gap-5 lg:grid-cols-5 lg:items-start">
            <Card title="My topics" link={{ to: '/modules', label: 'See all' }} className="lg:col-span-3">
              {topics.length ? (
                <ul className="divide-y divide-stone-100">{topics.map((topic) => <TopicRow key={topic.moduleId} topic={topic} />)}</ul>
              ) : (
                <EmptyState icon="brand" primary title="Start your first topic" action={{ to: '/modules', label: 'Apply to a topic' }}>
                  Choose a topic from your pre-assessment and apply to a specialist. They guide you until your certificate.
                </EmptyState>
              )}
            </Card>

            <SideColumn className="lg:col-span-2">
              <Card plain title="Upcoming sessions" link={{ to: '/sessions', label: 'View all' }}>
                {data.sessions.length
                  ? <ul className="divide-y divide-stone-100">{data.sessions.map((session) => <SessionRow key={session.id} session={session} person={session.specialist} />)}</ul>
                  : data.summary.onlineOnly
                    ? <EmptyState icon="calendar" compact title="You learn online" action={{ to: '/sessions', label: 'See your online sessions' }}>You live outside the Philippines, so each day you work on a topic counts as an online session.</EmptyState>
                    : data.summary.learning > 0
                    ? <EmptyState icon="calendar" compact title="No sessions yet" action={{ to: '/sessions', label: 'Book a session' }}>Meet your specialist face to face, or join an open session on a topic you need.</EmptyState>
                    : <EmptyState icon="calendar" compact title="No sessions yet">Once a specialist accepts you, you can book sessions with them.</EmptyState>}
              </Card>
              <Card plain title="Latest feedback">
                {data.feedback.length
                  ? <ul className="divide-y divide-stone-100">{data.feedback.map((item) => <FeedbackRow key={item.answerId} item={item} />)}</ul>
                  : <EmptyState icon="chat" compact title="No feedback yet">Your specialist&apos;s replies to your answers will show here.</EmptyState>}
              </Card>
            </SideColumn>
          </div>
        </>
      )}
    </div>
  );
}
