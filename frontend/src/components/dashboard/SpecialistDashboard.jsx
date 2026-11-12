import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import SpecialistLearnerAnalytics from '../charts/SpecialistLearnerAnalytics';
import { Card, DashboardBanner, ProgressBar, SessionRow, SideColumn, StatTiles, smallButton } from './DashboardParts';
import { DashboardSkeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { TopicTile } from '../ui/TopicFace';
import { avatarTint, initials } from '../../lib/people';
import { MODULE_STATUS, moduleEditorPath } from '../../lib/moduleStatus';

// The specialist's dashboard: a navy banner, their numbers, their learners'
// progress, upcoming sessions, their topics, and the learner trends at the bottom.

const TILES = [
  { key: 'learners', label: 'Learners now', icon: 'users', style: 'bg-brand-50 text-brand-600', to: '/modules?tab=ongoing' },
  { key: 'applications', label: 'Applications waiting', icon: 'inbox', style: 'bg-accent-50 text-accent-600', to: '/modules?tab=incoming', alert: true },
  { key: 'answersToRead', label: 'Answers to read', icon: 'doc', style: 'bg-amber-50 text-amber-700', to: '/modules?tab=ongoing', alert: true },
  { key: 'certificates', label: 'Certificates issued', icon: 'award', style: 'bg-emerald-50 text-emerald-600', to: '/modules?tab=completed' },
];


function LearnerRow({ learner }) {
  const { done, total } = learner.activities;
  const chat = `/modules?tab=ongoing&chat=${learner.conversationId}`;
  const badges = [
    learner.awaitingReply && { label: 'Waiting for your reply', style: 'bg-amber-50 text-amber-800' },
    learner.toRead > 0 && { label: `${learner.toRead} to read`, style: 'bg-amber-50 text-amber-800' },
    learner.readyToComplete && { label: 'Ready to complete', style: 'bg-emerald-50 text-emerald-700' },
  ].filter(Boolean);
  const testLine = learner.test && `Pre-test ${learner.test.pre ? `${learner.test.pre.score}/${learner.test.pre.total}` : '—'} → Post-test ${learner.test.post ? `${learner.test.post.score}/${learner.test.post.total}` : '—'}`;
  return (
    <li className="flex gap-3 py-3">
      {learner.avatar
        ? <img src={learner.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        : <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTint(learner.name)}`} aria-hidden="true">{initials(learner.name)}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={chat} className="text-sm font-semibold text-slate-900 hover:text-brand-600">{learner.name}</Link>
          {badges.map((badge) => <span key={badge.label} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${badge.style}`}>{badge.label}</span>)}
        </div>
        <p className="truncate text-xs text-slate-500">{learner.topic}{testLine ? ` · ${testLine}` : ''}</p>
        <div className="mt-2 flex items-center gap-3">
          {total > 0 ? (
            <>
              <ProgressBar done={done} total={total} label={`${learner.name}: ${learner.topic} activities done`} />
              <span className="shrink-0 text-xs tabular-nums text-slate-600">{done} of {total} activities</span>
            </>
          ) : <span className="flex-1 text-xs text-slate-500">No activities yet</span>}
          {(total > 0 || learner.test) && (
            <Link to={`/modules?tab=ongoing&answers=${learner.moduleId}:${learner.beneficiaryId}`} className={smallButton}>Answers</Link>
          )}
          <Link to={chat} className={smallButton}>Chat{learner.unread ? ` (${learner.unread})` : ''}</Link>
        </div>
      </div>
    </li>
  );
}

const MODULE_ACTIONS = { none: 'Create module', draft: 'Continue', changes_requested: 'Edit module' };

function TopicRow({ topic }) {
  const status = topic.moduleStatus || 'none';
  const statusInfo = MODULE_STATUS[status] || MODULE_STATUS.none;
  const counts = [
    `${topic.learners} learner${topic.learners === 1 ? '' : 's'}`,
    topic.applications ? `${topic.applications} applied` : null,
  ].filter(Boolean).join(' · ');
  return (
    <li className="flex gap-3 py-2.5">
      <TopicTile slug={topic.slug} title={topic.title} phase={topic.phase} size="sm" />
      <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{topic.moduleTitle || topic.title}</p>
          <p className="text-xs text-slate-500">{topic.moduleTitle && topic.moduleTitle !== topic.title ? `${topic.title} · ` : `${topic.phase} · `}{counts}</p>
        </div>
        {MODULE_ACTIONS[status]
          ? <Link to={moduleEditorPath(topic.moduleId)} className="shrink-0 rounded-lg bg-accent-500 px-3 py-1 text-xs font-bold text-brand-900 hover:bg-accent-550">{MODULE_ACTIONS[status]}</Link>
          : <Link to={`/modules?activities=${topic.moduleId}`} className={smallButton}>Activities</Link>}
      </div>
      <p className="mt-1 flex flex-wrap gap-2 text-[12px] font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${statusInfo.style}`}>{statusInfo.label}</span>
        {topic.activities
          ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-slate-600">{topic.activities} activit{topic.activities === 1 ? 'y' : 'ies'}</span>
          : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">No activities yet</span>}
        {topic.testQuestions
          ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-slate-600">Pre/post-test: {topic.testQuestions} question{topic.testQuestions === 1 ? '' : 's'}</span>
          : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">No pre/post-test yet</span>}
      </p>
      </div>
    </li>
  );
}

export default function SpecialistDashboard({ greeting, firstName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosClient.get('/elevate/dashboard/me')
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load your dashboard.'));
  }, []);

  return (
    <div>
      <DashboardBanner
        title={`${greeting}, ${firstName} 👋`}
        subtitle="Here's how your learners are doing."
      />

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <DashboardSkeleton />}

      {data && (
        <>
          <StatTiles tiles={TILES} values={data.summary} />

          <div className="mb-7 grid gap-5 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-3">
              <Card title="My learners" link={{ to: '/modules?tab=ongoing', label: 'See all' }}>
                {data.learners.length
                  ? <ul className="divide-y divide-stone-100">{data.learners.map((learner) => <LearnerRow key={learner.conversationId} learner={learner} />)}</ul>
                  : data.summary.applications > 0
                    ? <EmptyState icon="inbox" primary title={`${data.summary.applications} waiting for you to accept`} action={{ to: '/modules?tab=incoming', label: 'See applications' }}>Accept them to start teaching. They show here once you do.</EmptyState>
                    : <EmptyState icon="users" title="No learners yet">Beneficiaries who apply to your topics show under Incoming for you to accept.</EmptyState>}
              </Card>
            </div>

            <SideColumn className="lg:col-span-2">
              <Card plain title="Upcoming sessions" link={{ to: '/sessions', label: 'View all' }}>
                {data.sessions.length
                  ? <ul className="divide-y divide-stone-100">{data.sessions.map((session) => <SessionRow key={session.id} session={session} person={session.person} />)}</ul>
                  : <EmptyState icon="calendar" compact title="No sessions coming up" action={data.learners.length ? { to: '/sessions', label: 'Book a session' } : undefined}>
                    {data.learners.length ? 'Meet a learner online or face to face.' : 'Once you accept learners, you can book sessions with them.'}
                  </EmptyState>}
                {data.summary.sessionsHeld > 0 && <p className="mt-2 text-xs text-slate-500">{data.summary.sessionsHeld} session{data.summary.sessionsHeld === 1 ? '' : 's'} held so far</p>}
              </Card>
              <Card plain title="Your topics" link={{ to: '/modules', label: 'See all' }}>
                {data.topics.length
                  ? <ul className="divide-y divide-stone-100">{data.topics.map((topic) => <TopicRow key={topic.moduleId} topic={topic} />)}</ul>
                  : <EmptyState icon="book" compact title="No topics yet" action={{ to: '/learning-plan', label: 'Choose your topics' }}>Pick the topics you teach in your teaching plan.</EmptyState>}
              </Card>
            </SideColumn>
          </div>

          <SpecialistLearnerAnalytics showTiles={false} />
        </>
      )}
    </div>
  );
}
