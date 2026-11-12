import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageHeader, { HeaderStat, headerButtonClass } from '../components/layout/PageHeader';
import axiosClient from '../api/axiosClient';
import { DURATIONS, SESSION_STATUS, formatSessionRange, isLink, toLocalInputValue } from '../lib/sessions';
import { SkeletonBlock, SkeletonLines } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

// What this viewer can do with a session. Topic sessions follow the server's
// rules; older skill-exchange sessions keep theirs.
function sessionPermissions(session) {
  const isModule = Boolean(session.moduleSessionId);
  return {
    isModule,
    expired: session.status === 'pending' && new Date(session.endsAt) < new Date(),
    canConfirm: isModule ? session.canConfirm : session.status === 'pending' && !session.scheduledByMe,
    canCancel: isModule ? session.canCancel : ['pending', 'confirmed'].includes(session.status),
    canComplete: isModule && session.canComplete,
  };
}

// "Today", "Tomorrow", or "Wed, Nov 12".
function dayLabel(value) {
  const day = new Date(value);
  const today = new Date();
  const startOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startOf(day) - startOf(today)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// One session as an agenda row: date block, who and what, when and where, status, actions.
function SessionRow({ session, onUpdateStatus, quiet = false }) {
  const { isModule, expired, canConfirm, canCancel, canComplete } = sessionPermissions(session);
  const status = expired
    ? { label: 'Not answered in time', style: 'bg-stone-100 text-slate-500 border-stone-200' }
    : session.status === 'pending' && canConfirm
      ? { label: 'Needs your answer', style: 'bg-amber-100 text-amber-900 border-amber-300' }
      : SESSION_STATUS[session.status] || SESSION_STATUS.pending;
  const starts = new Date(session.startsAt);
  const button = 'rounded-lg px-3 py-1.5 text-sm font-medium';

  return (
    <li className={`flex flex-wrap items-start gap-4 rounded-2xl border bg-white p-4 ${quiet ? 'border-stone-200 opacity-80' : 'border-stone-200 shadow-sm'}`}>
      <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${quiet ? 'bg-stone-100 text-slate-600' : 'bg-brand-600 text-white'}`}>
        <span className="text-xl font-extrabold leading-none">{starts.getDate()}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{starts.toLocaleDateString([], { month: 'short' })}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {isModule ? session.moduleTitle : `You teach ${session.iTeach} · They teach ${session.theyTeach}`}
            </p>
            <p className="text-sm text-slate-500">
              {isModule ? `${session.isSpecialist ? 'Teaching' : 'with'} ${session.otherUserName || `User #${session.otherUserId}`}` : session.otherUserName}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.style}`}>{status.label}</span>
        </div>
        <p className="mt-1.5 text-sm text-slate-700">{formatSessionRange(session.startsAt, session.endsAt)}</p>
        {session.meetingLink && (
          isLink(session.meetingLink)
            ? <a href={session.meetingLink} target="_blank" rel="noreferrer" className="mt-0.5 inline-block max-w-full truncate text-sm text-brand-600 hover:underline">{session.meetingLink}</a>
            : <p className="mt-0.5 text-sm text-slate-600">Where: {session.meetingLink}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!expired && canConfirm && (
            <button type="button" onClick={() => onUpdateStatus(session, 'confirmed')} className={`${button} bg-accent-500 font-semibold text-brand-900 hover:bg-accent-550`}>Accept</button>
          )}
          {!expired && canComplete && (
            <>
              <button type="button" onClick={() => onUpdateStatus(session, 'completed')} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>Mark as done</button>
              <button type="button" onClick={() => onUpdateStatus(session, 'no_show')} className={`${button} text-slate-500 hover:text-red-600`}>Didn&apos;t happen</button>
            </>
          )}
          {!expired && canCancel && !canComplete && (
            <button type="button" onClick={() => onUpdateStatus(session, 'cancelled')} className={`${button} text-slate-500 hover:text-red-600`}>
              {canConfirm ? 'Decline' : 'Cancel'}
            </button>
          )}
          {!expired && session.status === 'pending' && session.scheduledByMe && <span className="text-sm text-slate-500">Waiting for them to accept…</span>}
          {isModule && session.conversationId && (
            <Link to={`/modules?c=${session.conversationId}`} className="ml-auto text-sm font-medium text-brand-600 hover:underline">Open chat →</Link>
          )}
        </div>
      </div>
    </li>
  );
}

// "Book a session" from a module chat: /sessions?moduleId=..[&learner=..]
function BookingForm({ moduleId, learnerId, onBooked, onCancel }) {
  const [details, setDetails] = useState(null);
  const [start, setStart] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [place, setPlace] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      axiosClient.get('/modules', { params: { moduleId, limit: 1 } }),
      axiosClient.get('/messages/inbox', { params: { moduleId } }),
    ]).then(([modules, inbox]) => {
      const module = modules.data.data[0];
      const conversation = inbox.data.data.conversations.find((item) => !learnerId || String(item.beneficiaryId) === String(learnerId));
      setDetails({ title: module?.title || 'this topic', withName: conversation?.otherUserName || module?.specialistName || 'your partner' });
    }).catch(() => setDetails({ title: 'this topic', withName: 'your partner' }));
  }, [moduleId, learnerId]);

  async function submit(event) {
    event.preventDefault();
    const startsAt = new Date(start);
    if (!start || Number.isNaN(startsAt.getTime())) {
      setError('Choose a date and time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await axiosClient.post(`/sessions/modules/${moduleId}`, {
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + minutes * 60000).toISOString(),
        meetingLink: place.trim(),
        beneficiaryId: learnerId || undefined,
      });
      onBooked(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to book this session.');
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border-2 border-brand-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">Book a session</p>
      <h2 className="mt-1 text-lg font-semibold">{details ? `${details.title} with ${details.withName}` : <SkeletonBlock className="h-5 w-56" />}</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">They get a notice and accept it on their Sessions page.</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Date and time
          <input required type="datetime-local" min={toLocalInputValue(new Date())} value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm text-slate-600">
          Length
          <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm">
            {DURATIONS.map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-64 flex-1 text-sm text-slate-600">
          Where (optional)
          <input value={place} maxLength={255} onChange={(event) => setPlace(event.target.value)} placeholder="Google Meet link, or a place like the barangay hall" className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={saving} className="rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-bold text-brand-900 hover:bg-accent-550 disabled:opacity-50">
          {saving ? 'Sending…' : 'Request session'}
        </button>
        <button type="button" onClick={onCancel} className="px-2 py-2.5 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

export default function Sessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPast, setShowPast] = useState(false);
  const bookFor = searchParams.get('moduleId');

  function loadSessions() {
    Promise.all([axiosClient.get('/sessions/me'), axiosClient.get('/sessions/modules/me')])
      .then(([regular, module]) => setSessions([...regular.data.data, ...module.data.data]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSessions(); }, []);

  async function handleUpdateStatus(session, status) {
    setError('');
    setNotice('');
    try {
      const endpoint = session.moduleSessionId
        ? `/sessions/modules/${session.moduleSessionId}/status`
        : `/sessions/${session.id}/status`;
      const response = await axiosClient.patch(endpoint, { status });
      setNotice(response.data.message || '');
      loadSessions();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this session.');
    }
  }

  const now = new Date();
  const byStart = (a, b) => new Date(a.startsAt) - new Date(b.startsAt);
  const upcoming = sessions.filter((s) => new Date(s.endsAt) >= now && !['cancelled', 'completed', 'no_show'].includes(s.status)).sort(byStart);
  const past = sessions.filter((s) => !upcoming.includes(s)).sort((a, b) => byStart(b, a));
  // Requests waiting for this person's answer go first, in their own strip.
  const needsAnswer = upcoming.filter((s) => { const p = sessionPermissions(s); return p.canConfirm && !p.expired; });
  const scheduled = upcoming.filter((s) => !needsAnswer.includes(s));
  const days = [];
  scheduled.forEach((session) => {
    const label = dayLabel(session.startsAt);
    const group = days.find((entry) => entry.label === label) || days[days.push({ label, sessions: [] }) - 1];
    group.sessions.push(session);
  });
  const held = past.filter((s) => s.status === 'completed').length;

  return (
    <AppLayout>
      <PageHeader
        title="Sessions"
        subtitle="Every learning session across your topics. To book one, open the topic's chat in Modules and press Book a session."
        actions={<Link to="/modules" className={headerButtonClass}>Go to Modules</Link>}
      >
        {!loading && (
          <div className="flex flex-wrap gap-2">
            <HeaderStat value={upcoming.length} label="Upcoming" />
            <HeaderStat value={needsAnswer.length} label="Need your answer" alert={needsAnswer.length > 0} />
            <HeaderStat value={held} label="Held" />
          </div>
        )}
      </PageHeader>
      {bookFor && (
        <BookingForm
          moduleId={bookFor}
          learnerId={searchParams.get('learner')}
          onBooked={(message) => { setNotice(message); setSearchParams({}); loadSessions(); }}
          onCancel={() => setSearchParams({})}
        />
      )}
      {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <SkeletonLines lines={5} label="Loading sessions…" className="rounded-2xl border border-stone-200 bg-white p-6" />}

      {!loading && (
        <>
          {needsAnswer.length > 0 && (
            <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
                <span className="h-2.5 w-2.5 rounded-full bg-accent-500" aria-hidden="true" />
                Needs your answer
              </h2>
              <ul className="space-y-3">
                {needsAnswer.map((s) => <SessionRow key={`${s.moduleSessionId ? 'm' : 's'}${s.moduleSessionId || s.id}`} session={s} onUpdateStatus={handleUpdateStatus} />)}
              </ul>
            </section>
          )}

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Upcoming</h2>
          {!scheduled.length && (
            <div className="mb-8 rounded-2xl border border-stone-200 bg-white">
              {needsAnswer.length
                ? <EmptyState icon="calendar" compact title="Nothing else scheduled yet" />
                : <EmptyState icon="calendar" title="No upcoming sessions yet" action={{ to: '/modules', label: 'Go to your topics' }}>Book one from a topic&apos;s chat, online or face to face.</EmptyState>}
            </div>
          )}
          {days.map((day) => (
            <section key={day.label} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-brand-600">{day.label}</h3>
              <ul className="space-y-3">
                {day.sessions.map((s) => <SessionRow key={`${s.moduleSessionId ? 'm' : 's'}${s.moduleSessionId || s.id}`} session={s} onUpdateStatus={handleUpdateStatus} />)}
              </ul>
            </section>
          ))}

          <section className="mt-8">
            <button
              type="button"
              onClick={() => setShowPast(!showPast)}
              aria-expanded={showPast}
              className="text-sm font-semibold uppercase tracking-wider text-slate-500 hover:text-brand-600"
            >
              {showPast ? '▾' : '▸'} Past sessions ({past.length})
            </button>
            {showPast && (
              past.length
                ? <ul className="mt-3 space-y-3">{past.map((s) => <SessionRow key={`${s.moduleSessionId ? 'm' : 's'}${s.moduleSessionId || s.id}`} session={s} onUpdateStatus={handleUpdateStatus} quiet />)}</ul>
                : <p className="mt-3 text-sm text-slate-500">No past sessions yet.</p>
            )}
          </section>
        </>
      )}
    </AppLayout>
  );
}
