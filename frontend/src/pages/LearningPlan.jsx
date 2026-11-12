import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageHeader, { HeaderStat, headerButtonClass, headerPrimaryClass } from '../components/layout/PageHeader';
import TopicPicker from '../components/TopicPicker';
import CircumstancesForm from '../components/CircumstancesForm';
import TeachingDetailsForm from '../components/TeachingDetailsForm';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { DAYS, LEARNING_MODES, TIME_BLOCKS, slotKey } from '../lib/circumstances';
import { SkeletonLines } from '../components/ui/Skeleton';

// "My Learning Plan" (beneficiaries) / "My Teaching Plan" (specialists):
// everything the system uses to match learners with specialists. Personal and
// demographic details stay on the Profile page.

const GOAL_LABELS = {
  job: 'Get hired for an office or BPO job',
  freelance: 'Work from home as a freelancer or virtual assistant',
  business: 'Start or grow my own online business',
  undecided: 'Not sure yet',
};
const BAND_LABELS = { beginner: 'Beginner', developing: 'Developing', proficient: 'Proficient', strong: 'Strong' };
const BAND_STYLES = {
  beginner: 'bg-amber-50 text-amber-800',
  developing: 'bg-sky-50 text-sky-800',
  proficient: 'bg-emerald-50 text-emerald-800',
  strong: 'bg-emerald-100 text-emerald-900',
};
const OUTCOME_TAGS = { active: 'Learning now', next_up: 'Next up' };
const ANSWER_LABELS = ['You answered: Never', 'You answered: With help', 'You answered: On my own'];
const DEVICE_SHORT = { computer: 'Own computer or laptop', smartphone: 'Smartphone only', none: 'No device' };
const INTERNET_SHORT = { stable: 'Stable internet', slow: 'Slow or unreliable', none: 'No internet at home' };

function Section({ title, description, action, children }) {
  return (
    <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-brand-600">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// The skill level (0 to 3) as three bars.
function LevelBar({ level }) {
  const filled = Math.max(0, Math.min(3, Math.round(Number(level) || 0)));
  return (
    <span className="flex gap-0.5" aria-label={`Level ${filled} of 3`}>
      {[0, 1, 2].map((index) => <span key={index} className={`h-2 w-4 rounded-sm ${index < filled ? 'bg-brand-500' : 'bg-stone-200'}`} />)}
    </span>
  );
}

function SkillRow({ result, tag }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{result.title}</p>
        <p className="text-xs text-slate-500">{[tag, ANSWER_LABELS[Math.round(Number(result.level))]].filter(Boolean).join(' · ')}</p>
      </div>
      <span className="flex shrink-0 items-center gap-2">
        <LevelBar level={result.level} />
        <span className={`w-[5.5rem] rounded-full px-2 py-0.5 text-center text-xs font-medium ${BAND_STYLES[result.band] || 'bg-stone-100 text-slate-600'}`}>{BAND_LABELS[result.band] || result.band}</span>
      </span>
    </li>
  );
}

// The skill check as a map: what they'll learn, and what they already know well.
function SkillMap({ check }) {
  const results = check.results || [];
  const toLearn = [...results.filter((r) => r.outcome === 'active'), ...results.filter((r) => r.outcome === 'next_up')];
  const known = results.filter((r) => ['refresher', 'peer_helper'].includes(r.outcome));
  const phases = check.profile?.phasesCompleted || [];
  return (
    <div>
      <dl className="mb-4 flex flex-wrap gap-2 text-sm">
        <div className="rounded-lg bg-stone-50 px-3 py-1.5"><dt className="inline text-slate-500">Used a computer: </dt><dd className="inline font-medium text-slate-800">{check.profile?.usedComputer ? 'Yes' : 'No'}</dd></div>
        <div className="rounded-lg bg-stone-50 px-3 py-1.5"><dt className="inline text-slate-500">Phases finished: </dt><dd className="inline font-medium text-slate-800">{phases.length ? phases.map((phase) => `Phase ${phase}`).join(', ') : 'None yet'}</dd></div>
        <div className="rounded-lg bg-stone-50 px-3 py-1.5">
          <dt className="inline text-slate-500">{check.attempt > 1 ? `Post-test ${check.attempt - 1}` : 'Pre-test'}: </dt>
          <dd className="inline font-medium text-slate-800">{check.takenAt ? new Date(String(check.takenAt).replace(' ', 'T')).toLocaleDateString() : '—'}</dd>
        </div>
      </dl>
      {check.profile?.notes && (
        <p className="mb-4 rounded-lg border border-stone-200 px-3 py-2 text-sm text-slate-700"><span className="font-semibold text-slate-800">You told us: </span>{check.profile.notes}</p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="h-2.5 w-2.5 rounded-full bg-accent-500" aria-hidden="true" />Topics to learn ({toLearn.length})</h3>
          <p className="mb-1 text-xs text-slate-500">Each topic learning now is matched with a specialist. Next-up topics start as you finish.</p>
          {toLearn.length ? <ul className="divide-y divide-stone-100">{toLearn.map((r) => <SkillRow key={r.slug} result={r} tag={OUTCOME_TAGS[r.outcome]} />)}</ul> : <p className="py-2 text-sm text-slate-500">None. You already know every topic well.</p>}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />You already know well ({known.length})</h3>
          <p className="mb-1 text-xs text-slate-500">You said you can do these on your own, so no training is needed.</p>
          {known.length ? <ul className="divide-y divide-stone-100">{known.map((r) => <SkillRow key={r.slug} result={r} />)}</ul> : <p className="py-2 text-sm text-slate-500">None yet.</p>}
        </div>
      </div>
    </div>
  );
}

// Learning modes, device, internet and the weekly schedule at a glance; Edit opens the form.
function CircumstancesPanel({ userType, title, description }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    axiosClient.get('/users/me/circumstances')
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load your details.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const availability = new Set(data?.availability || []);
  const modes = (data?.learningModes || []).map((mode) => LEARNING_MODES.find((item) => item.value === mode)?.label || mode);
  const cards = [
    { label: 'Learning modes', value: modes.length ? modes.join(', ') : 'Not set' },
    userType === 'beneficiary' && { label: 'Device', value: DEVICE_SHORT[data?.deviceAccess] || 'Not set' },
    userType === 'beneficiary' && { label: 'Internet', value: INTERNET_SHORT[data?.internetAccess] || 'Not set' },
    { label: 'Area', value: [data?.barangay && `Brgy. ${data.barangay}`, data?.city].filter(Boolean).join(', ') || 'Set it on your Profile' },
  ].filter(Boolean);

  return (
    <Section
      title={title}
      description={description}
      action={!editing && <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-brand-600 px-3.5 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">Edit</button>}
    >
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      {editing ? (
        <div>
          <CircumstancesForm userType={userType} onSaved={() => { setEditing(false); load(); }} />
          <button type="button" onClick={() => setEditing(false)} className="mt-3 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
        </div>
      ) : !data ? <SkeletonLines lines={5} label="Loading your schedule…" /> : (
        <>
          <div className={`grid gap-3 ${cards.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}>
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{card.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">When you&apos;re free</p>
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="w-28" />
                  {DAYS.map((day) => <th key={day.value} className="w-12 pb-1 text-center text-xs font-medium text-slate-500">{day.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {TIME_BLOCKS.map((time) => (
                  <tr key={time.value}>
                    <th className="py-1 pr-2 text-left text-xs font-medium text-slate-600">{time.label}<span className="block text-[10px] font-normal text-slate-400">{time.hint}</span></th>
                    {DAYS.map((day) => {
                      const free = availability.has(slotKey(day.value, time.value));
                      return (
                        <td key={day.value} className="py-1 text-center">
                          <span className={`mx-auto block h-6 w-9 rounded-md ${free ? 'bg-brand-600' : 'bg-stone-100'}`} aria-label={`${day.label} ${time.label}: ${free ? 'free' : 'not free'}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!availability.size && <p className="mt-2 text-sm text-amber-800">No free times set yet. Press Edit to choose them, so a specialist can be matched to you.</p>}
          </div>
        </>
      )}
    </Section>
  );
}

export default function LearningPlan() {
  const { user } = useAuth();
  const isBeneficiary = user?.userType === 'beneficiary';
  const [teachingTopicsVersion, setTeachingTopicsVersion] = useState(0);
  const [check, setCheck] = useState(null);
  const [checkError, setCheckError] = useState('');

  useEffect(() => {
    if (!isBeneficiary) return undefined;
    let active = true;
    axiosClient.get('/elevate/skill-check/me')
      .then((response) => { if (active) setCheck(response.data.data); })
      .catch((requestError) => { if (active) setCheckError(requestError.response?.data?.message || 'Unable to load your skill check.'); });
    return () => { active = false; };
  }, [isBeneficiary]);

  const results = check?.results || [];
  const count = (outcomes) => results.filter((r) => outcomes.includes(r.outcome)).length;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="ELEVATE profiling"
        title={isBeneficiary ? 'My Learning Plan' : 'My Teaching Plan'}
        subtitle={isBeneficiary
          ? (check?.profile?.goalTrack ? `Your goal: ${GOAL_LABELS[check.profile.goalTrack]}. Your skill check and circumstances decide which topics you learn and who teaches each one.` : 'Your skill check and circumstances decide which topics you learn and which specialist teaches each one.')
          : 'Your topics, teaching details and circumstances decide which beneficiaries are matched to you.'}
        actions={(
          <>
            {isBeneficiary && check?.completed && <Link to="/onboarding/learning-goals?retake=1" className={headerButtonClass}>Retake the skill check</Link>}
            <Link to="/modules" className={headerPrimaryClass}>See your matches →</Link>
          </>
        )}
      >
        {isBeneficiary && check?.completed && (
          <div className="flex flex-wrap gap-2">
            <HeaderStat value={count(['active'])} label="Learning now" />
            <HeaderStat value={count(['next_up'])} label="Next up" />
            <HeaderStat value={count(['refresher', 'peer_helper'])} label="You know well" />
          </div>
        )}
      </PageHeader>

      {isBeneficiary ? (
        <>
          <Section title="Your skill check" description="Retake it after training so finished topics drop off and next-up topics start.">
            {checkError && <p role="alert" className="text-sm text-red-600">{checkError}</p>}
            {!check && !checkError && <SkeletonLines lines={6} label="Loading your skill check…" />}
            {check && !check.completed && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Take the ELEVATE skill check so your topics match your goal and level.</p>
                <Link to="/onboarding/learning-goals?retake=1" className="inline-block rounded-lg bg-accent-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-accent-550">Take the skill check</Link>
              </div>
            )}
            {check?.completed && <SkillMap check={check} />}
          </Section>
          <CircumstancesPanel
            userType="beneficiary"
            title="Your learning circumstances"
            description="Your specialist for each topic is assigned from these details. Update them whenever your situation changes."
          />
        </>
      ) : (
        <>
          <Section title="Topics you teach">
            <TopicPicker relation="teaches" onSaved={() => setTeachingTopicsVersion((current) => current + 1)} />
          </Section>
          <Section
            title="Your teaching details"
            description="Learners are matched to you for a topic when you are advanced or expert in it and take learners at their level."
          >
            <TeachingDetailsForm refreshKey={teachingTopicsVersion} />
          </Section>
          <CircumstancesPanel
            userType="specialist"
            title="Your teaching circumstances"
            description="Beneficiaries are matched to you when their schedule, learning mode, and barangay align with yours."
          />
        </>
      )}
    </AppLayout>
  );
}
