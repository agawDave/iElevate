import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageHeader, { HeaderStat, headerButtonClass, headerPrimaryClass } from '../components/layout/PageHeader';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { DURATIONS, SESSION_STATUS, formatSessionRange, isLink, toLocalInputValue } from '../lib/sessions';
import { describeFreeTimes, freeStartTimes } from '../lib/circumstances';
import { SkeletonBlock, SkeletonLines } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

// Two kinds of sessions:
//   - face-to-face, booked here: one-on-one (one asks, the other accepts), or
//     open (a specialist posts it, beneficiaries who need the topic join);
//   - online, added automatically each time a beneficiary takes a pre-test or
//     post-test (past rows may also be an activity answer).

// What this viewer can do with a session (the server decides).
function sessionPermissions(session) {
  return {
    expired: session.status === 'pending' && new Date(session.endsAt) < new Date(),
    canConfirm: Boolean(session.canConfirm),
    canCancel: Boolean(session.canCancel),
    canComplete: Boolean(session.canComplete),
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

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const timeOf = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const button = 'rounded-lg px-3 py-1.5 text-sm font-medium';
const inputClass = 'mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm';
const joinedText = (session) => `${session.joinedCount}${session.seats ? ` of ${session.seats}` : ''} joined`;

function DateBlock({ value, quiet = false }) {
  const date = new Date(value);
  return (
    <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${quiet ? 'bg-stone-100 text-slate-600' : 'bg-brand-600 text-white'}`}>
      <span className="text-xl font-extrabold leading-none">{date.getDate()}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide">{date.toLocaleDateString([], { month: 'short' })}</span>
    </span>
  );
}

function PlaceLine({ place }) {
  if (!place) return null;
  return isLink(place)
    ? <a href={place} target="_blank" rel="noreferrer" className="mt-0.5 inline-block max-w-full truncate text-sm text-brand-600 hover:underline">{place}</a>
    : <p className="mt-0.5 text-sm text-slate-600">Where: {place}</p>;
}

// The specialist's view of who joined an open session; once it has started,
// they tick who came and mark it as done.
function AttendeeList({ session, onUpdateStatus }) {
  const attendees = session.attendees || [];
  const [came, setCame] = useState(() => new Set(attendees.filter((person) => person.attended !== false).map((person) => person.id)));
  const toggle = (id) => setCame((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (session.canComplete) {
    return (
      <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <p className="text-sm font-medium text-slate-800">{attendees.length ? 'Who came? Untick anyone who didn’t.' : 'No one joined this session.'}</p>
        {attendees.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
            {attendees.map((person) => (
              <li key={person.id}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={came.has(person.id)} onChange={() => toggle(person.id)} className="h-4 w-4 rounded border-stone-300 text-brand-600" />
                  {person.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onUpdateStatus(session, 'completed', { attended: [...came] })} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>Mark as done</button>
          <button type="button" onClick={() => onUpdateStatus(session, 'no_show')} className={`${button} text-slate-500 hover:text-red-600`}>Didn&apos;t happen</button>
        </div>
      </div>
    );
  }
  if (session.status === 'completed') {
    const present = attendees.filter((person) => person.attended);
    return <p className="mt-1.5 text-sm text-slate-600">Came: {present.length ? present.map((person) => person.name).join(', ') : 'no one'} ({present.length} of {attendees.length})</p>;
  }
  return (
    <p className="mt-1.5 text-sm text-slate-600">
      {attendees.length ? `Joined: ${attendees.map((person) => person.name).join(', ')}` : 'No one has joined yet.'}
    </p>
  );
}

// One face-to-face session as an agenda row: date block, who and what, when and where, status, actions.
function SessionRow({ session, onUpdateStatus, onLeave, quiet = false }) {
  const { expired, canConfirm, canCancel, canComplete } = sessionPermissions(session);
  const status = session.isOpen && session.status === 'confirmed'
    ? { label: `Open · ${joinedText(session)}`, style: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    : expired
      ? { label: 'Not answered in time', style: 'bg-stone-100 text-slate-500 border-stone-200' }
      : session.status === 'pending' && canConfirm
        ? { label: 'Needs your answer', style: 'bg-amber-100 text-amber-900 border-amber-300' }
        : SESSION_STATUS[session.status] || SESSION_STATUS.pending;
  const who = session.isOpen
    ? (session.isSpecialist ? 'Open to beneficiaries who need this topic' : `with ${session.otherUserName} · open session`)
    : `${session.isSpecialist ? 'Teaching' : 'with'} ${session.otherUserName || `User #${session.otherUserId}`}`;

  return (
    <li className={`flex flex-wrap items-start gap-4 rounded-2xl border bg-white p-4 ${quiet ? 'border-stone-200 opacity-80' : 'border-stone-200 shadow-sm'}`}>
      <DateBlock value={session.startsAt} quiet={quiet} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{session.moduleTitle}</p>
            <p className="text-sm text-slate-500">{who}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.style}`}>{status.label}</span>
        </div>
        <p className="mt-1.5 text-sm text-slate-700">{formatSessionRange(session.startsAt, session.endsAt)}</p>
        <PlaceLine place={session.meetingLink} />

        {session.isOpen && session.isSpecialist && <AttendeeList key={`${session.moduleSessionId}-${session.status}`} session={session} onUpdateStatus={onUpdateStatus} />}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!session.isOpen && !expired && canConfirm && (
            <button type="button" onClick={() => onUpdateStatus(session, 'confirmed')} className={`${button} bg-accent-500 font-semibold text-brand-900 hover:bg-accent-550`}>Accept</button>
          )}
          {!session.isOpen && !expired && canComplete && (
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
          {session.isOpen && session.joinedByMe && session.status === 'confirmed' && <span className="text-sm font-medium text-emerald-700">You joined</span>}
          {session.canLeave && (
            <button type="button" onClick={() => onLeave(session)} className={`${button} text-slate-500 hover:text-red-600`}>Leave</button>
          )}
          {!session.isOpen && !expired && session.status === 'pending' && session.scheduledByMe && <span className="text-sm text-slate-500">Waiting for them to accept…</span>}
          {session.conversationId && (
            <Link to={`/modules?c=${session.conversationId}`} className="ml-auto text-sm font-medium text-brand-600 hover:underline">Open chat →</Link>
          )}
        </div>
      </div>
    </li>
  );
}

// An open face-to-face session a beneficiary can join.
function OpenSessionRow({ session, onJoin, joining }) {
  return (
    <li className="flex flex-wrap items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <DateBlock value={session.startsAt} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{session.moduleTitle}</p>
            <p className="text-sm text-slate-500">with {session.specialistName}</p>
          </div>
          <button
            type="button"
            disabled={session.full || joining}
            onClick={() => onJoin(session)}
            className="shrink-0 rounded-lg bg-accent-500 px-4 py-1.5 text-sm font-bold text-brand-900 hover:bg-accent-550 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {session.full ? 'Full' : joining ? 'Joining…' : 'Join'}
          </button>
        </div>
        <p className="mt-1.5 text-sm text-slate-700">{formatSessionRange(session.startsAt, session.endsAt)}</p>
        <PlaceLine place={session.place} />
        <p className="mt-1 text-xs text-slate-500">{joinedText(session)}</p>
      </div>
    </li>
  );
}

const ONLINE_KINDS = { pre_test: 'Pre-test', activity: 'Activity', post_test: 'Post-test' };

// One online session: a test taken (or, before, an activity answered), added automatically.
function OnlineSessionRow({ session }) {
  const day = new Date(session.heldAt);
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-stone-100 text-slate-700">
        <span className="text-base font-bold leading-none">{day.getDate()}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{day.toLocaleDateString([], { month: 'short' })}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{session.moduleTitle}</p>
        <p className="text-sm text-slate-500">{session.isSpecialist ? session.otherUserName : `with ${session.otherUserName}`}</p>
      </div>
      <div className="text-right text-sm">
        <p className="text-slate-700">{ONLINE_KINDS[session.kind]}</p>
        <p className="text-xs text-slate-500">{timeOf(session.heldAt)}</p>
      </div>
    </li>
  );
}

// Face-to-face sessions are held in the specialist's free times (My Teaching Plan).
function FreeTimesNote({ who, slots }) {
  if (!slots) return <SkeletonBlock className="mb-4 h-4 w-72" />;
  return (
    <p className="mb-4 text-sm text-slate-700">
      {slots.length
        ? <><span className="font-semibold">{who} free:</span> {describeFreeTimes(slots)}</>
        : <span className="text-amber-800">{who === 'You are' ? 'Set your free times in My Teaching Plan first.' : 'They haven’t set their free times yet.'}</span>}
    </p>
  );
}

// A date, then a start time inside the free times that day.
function FreeTimeFields({ slots, date, time, minutes, onDate, onTime }) {
  const starts = freeStartTimes(slots || [], date, minutes);
  const blocks = [...new Set(starts.map((start) => start.block))];
  return (
    <>
      <label className="text-sm text-slate-600">
        Date
        <input required type="date" min={toLocalInputValue(new Date()).slice(0, 10)} value={date} onChange={(event) => onDate(event.target.value)} className={inputClass} />
      </label>
      <label className="text-sm text-slate-600">
        Start time
        <select required value={starts.some((start) => start.value === time) ? time : ''} onChange={(event) => onTime(event.target.value)} disabled={!starts.length} className={inputClass}>
          <option value="">{!date ? 'Choose a date first' : starts.length ? 'Choose a time' : 'No free time this day'}</option>
          {blocks.map((block) => (
            <optgroup key={block.value} label={`${block.label} (${block.hint})`}>
              {starts.filter((start) => start.block === block).map((start) => <option key={start.value} value={start.value}>{start.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  );
}

// The chosen start as a Date, or null when it isn't inside the free times.
function freeStart(slots, date, time, minutes) {
  return freeStartTimes(slots || [], date, minutes).some((start) => start.value === time) ? new Date(`${date}T${time}:00+08:00`) : null;
}

// "Book a session" from a module chat: /sessions?moduleId=..[&learner=..]
// A one-on-one face-to-face session.
function BookingForm({ moduleId, learnerId, onBooked, onCancel }) {
  const [details, setDetails] = useState(null);
  const [free, setFree] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
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
    axiosClient.get(`/sessions/modules/${moduleId}/free-times`, { params: { beneficiaryId: learnerId || undefined } })
      .then((response) => setFree(response.data.data))
      .catch((requestError) => {
        setFree({ failed: true });
        setError(requestError.response?.data?.message || 'Unable to load the free times.');
      });
  }, [moduleId, learnerId]);

  const who = free?.isMe ? 'You are' : `${free?.specialistName || 'Your specialist'} is`;

  async function submit(event) {
    event.preventDefault();
    const startsAt = freeStart(free?.slots, date, time, minutes);
    if (!startsAt) {
      setError('Choose a date and a start time inside the free times.');
      return;
    }
    if (!place.trim()) {
      setError('Add the place where you will meet.');
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
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">Book a face-to-face session</p>
      <h2 className="mt-1 text-lg font-semibold">{details ? `${details.title} with ${details.withName}` : <SkeletonBlock className="h-5 w-56" />}</h2>
      <p className="mb-2 mt-1 text-sm text-slate-500">You meet in person. They get a notice and accept it on their Sessions page.</p>
      {!free?.failed && <FreeTimesNote who={who} slots={free?.slots} />}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <FreeTimeFields slots={free?.slots} date={date} time={time} minutes={minutes} onDate={setDate} onTime={setTime} />
        <label className="text-sm text-slate-600">
          Length
          <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className={inputClass}>
            {DURATIONS.map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}
          </select>
        </label>
        <label className="min-w-64 flex-1 text-sm text-slate-600">
          Where you will meet
          <input required value={place} maxLength={255} onChange={(event) => setPlace(event.target.value)} placeholder="Barangay hall, school, or another place" className={`${inputClass} w-full`} />
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

// A specialist posts an open face-to-face session that anyone who needs the topic can join.
function OpenSessionForm({ topics, onPosted, onCancel }) {
  const [moduleId, setModuleId] = useState(topics.length === 1 ? String(topics[0].id) : '');
  const [slots, setSlots] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState(120);
  const [place, setPlace] = useState('');
  const [seats, setSeats] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axiosClient.get('/users/me/circumstances')
      .then((response) => setSlots(response.data.data?.availability || []))
      .catch(() => setSlots([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    const startsAt = freeStart(slots, date, time, minutes);
    if (!moduleId) return setError('Choose the topic.');
    if (!startsAt) return setError('Choose a date and a start time inside your free times.');
    if (!place.trim()) return setError('Add the place where you will meet.');
    setSaving(true);
    setError('');
    try {
      const response = await axiosClient.post('/sessions/open', {
        moduleId: Number(moduleId),
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + minutes * 60000).toISOString(),
        meetingLink: place.trim(),
        seats: seats === '' ? null : Number(seats),
      });
      onPosted(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to post this session.');
      setSaving(false);
    }
    return undefined;
  }

  return (
    <section className="mb-8 rounded-2xl border-2 border-brand-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">Open face-to-face session</p>
      <h2 className="mt-1 text-lg font-semibold">Meet everyone who needs a topic</h2>
      <p className="mb-2 mt-1 text-sm text-slate-500">Beneficiaries who need this topic see it on their Sessions page and can join, even if they aren&apos;t your learners yet.</p>
      {topics.length > 0 && <FreeTimesNote who="You are" slots={slots} />}
      {!topics.length && <p className="text-sm text-slate-600">You don&apos;t teach any topic yet. Choose your topics in My Teaching Plan first.</p>}
      {topics.length > 0 && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Topic
            <select required value={moduleId} onChange={(event) => setModuleId(event.target.value)} className={inputClass}>
              <option value="">Choose a topic</option>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
            </select>
          </label>
          <FreeTimeFields slots={slots} date={date} time={time} minutes={minutes} onDate={setDate} onTime={setTime} />
          <label className="text-sm text-slate-600">
            Length
            <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className={inputClass}>
              {[...DURATIONS, { minutes: 180, label: '3 hours' }, { minutes: 240, label: '4 hours' }].map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}
            </select>
          </label>
          <label className="min-w-56 flex-1 text-sm text-slate-600">
            Where you will meet
            <input required value={place} maxLength={255} onChange={(event) => setPlace(event.target.value)} placeholder="Barangay hall, school, or another place" className={`${inputClass} w-full`} />
          </label>
          <label className="text-sm text-slate-600">
            Seats (optional)
            <input type="number" min={1} max={500} value={seats} onChange={(event) => setSeats(event.target.value)} placeholder="No limit" className={`${inputClass} w-28`} />
          </label>
          <button type="submit" disabled={saving} className="rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-bold text-brand-900 hover:bg-accent-550 disabled:opacity-50">
            {saving ? 'Posting…' : 'Post session'}
          </button>
          <button type="button" onClick={onCancel} className="px-2 py-2.5 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

export default function Sessions() {
  const { user } = useAuth();
  const isSpecialist = user?.userType === 'specialist';
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [online, setOnline] = useState([]);
  const [openToJoin, setOpenToJoin] = useState([]);
  const [myTopics, setMyTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [showAllOnline, setShowAllOnline] = useState(false);
  const [posting, setPosting] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  // Beneficiaries outside the Philippines learn online only (the server says so).
  const [onlineOnly, setOnlineOnly] = useState(false);
  const bookFor = searchParams.get('moduleId');

  function loadSessions() {
    Promise.all([
      axiosClient.get('/sessions/modules/me').then((response) => setSessions(response.data.data)),
      axiosClient.get('/sessions/learning/me').then((response) => setOnline(response.data.data)).catch(() => setOnline([])),
      axiosClient.get('/sessions/open').then((response) => {
        setOpenToJoin(response.data.data.sessions);
        setMyTopics(response.data.data.topics);
        setOnlineOnly(Boolean(response.data.data.onlineOnly));
      }).catch(() => setOpenToJoin([])),
    ]).finally(() => setLoading(false));
  }

  useEffect(() => { loadSessions(); }, []);

  const tell = (message) => { setError(''); setNotice(message || ''); };
  const fail = (requestError, fallback) => { setNotice(''); setError(requestError.response?.data?.message || fallback); };

  async function handleUpdateStatus(session, status, extra = {}) {
    if (status === 'cancelled' && session.isOpen && session.joinedCount > 0) {
      const ok = await confirm({
        title: 'Cancel this session?',
        message: `${plural(session.joinedCount, 'beneficiary', 'beneficiaries')} joined. They'll get a notice that it's cancelled.`,
        confirmLabel: 'Cancel session',
        cancelLabel: 'Keep it',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const response = await axiosClient.patch(`/sessions/modules/${session.moduleSessionId}/status`, { status, ...extra });
      tell(response.data.message);
      loadSessions();
    } catch (requestError) {
      fail(requestError, 'Unable to update this session.');
    }
  }

  async function handleJoin(session) {
    setJoiningId(session.moduleSessionId);
    try {
      const response = await axiosClient.post(`/sessions/open/${session.moduleSessionId}/join`);
      tell(response.data.message);
      loadSessions();
    } catch (requestError) {
      fail(requestError, 'Unable to join this session.');
    } finally {
      setJoiningId(null);
    }
  }

  async function handleLeave(session) {
    try {
      const response = await axiosClient.delete(`/sessions/open/${session.moduleSessionId}/join`);
      tell(response.data.message);
      loadSessions();
    } catch (requestError) {
      fail(requestError, 'Unable to leave this session.');
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
        subtitle={isSpecialist
          ? 'Face-to-face sessions you book or post, and the online sessions added each time a learner takes a test in your module. Book one-on-one from a topic’s chat in Modules.'
          : onlineOnly
            ? 'You live outside the Philippines, so you learn online. An online session is added each time you take a test.'
            : 'Face-to-face sessions you book or join, and the online sessions added each time you take a test. Book one-on-one from a topic’s chat in Modules.'}
        actions={(
          <>
            {isSpecialist && <button type="button" onClick={() => setPosting(true)} className={headerPrimaryClass}>+ Open face-to-face session</button>}
            <Link to="/modules" className={headerButtonClass}>Go to Modules</Link>
          </>
        )}
      >
        {!loading && (
          <div className="flex flex-wrap gap-2">
            {!onlineOnly && (
              <>
                <HeaderStat value={upcoming.length} label="Upcoming" />
                <HeaderStat value={needsAnswer.length} label="Need your answer" alert={needsAnswer.length > 0} />
                {!isSpecialist && <HeaderStat value={openToJoin.length} label="Open to join" alert={openToJoin.length > 0} />}
                <HeaderStat value={held} label="Face-to-face held" />
              </>
            )}
            <HeaderStat value={online.length} label="Online sessions" />
          </div>
        )}
      </PageHeader>
      {bookFor && (
        <BookingForm
          moduleId={bookFor}
          learnerId={searchParams.get('learner')}
          onBooked={(message) => { tell(message); setSearchParams({}); loadSessions(); }}
          onCancel={() => setSearchParams({})}
        />
      )}
      {posting && (
        <OpenSessionForm
          topics={myTopics}
          onPosted={(message) => { tell(message); setPosting(false); loadSessions(); }}
          onCancel={() => setPosting(false)}
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
                {needsAnswer.map((s) => <SessionRow key={s.moduleSessionId} session={s} onUpdateStatus={handleUpdateStatus} onLeave={handleLeave} />)}
              </ul>
            </section>
          )}

          {!isSpecialist && openToJoin.length > 0 && (
            <section className="mb-8 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <h2 className="font-semibold text-brand-900">Open face-to-face sessions</h2>
              <p className="mb-3 mt-0.5 text-sm text-slate-600">Posted by specialists for topics you need. Join to save your seat.</p>
              <ul className="space-y-3">
                {openToJoin.map((s) => <OpenSessionRow key={s.moduleSessionId} session={s} onJoin={handleJoin} joining={joiningId === s.moduleSessionId} />)}
              </ul>
            </section>
          )}

          {onlineOnly && (
            <p className="mb-8 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Face-to-face sessions are for beneficiaries in the Philippines. You learn online: take your topic’s tests, and message your specialist in Modules.
            </p>
          )}
          {!onlineOnly && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Upcoming face-to-face</h2>}
          {!onlineOnly && !scheduled.length && (
            <div className="mb-8 rounded-2xl border border-stone-200 bg-white">
              {needsAnswer.length
                ? <EmptyState icon="calendar" compact title="Nothing else scheduled yet" />
                : isSpecialist
                  ? <EmptyState icon="calendar" title="No upcoming face-to-face sessions">Post an open session for everyone who needs a topic, or book one-on-one from a topic&apos;s chat.</EmptyState>
                  : <EmptyState icon="calendar" title="No upcoming face-to-face sessions" action={{ to: '/modules', label: 'Go to your topics' }}>Join an open session above, or book one-on-one from a topic&apos;s chat.</EmptyState>}
            </div>
          )}
          {days.map((day) => (
            <section key={day.label} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-brand-600">{day.label}</h3>
              <ul className="space-y-3">
                {day.sessions.map((s) => <SessionRow key={s.moduleSessionId} session={s} onUpdateStatus={handleUpdateStatus} onLeave={handleLeave} />)}
              </ul>
            </section>
          ))}

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Online sessions ({online.length})</h2>
            <p className="mb-3 mt-1 text-sm text-slate-500">Added automatically each time {isSpecialist ? 'a learner takes' : 'you take'} a pre-test or post-test. Each one is its own session.</p>
            {online.length
              ? (
                <>
                  <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
                    {(showAllOnline ? online : online.slice(0, 8)).map((s) => <OnlineSessionRow key={s.id} session={s} />)}
                  </ul>
                  {online.length > 8 && (
                    <button type="button" onClick={() => setShowAllOnline(!showAllOnline)} className="mt-2 text-sm font-medium text-brand-600 hover:underline">
                      {showAllOnline ? 'Show fewer' : `Show all ${online.length}`}
                    </button>
                  )}
                </>
              )
              : <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-500">No online sessions yet. One starts the first time {isSpecialist ? 'a learner takes' : 'you take'} a test in a module.</p>}
          </section>

          {(!onlineOnly || past.length > 0) && <section className="mt-8">
            <button
              type="button"
              onClick={() => setShowPast(!showPast)}
              aria-expanded={showPast}
              className="text-sm font-semibold uppercase tracking-wider text-slate-500 hover:text-brand-600"
            >
              {showPast ? '▾' : '▸'} Past face-to-face sessions ({past.length})
            </button>
            {showPast && (
              past.length
                ? <ul className="mt-3 space-y-3">{past.map((s) => <SessionRow key={s.moduleSessionId} session={s} onUpdateStatus={handleUpdateStatus} onLeave={handleLeave} quiet />)}</ul>
                : <p className="mt-3 text-sm text-slate-500">No past face-to-face sessions yet.</p>
            )}
          </section>}
        </>
      )}
    </AppLayout>
  );
}
