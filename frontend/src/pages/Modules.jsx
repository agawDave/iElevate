import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axiosClient from '../api/axiosClient';
import ModuleChatPanel from '../components/modules/ModuleChatPanel';
import MaterialsPanel from '../components/modules/MaterialsPanel';
import LearnerProfilePanel from '../components/modules/LearnerProfilePanel';
import ActivitiesPanel from '../components/modules/ActivitiesPanel';
import AnswersPanel from '../components/modules/AnswersPanel';
import RecommendationPanel from '../components/modules/RecommendationPanel';
import PageHeader, { HeaderStat, headerButtonClass } from '../components/layout/PageHeader';
import { openCertificate } from '../lib/certificates';
import { formatDay, waitedFor } from '../lib/sessions';
import LineIcon from '../components/ui/LineIcon';
import { SkeletonCards } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { avatarTint, initials } from '../lib/people';
import { TopicBand } from '../components/ui/TopicFace';
import { phaseInfo } from '../lib/topicFaces';
import { moduleEditorPath, moduleStatusOf } from '../lib/moduleStatus';
import { useConfirm } from '../context/ConfirmContext';

// The three stages (project-advisor recommendation):
//   Incoming  - the beneficiary applied; waiting for the specialist to accept
//   Ongoing   - the specialist accepted; the beneficiary is doing the module
//   Completed - the specialist marked them completed and gave the certificate
const STAGES = [
  { key: 'incoming', label: 'Incoming' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
];
const BAND_LABELS = { beginner: 'Beginner', developing: 'Developing', proficient: 'Proficient', strong: 'Strong' };


// A white card holding an empty state.
function EmptyCard({ children }) {
  return <div className="rounded-2xl border border-stone-200 bg-white">{children}</div>;
}

// Red dot on the corner of a button: someone is waiting for the user's reply
// there. It goes away when they reply (not when they just open the chat).
function ReplyDot({ label = 'waiting for your reply' }) {
  return (
    <>
      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" title={label} aria-hidden="true" />
      <span className="sr-only"> ({label})</span>
    </>
  );
}

// Where a learner's topic is: apply (not applied yet), incoming, ongoing, completed.
function learnerStage(module, conversation) {
  if (module.assignmentStatus === 'assigned') return module.certificate || conversation?.status === 'completed' ? 'completed' : 'ongoing';
  if (module.assignmentStatus === 'pending') return 'incoming';
  return 'apply';
}

function ChatDrawer({ onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Chat">
      <button type="button" aria-label="Close chat" onClick={onClose} className="absolute inset-0 bg-slate-900/30" />
      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">{children}</aside>
    </div>
  );
}

// A dot in each phase heading, one shade per ELEVATE phase.
const PHASE_STRIPES = ['bg-brand-300', 'bg-brand-500', 'bg-brand-700', 'bg-accent-500'];
function phaseStripe(phase) {
  const number = Number(String(phase || '').match(/\d+/)?.[0]);
  return PHASE_STRIPES[(number || 1) - 1] || 'bg-brand-300';
}

const STAGE_BADGES = {
  apply: { label: 'Not applied yet', style: 'bg-stone-100 text-slate-600' },
  soon: { label: 'Coming soon', style: 'bg-stone-100 text-slate-600' },
  queued: { label: 'Next up', style: 'bg-sky-50 text-sky-800' },
  incoming: { label: 'Incoming', style: 'bg-amber-50 text-amber-800' },
  ongoing: { label: 'Ongoing', style: 'bg-brand-50 text-brand-600' },
  completed: { label: 'Completed', style: 'bg-emerald-50 text-emerald-700', check: true },
};

const buttonStyles = {
  primary: 'rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-50',
  outline: 'rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50',
  green: 'rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50',
  small: 'inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50',
};

// ---------------------------------------------------------------- learner view

// The specialists who have an approved module for the topic and fit the
// learner, each with their module; the learner applies to one.
function SpecialistChoices({ options, topicHours, busy, onApply }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {options.length > 1 ? `Choose a specialist's module (${options.length})` : 'The module for this topic'}
      </p>
      <ul className="space-y-2">
        {options.map((option) => (
          <li key={option.specialistId} className={`flex items-start gap-3 rounded-lg border p-3 ${option.best ? 'border-brand-200 bg-brand-50/50' : 'border-stone-200 bg-white'}`}>
            {option.avatar
              ? <img src={option.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              : <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${avatarTint(option.name)}`} aria-hidden="true">{initials(option.name)}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {option.module?.title || option.name}
                {option.best && options.length > 1 && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Best fit</span>}
              </p>
              {option.module && (
                <p className="text-xs text-slate-600">
                  by {option.name}
                  {/* The card's band already shows the training design's hours. */}
                  {option.module.hours && option.module.hours !== topicHours ? ` · ${option.module.hours} hours` : ''}
                  {` · ${option.module.activities} activit${option.module.activities === 1 ? 'y' : 'ies'}`}
                  {option.module.testQuestions ? ' · pre/post-test' : ''}
                </p>
              )}
              {option.module?.overview && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{option.module.overview}</p>}
              {option.reasons.length > 0 && <p className="mt-0.5 text-xs leading-5 text-slate-500">{option.reasons.join(' · ')}</p>}
            </div>
            <button type="button" disabled={Boolean(busy)} onClick={() => onApply(option)} className={`shrink-0 ${buttonStyles.primary}`}>
              {busy === option.specialistId ? 'Applying…' : 'Apply'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LearnerCard({ module, conversation, stage, options, progress, applyingTo, waiting, onApply, onCancel, onChat, onMaterials }) {
  const specialist = module.specialistName || conversation?.otherUserName;
  const specialistFirst = (specialist || '').split(' ')[0];
  const unread = conversation?.unreadCount || 0;
  const total = progress?.total || 0;
  const done = progress?.done || 0;
  // No specialist has an approved module for the topic yet.
  const comingSoon = stage === 'apply' && module.assignmentStatus !== 'queued' && module.hasModules === false;
  const badge = STAGE_BADGES[stage === 'apply' && module.assignmentStatus === 'queued' ? 'queued' : comingSoon ? 'soon' : stage];
  const theirModule = stage !== 'apply' ? module.specialistModule : null;
  // The main (orange) button that opens the module page.
  let moduleButton = null;
  if (stage === 'ongoing' || stage === 'completed') {
    const label = stage === 'completed' ? 'Open module'
      : progress?.postTestOpen ? 'Take the post-test'
        : progress?.preTestOpen ? 'Take the pre-test'
          : !total ? 'Open module'
            : done === 0 ? 'Start module'
              : done < total ? 'Continue module' : 'Review module';
    moduleButton = <Link to={`/modules/${module.id}`} className={stage === 'ongoing' ? buttonStyles.primary : buttonStyles.outline}>{label}{stage === 'ongoing' ? ' →' : ''}</Link>;
  }
  let status;
  if (stage === 'apply' && module.assignmentStatus === 'queued') {
    status = <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">{module.waitingReason || 'You can apply once you finish one of your current topics.'}</p>;
  } else if (comingSoon) {
    status = (
      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-800">No module yet</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">No specialist has a module for this topic yet. It opens here as soon as one is approved.</p>
      </div>
    );
  } else if (stage === 'apply' && !options?.length) {
    status = <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="font-semibold">No specialist fits yet.</span> {module.waitingReason || 'No specialist who teaches this topic fits your schedule and learning mode.'} You can apply once one does.</p>;
  } else if (stage === 'apply') {
    status = <SpecialistChoices options={options} topicHours={module.hours} busy={applyingTo} onApply={(option) => onApply(module, option)} />;
  } else if (stage === 'incoming') {
    status = (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <span className="font-semibold">Waiting for {specialist} to accept.</span>{' '}
        Applied {module.appliedAt ? formatDay(module.appliedAt) : ''}. You can chat once they accept.{' '}
        <button type="button" onClick={() => onCancel(module)} className="font-semibold underline">Cancel application</button>
      </p>
    );
  } else if (stage === 'ongoing') {
    status = total > 0 ? (
      <div>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>{done} of {total} activities done</span>
          {progress.replies > 0 && <span>{progress.replies} repl{progress.replies === 1 ? 'y' : 'ies'} from {specialistFirst}</span>}
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Activities done">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      </div>
    ) : (
      <p className="truncate text-sm text-slate-600">{conversation?.lastMessage || `Accepted. Say hello to ${specialistFirst}!`}</p>
    );
  } else {
    status = <p className="text-sm text-emerald-800">{specialist} issued your certificate{conversation?.completedAt ? ` on ${formatDay(conversation.completedAt)}` : ''}.</p>;
  }
  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <TopicBand slug={module.slug} title={module.title} phase={module.phase} hours={module.hours} />
      <div className="flex flex-1 flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{module.title}</h3>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.style}`}>{badge.check && <LineIcon name="check" strokeWidth={2.5} className="h-3.5 w-3.5" />}{badge.label}</span>
      </div>
      {specialist && stage !== 'apply' && (
        <p className="text-xs text-slate-500">{theirModule ? <>Module: <span className="font-medium text-slate-700">{theirModule.title}</span> · </> : ''}with {specialist}</p>
      )}
      <p className="mb-4 mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{theirModule?.overview || module.description}</p>
      <div className="mb-4">{status}</div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {moduleButton}
        {stage === 'completed' && conversation?.certificateHasFile && (
          <button type="button" onClick={() => openCertificate(conversation.certificateId)} className={buttonStyles.green}>View certificate</button>
        )}
        <span className="ml-auto flex flex-wrap gap-1">
          {conversation && (
            <button type="button" onClick={() => onChat(conversation)} className={`relative ${buttonStyles.small}`}>
              Chat{unread > 0 ? <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread}</span> : ''}
              {waiting && <ReplyDot label={`${specialistFirst} is waiting for your reply`} />}
            </button>
          )}
          {stage === 'ongoing' && <Link to={`/sessions?moduleId=${module.id}`} className={buttonStyles.small}>Book a session</Link>}
          <button type="button" onClick={() => onMaterials(module.id)} className={buttonStyles.small}>Materials</button>
        </span>
      </div>
      </div>
    </article>
  );
}

// ------------------------------------------------------------- specialist view

// The specialist's next step for a topic whose module isn't approved yet.
function ModuleNextStep({ module, status, mine }) {
  const editor = moduleEditorPath(module.id);
  if (status === 'none') {
    return (
      <div className="mb-4 rounded-xl border border-dashed border-accent-500/60 bg-accent-50 px-4 py-3.5">
        <p className="text-sm font-semibold text-slate-900">Create your module for this topic</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">Beneficiaries can&apos;t apply to you for {module.title} until you create a module and the admin approves it.</p>
        <Link to={editor} className={`mt-3 inline-block ${buttonStyles.primary}`}>Create module →</Link>
      </div>
    );
  }
  if (status === 'draft') {
    return (
      <div className="mb-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3.5">
        <p className="text-sm font-semibold text-slate-900">Finish your module and submit it</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">It&apos;s saved as a draft. Add your materials and activities, then send it to the admin.</p>
        <Link to={editor} className={`mt-3 inline-block ${buttonStyles.primary}`}>Continue →</Link>
      </div>
    );
  }
  if (status === 'changes_requested') {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-red-700">Note from the admin</p>
        <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-red-900">{mine.reviewNote}</p>
        <Link to={editor} className={`mt-3 inline-block ${buttonStyles.primary}`}>Edit and resubmit →</Link>
      </div>
    );
  }
  if (status === 'pending') {
    return <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Sent to the admin{mine.submittedAt ? ` on ${formatDay(mine.submittedAt)}` : ''}. You can keep adding activities while you wait.</p>;
  }
  return null;
}

// One topic the specialist teaches: their own module for it (or the step to
// create one), and how many learners are at each stage.
function TeachingTopicCard({ module, counts, waiting = 0, activityCount, testQuestionCount, onOpenTab, onMaterials, onActivities }) {
  const mine = module.myModule;
  const status = mine?.status || 'none';
  const statusInfo = moduleStatusOf(mine);
  const live = status === 'approved' || status === 'pending';
  const hasLearners = counts.incoming + counts.ongoing + counts.completed > 0;
  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <TopicBand slug={module.slug} title={module.title} phase={module.phase} hours={mine?.hours || module.hours} />
      <div className="flex flex-1 flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-lg font-semibold text-slate-900">{mine?.title || module.title}</h3>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.style}`}>{statusInfo.check && <LineIcon name="check" strokeWidth={2.5} className="h-3.5 w-3.5" />}{statusInfo.label}</span>
      </div>
      {mine && mine.title !== module.title && <p className="text-xs text-slate-500">ELEVATE topic: {module.title}</p>}
      <p className="mb-4 mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{mine?.overview || module.description}</p>
      <ModuleNextStep module={module} status={status} mine={mine} />
      {(status === 'approved' || hasLearners) && (
      <div className="mb-4 grid grid-cols-3 gap-2">
        {STAGES.map((stage) => {
          const highlight = stage.key === 'incoming' && counts.incoming > 0;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onOpenTab(stage.key)}
              className={`relative rounded-lg border px-3 py-2 text-left transition ${highlight ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-stone-200 hover:bg-stone-50'}`}
            >
              <span className={`block text-[12px] font-semibold uppercase tracking-wide ${highlight ? 'text-amber-800' : 'text-slate-500'}`}>{stage.label}</span>
              <span className="text-xl font-extrabold tabular-nums text-brand-600">{counts[stage.key]}</span>
              {stage.key === 'ongoing' && waiting > 0 && <ReplyDot label={`${waiting} learner${waiting === 1 ? ' is' : 's are'} waiting for your reply`} />}
            </button>
          );
        })}
      </div>
      )}
      {!module.canAddMaterials && <p className="mb-3 text-xs text-slate-500">You no longer teach this topic. Your current learners stay with you.</p>}
      {live && (
        <>
          <p className={`mb-3 text-xs ${activityCount && testQuestionCount ? 'text-slate-500' : 'text-amber-800'}`}>
            {mine?.hours ? `${mine.hours} hours · ` : ''}
            {activityCount ? `${activityCount} activit${activityCount === 1 ? 'y' : 'ies'}` : 'no activities yet'}
            {' · '}
            {testQuestionCount ? `pre/post-test: ${testQuestionCount} question${testQuestionCount === 1 ? '' : 's'}` : 'no pre/post-test yet'}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            <button type="button" onClick={onActivities} className={activityCount && testQuestionCount ? buttonStyles.outline : buttonStyles.primary}>
              Tests &amp; activities
            </button>
            <button type="button" onClick={onMaterials} className={buttonStyles.outline}>Materials</button>
            <Link to={moduleEditorPath(module.id)} className={buttonStyles.outline}>Edit module</Link>
          </div>
        </>
      )}
      </div>
    </article>
  );
}

function TopicSection({ title, count, onMaterials, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3">
        <h3 className="font-semibold text-slate-900">{title} <span className="text-sm font-normal text-slate-500">· {count}</span></h3>
        <button type="button" onClick={onMaterials} className={buttonStyles.outline}>Materials</button>
      </header>
      <ul className="divide-y divide-stone-100">{children}</ul>
    </section>
  );
}

function LearnerRow({ name, avatar, children, actions, onViewProfile }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      {avatar
        ? <img src={avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        : <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTint(name)}`} aria-hidden="true">{initials(name)}</span>}
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onViewProfile} className="text-left font-semibold text-slate-900 hover:text-brand-700 hover:underline">{name}</button>
        <div className="text-xs text-slate-500">{children}</div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={onViewProfile} className={buttonStyles.outline}>Profile</button>
        {actions}
      </div>
    </li>
  );
}

// Items under "ELEVATE Phase 1", "ELEVATE Phase 2", … headings, phases in
// curriculum order (`phaseOrder`), items in the order given.
function PhaseGroups({ items, phaseOf, phaseOrder, layout = 'grid', render }) {
  const groups = [];
  items.forEach((item) => {
    const phase = phaseOf(item) || 'Other topics';
    let group = groups.find((entry) => entry.phase === phase);
    if (!group) {
      group = { phase, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });
  const rank = (phase) => {
    const index = phaseOrder.indexOf(phase);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  groups.sort((a, b) => rank(a.phase) - rank(b.phase));
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.phase}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${phaseStripe(group.phase)}`} aria-hidden="true" />
            {group.phase}
            {phaseInfo(group.phase).name && <span className="font-medium normal-case tracking-normal text-slate-500">· {phaseInfo(group.phase).name}</span>}
          </h2>
          <div className={layout === 'grid' ? 'grid gap-5 md:grid-cols-2' : 'space-y-4'}>{group.items.map(render)}</div>
        </section>
      ))}
    </div>
  );
}

// Items grouped by topic, topics in curriculum order (the order of `modules`).
function groupByTopic(items, moduleOf, modules) {
  const order = (id) => {
    const index = modules.findIndex((module) => String(module.id) === String(id));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const groups = new Map();
  items.forEach((item) => {
    const module = moduleOf(item);
    const group = groups.get(module.id) || { module, items: [] };
    group.items.push(item);
    groups.set(module.id, group);
  });
  return [...groups.values()].sort((a, b) => order(a.module.id) - order(b.module.id));
}

// ---------------------------------------------------------------------- page

export default function Modules() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSpecialist = user?.userType === 'specialist';
  const [modules, setModules] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [applications, setApplications] = useState([]);
  const [options, setOptions] = useState({});
  // Learners: { moduleId: {total, done, replies} }. Specialists: { learners, activityCounts }.
  const [activityInfo, setActivityInfo] = useState({});
  const [activitiesFor, setActivitiesFor] = useState(null);
  const [answersFor, setAnswersFor] = useState(null);
  const [recommendationFor, setRecommendationFor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // A message passed from another page (e.g. "sent to the admin" after submitting a module).
  const [notice, setNotice] = useState(() => location.state?.notice || '');
  const [busy, setBusy] = useState('');
  const [materialsFor, setMaterialsFor] = useState(null);
  const [profileFor, setProfileFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const [modulesResponse, inboxResponse, applicationsResponse, activitiesResponse] = await Promise.all([
        axiosClient.get('/modules', { params: { limit: 50, sort: 'curriculum' } }),
        axiosClient.get('/messages/inbox'),
        // Specialists: applications waiting for them. Learners: the specialists
        // they can apply to for each topic.
        axiosClient.get(isSpecialist ? '/elevate/applications/incoming' : '/elevate/applications/options'),
        // Activity progress (learners) or learners' progress and activity counts (specialists).
        axiosClient.get(isSpecialist ? '/elevate/activities/summary' : '/elevate/activities/progress'),
      ]);
      setModules(Array.isArray(modulesResponse.data?.data) ? modulesResponse.data.data : []);
      setConversations(inboxResponse.data.data.conversations);
      if (isSpecialist) setApplications(applicationsResponse.data.data);
      else setOptions(applicationsResponse.data.data);
      setActivityInfo(activitiesResponse.data.data);
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Unable to load your modules. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isSpecialist]);

  useEffect(() => { load(); }, [load]);
  // Show a passed-in message once; a reload doesn't bring it back.
  useEffect(() => {
    if (location.state?.notice) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);
  useEffect(() => {
    if (!socket) return undefined;
    // The user sent a message: reload so its "waiting for your reply" dots go away.
    const onMessage = (message) => { if (String(message.senderId) === String(user?.id)) load(); };
    socket.on('notification:new', load);
    socket.on('message:new', onMessage);
    return () => {
      socket.off('notification:new', load);
      socket.off('message:new', onMessage);
    };
  }, [socket, load, user?.id]);

  const moduleById = useMemo(() => new Map(modules.map((module) => [String(module.id), module])), [modules]);
  const conversationByModule = useMemo(() => new Map(conversations.map((item) => [String(item.moduleId), item])), [conversations]);

  // Links from the specialist dashboard open a panel straight away:
  // ?answers=<moduleId>:<beneficiaryId> (a learner's answers), ?activities=<moduleId>.
  useEffect(() => {
    if (loading || !isSpecialist) return;
    const answers = searchParams.get('answers');
    const activities = searchParams.get('activities');
    if (!answers && !activities) return;
    if (answers) {
      const [moduleId, beneficiaryId] = answers.split(':');
      setAnswersFor({ moduleId: Number(moduleId), beneficiaryId: Number(beneficiaryId), moduleTitle: moduleById.get(String(moduleId))?.title || '' });
    } else if (moduleById.has(String(activities))) {
      setActivitiesFor(Number(activities));
    }
    const next = new URLSearchParams(searchParams);
    ['answers', 'activities'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [loading, isSpecialist, searchParams, setSearchParams, moduleById]);

  // Learner: every topic in their plan with its stage.
  const learnerTopics = useMemo(() => modules.map((module) => {
    const conversation = module.assignmentStatus === 'assigned' ? conversationByModule.get(String(module.id)) || null : null;
    return { module, conversation, stage: learnerStage(module, conversation) };
  }), [modules, conversationByModule]);

  const counts = isSpecialist
    ? {
      incoming: applications.length,
      ongoing: conversations.filter((item) => item.status === 'ongoing').length,
      completed: conversations.filter((item) => item.status === 'completed').length,
    }
    : Object.fromEntries(['apply', 'incoming', 'ongoing', 'completed'].map((key) => [key, learnerTopics.filter((topic) => topic.stage === key).length]));
  const tabs = [
    { key: 'all', label: 'All topics', count: modules.length },
    ...STAGES.map((stage) => ({ ...stage, count: counts[stage.key] })),
  ];
  const requestedTab = searchParams.get('tab');
  const defaultTab = 'all';
  const tab = tabs.some((item) => item.key === requestedTab) ? requestedTab : defaultTab;
  const openChatId = searchParams.get('chat') || searchParams.get('c');
  const openConversation = conversations.find((item) => String(item.id) === String(openChatId)) || null;

  function setParams(changes) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    next.delete('c');
    next.delete('topic');
    setSearchParams(next, { replace: true });
  }
  const openChat = (conversation) => setParams({ chat: String(conversation.id) });
  const closeChat = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('chat');
    next.delete('c');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function act(key, request) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const response = await request();
      setNotice(response.data.message);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy('');
    }
  }
  const apply = (module, option) => act(`apply-${module.id}-${option.specialistId}`,
    () => axiosClient.post(`/elevate/applications/${module.id}`, { specialistId: option.specialistId }));
  async function cancelApplication(module) {
    if (!await confirm({ title: 'Cancel your application?', message: `Your application to ${module.specialistName} for ${module.title} is withdrawn. You can then apply to another specialist.`, confirmLabel: 'Cancel application', cancelLabel: 'Keep it', danger: true })) return;
    act(`cancel-${module.id}`, () => axiosClient.delete(`/elevate/applications/${module.id}`));
  }
  const accept = (application) => act(`accept-${application.moduleId}-${application.beneficiaryId}`,
    () => axiosClient.post(`/elevate/applications/${application.moduleId}/${application.beneficiaryId}/accept`));
  async function decline(application) {
    if (!await confirm({ title: `Decline ${application.learnerName}'s application?`, message: `Their application for ${application.moduleTitle} goes to the next specialist who fits.`, confirmLabel: 'Decline', danger: true })) return;
    act(`decline-${application.moduleId}-${application.beneficiaryId}`,
      () => axiosClient.post(`/elevate/applications/${application.moduleId}/${application.beneficiaryId}/decline`));
  }

  const teachingTopics = modules.filter((module) => module.canAddMaterials).map((module) => ({ id: module.id, title: module.title }));
  const topicOf = (moduleId, title, phase) => moduleById.get(String(moduleId)) || { id: moduleId, title, phase };
  // The other person wrote last in an ongoing chat (same rule as the sidebar reminder).
  const waitingForReply = (item) => item.status === 'ongoing' && Boolean(item.lastSenderId) && String(item.lastSenderId) !== String(user?.id);
  // A specialist's view of one learner's activity progress on a topic.
  const progressOf = (item) => (activityInfo.learners || []).find(
    (entry) => String(entry.moduleId) === String(item.moduleId) && String(entry.beneficiaryId) === String(item.beneficiaryId)
  ) || { total: 0, done: 0, toReview: 0, preTest: null, postTest: null };
  const hasTest = (item) => (activityInfo.testQuestionCounts?.[item.moduleId] || 0) > 0;
  const score = (attempt) => (attempt ? `${attempt.score}/${attempt.total}` : '—');
  // ELEVATE Phase 1, Phase 2, … in curriculum order.
  const phaseOrder = [...new Set(modules.map((module) => module.phase))];

  let content;
  if (loading) {
    content = <SkeletonCards count={4} label="Loading your modules…" />;
  } else if (!isSpecialist) {
    const shown = learnerTopics.filter((topic) => tab === 'all' || topic.stage === tab);
    content = shown.length ? (
      <PhaseGroups
        items={shown}
        phaseOf={(topic) => topic.module.phase}
        phaseOrder={phaseOrder}
        render={({ module, conversation, stage }) => (
          <LearnerCard
            key={module.id}
            module={module}
            conversation={conversation}
            stage={stage}
            options={options[module.id] || []}
            progress={activityInfo[module.id]}
            waiting={Boolean(conversation) && waitingForReply(conversation)}
            applyingTo={busy.startsWith(`apply-${module.id}-`) ? Number(busy.split('-')[2]) : null}
            onApply={apply}
            onCancel={cancelApplication}
            onChat={openChat}
            onMaterials={setMaterialsFor}
          />
        )}
      />
    ) : (
      <EmptyCard>
        {!modules.length
          ? <EmptyState icon="brand" primary title="Your topics come from your skill check" action={{ label: 'Retake the skill check', onClick: () => navigate('/onboarding/learning-goals?retake=1') }}>Take it again and we&apos;ll suggest the ELEVATE topics that fit you.</EmptyState>
          : {
            incoming: <EmptyState icon="inbox" title="No applications waiting" action={{ label: 'See all topics', onClick: () => setParams({ tab: '' }) }}>Apply to a topic under All topics, and it waits here until the specialist accepts.</EmptyState>,
            ongoing: <EmptyState icon="book" title="No topics in progress yet">Once a specialist accepts your application, the topic shows here.</EmptyState>,
            completed: <EmptyState icon="award" title="No completed topics yet">Topics you finish, with their certificates, show here.</EmptyState>,
          }[tab]}
      </EmptyCard>
    );
  } else if (tab === 'all') {
    const countFor = (moduleId) => ({
      incoming: applications.filter((item) => String(item.moduleId) === String(moduleId)).length,
      ongoing: conversations.filter((item) => String(item.moduleId) === String(moduleId) && item.status === 'ongoing').length,
      completed: conversations.filter((item) => String(item.moduleId) === String(moduleId) && item.status === 'completed').length,
    });
    content = modules.length ? (
      <PhaseGroups
        items={modules}
        phaseOf={(module) => module.phase}
        phaseOrder={phaseOrder}
        render={(module) => (
          <TeachingTopicCard
            key={module.id}
            module={module}
            counts={countFor(module.id)}
            waiting={conversations.filter((item) => String(item.moduleId) === String(module.id) && waitingForReply(item)).length}
            activityCount={activityInfo.activityCounts?.[module.id] || 0}
            testQuestionCount={activityInfo.testQuestionCounts?.[module.id] || 0}
            onOpenTab={(key) => setParams({ tab: key })}
            onMaterials={() => setMaterialsFor(module.id)}
            onActivities={() => setActivitiesFor(module.id)}
          />
        )}
      />
    ) : (
      <EmptyCard>
        <EmptyState icon="book" primary title="You don't teach any topics yet" action={{ to: '/learning-plan', label: 'Choose your topics' }}>Pick the ELEVATE topics you teach in your teaching plan. Then create your module for each one here.</EmptyState>
      </EmptyCard>
    );
  } else if (tab === 'incoming') {
    const groups = groupByTopic(applications, (item) => topicOf(item.moduleId, item.moduleTitle, item.phase), modules);
    content = groups.length ? (
      <PhaseGroups
        items={groups}
        phaseOf={(group) => group.module.phase}
        phaseOrder={phaseOrder}
        layout="stack"
        render={({ module, items }) => (
          <TopicSection key={module.id} title={module.title} count={`${items.length} applied`} onMaterials={() => setMaterialsFor(module.id)}>
            {items.map((item) => {
              const key = `${item.moduleId}-${item.beneficiaryId}`;
              return (
                <LearnerRow
                  key={key}
                  name={item.learnerName}
                  avatar={item.learnerAvatar}
                  onViewProfile={() => setProfileFor(item.beneficiaryId)}
                  actions={(
                    <>
                      <button type="button" disabled={Boolean(busy)} onClick={() => accept(item)} className={buttonStyles.green}>{busy === `accept-${key}` ? 'Accepting…' : 'Accept'}</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => decline(item)} className={buttonStyles.outline}>Decline</button>
                    </>
                  )}
                >
                  <p>Applied {formatDay(item.appliedAt)}{item.place ? ` · ${item.place}` : ''}{item.band ? ` · Skill check: ${BAND_LABELS[item.band] || item.band}` : ''}</p>
                  {item.notes && <p className="mt-0.5 line-clamp-2 italic text-slate-600">&ldquo;{item.notes}&rdquo;</p>}
                </LearnerRow>
              );
            })}
          </TopicSection>
        )}
      />
    ) : <EmptyCard><EmptyState icon="inbox" title="No new applications">Beneficiaries who apply to your topics show here for you to accept.</EmptyState></EmptyCard>;
  } else {
    const items = conversations
      .filter((item) => item.status === tab)
      .sort((a, b) => (waitingForReply(b) - waitingForReply(a))
        || (waitingForReply(a) ? new Date(a.lastMessageAt) - new Date(b.lastMessageAt) : new Date(b.lastMessageAt || b.matchedAt || 0) - new Date(a.lastMessageAt || a.matchedAt || 0)));
    // Within each phase, topics with someone waiting for a reply come first
    // (stable sort, so curriculum order otherwise).
    const groups = groupByTopic(items, (item) => topicOf(item.moduleId, item.moduleTitle, item.phase), modules)
      .sort((a, b) => Number(b.items.some(waitingForReply)) - Number(a.items.some(waitingForReply)));
    content = groups.length ? (
      <PhaseGroups
        items={groups}
        phaseOf={(group) => group.module.phase}
        phaseOrder={phaseOrder}
        layout="stack"
        render={({ module, items: rows }) => (
          <TopicSection key={module.id} title={module.title} count={`${rows.length} learner${rows.length === 1 ? '' : 's'}`} onMaterials={() => setMaterialsFor(module.id)}>
            {rows.map((item) => (
              <LearnerRow
                key={item.id}
                name={item.otherUserName}
                avatar={item.otherUserAvatar}
                onViewProfile={() => setProfileFor(item.beneficiaryId)}
                actions={(
                  <>
                    {tab === 'completed' && item.certificateHasFile && (
                      <button type="button" onClick={() => openCertificate(item.certificateId)} className={buttonStyles.outline}>View certificate</button>
                    )}
                    {(progressOf(item).total > 0 || hasTest(item)) && (
                      <button type="button" onClick={() => setAnswersFor({ moduleId: item.moduleId, beneficiaryId: item.beneficiaryId, moduleTitle: module.title })} className={buttonStyles.outline}>
                        Answers{progressOf(item).toReview ? ` (${progressOf(item).toReview} to read)` : ''}
                      </button>
                    )}
                    {progressOf(item).recommendation && progressOf(item).recommendation.status !== 'declined' && (
                      <button
                        type="button"
                        onClick={() => setRecommendationFor({ recommendation: progressOf(item).recommendation, learnerName: item.otherUserName, moduleTitle: module.title })}
                        className={buttonStyles.outline}
                      >
                        Recommendation{progressOf(item).recommendation.status === 'requested' ? ' (asked)' : ''}
                      </button>
                    )}
                    <button type="button" onClick={() => openChat(item)} className={`relative ${tab === 'ongoing' ? buttonStyles.primary : buttonStyles.outline}`}>
                      Chat{item.unreadCount ? ` (${item.unreadCount} new)` : ''}
                      {waitingForReply(item) && <ReplyDot label={`${item.otherUserName} is waiting for your reply`} />}
                    </button>
                  </>
                )}
              >
                {tab === 'completed'
                  ? <p>Completed {item.completedAt ? formatDay(item.completedAt) : ''} · certificate issued</p>
                  : waitingForReply(item)
                    ? <p className="font-medium text-amber-700">Waiting {waitedFor(item.lastMessageAt)} for your reply</p>
                    : <p className="truncate">{item.lastMessage || 'Accepted. Say hello!'}</p>}
                {(progressOf(item).total > 0 || hasTest(item) || progressOf(item).preTest) && (
                  <p className="mt-0.5">
                    {(hasTest(item) || progressOf(item).preTest) && <>Pre-test {score(progressOf(item).preTest)} → Post-test {score(progressOf(item).postTest)}{progressOf(item).total > 0 ? ' · ' : ''}</>}
                    {progressOf(item).total > 0 && <>Activities: {progressOf(item).done} of {progressOf(item).total} done</>}
                    {progressOf(item).toReview > 0 &&<span className="ml-1 font-semibold text-amber-700">· {progressOf(item).toReview} answer{progressOf(item).toReview === 1 ? '' : 's'} to read</span>}
                  </p>
                )}
              </LearnerRow>
            ))}
          </TopicSection>
        )}
      />
    ) : (
      <EmptyCard>
        {tab === 'ongoing'
          ? <EmptyState icon="users" title="No learners in progress">Learners you accept show here, with their chat and progress.</EmptyState>
          : <EmptyState icon="award" title="No completed learners yet">Mark a learner completed from their chat to issue their certificate.</EmptyState>}
      </EmptyCard>
    );
  }

  const waitingCount = conversations.filter(waitingForReply).length;
  // Topics the learner can apply to right now (not next up, and someone fits).
  const readyToApply = learnerTopics.filter((topic) => topic.stage === 'apply' && (options[topic.module.id] || []).length).length;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="E.L.E.V.A.T.E. learning center"
        title={isSpecialist ? 'Your ELEVATE teaching topics' : 'Your ELEVATE modules'}
        subtitle={isSpecialist
          ? 'Create your module for each topic you teach. Once the admin approves it, beneficiaries can apply to you. Guide them, then mark them completed with their certificate.'
          : 'For each topic, choose a specialist and apply. Once they accept, learn with them until they give you your certificate.'}
        actions={isSpecialist && teachingTopics.length > 0 && (
          <button type="button" onClick={() => setMaterialsFor(teachingTopics[0].id)} className={headerButtonClass}>Teaching materials</button>
        )}
      >
        {/* The stages are the tabs. */}
        {!loading && (
          <div role="tablist" aria-label="Stage" className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <HeaderStat
                key={item.key}
                value={item.count}
                label={item.label}
                selected={tab === item.key}
                alert={item.key === 'incoming' && isSpecialist && item.count > 0}
                dot={item.key === 'ongoing' && waitingCount > 0 ? `${waitingCount} waiting for your reply` : ''}
                onClick={() => setParams({ tab: item.key === defaultTab ? '' : item.key })}
              />
            ))}
          </div>
        )}
      </PageHeader>
      {!loading && !isSpecialist && readyToApply > 0 && tab === 'all' && (
        <p className="-mt-2 mb-4 text-sm text-slate-600">{readyToApply} topic{readyToApply === 1 ? '' : 's'} you can apply to now. <Link to="/learning-plan" className="font-medium text-brand-600 hover:underline">See your learning plan</Link></p>
      )}
      {!loading && isSpecialist && waitingCount > 0 && tab === 'ongoing' && (
        <p className="-mt-2 mb-4 text-sm font-medium text-amber-800">{waitingCount} learner{waitingCount === 1 ? ' is' : 's are'} waiting for your reply. They&apos;re listed first in each phase.</p>
      )}
      {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</p>}
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-3 font-semibold underline">Try again</button>
        </div>
      )}

      {content}

      {openConversation && (
        <ChatDrawer onClose={closeChat}>
          <ModuleChatPanel
            key={openConversation.id}
            conversation={openConversation}
            module={topicOf(openConversation.moduleId, openConversation.moduleTitle, openConversation.phase)}
            isSpecialist={isSpecialist}
            onOpenMaterials={() => setMaterialsFor(openConversation.moduleId)}
            onChanged={load}
            onClose={closeChat}
            onViewProfile={isSpecialist ? () => setProfileFor(openConversation.beneficiaryId) : undefined}
          />
        </ChatDrawer>
      )}
      {profileFor && <LearnerProfilePanel beneficiaryId={profileFor} onClose={() => setProfileFor(null)} />}
      {activitiesFor && (
        <ActivitiesPanel topicId={activitiesFor} topics={modules.map((module) => ({ id: module.id, title: module.title }))} onClose={() => setActivitiesFor(null)} onChanged={load} />
      )}
      {recommendationFor && (
        <RecommendationPanel
          recommendation={recommendationFor.recommendation}
          learnerName={recommendationFor.learnerName}
          moduleTitle={recommendationFor.moduleTitle}
          onClose={() => setRecommendationFor(null)}
          onChanged={load}
        />
      )}
      {answersFor && (
        <AnswersPanel
          moduleId={answersFor.moduleId}
          beneficiaryId={answersFor.beneficiaryId}
          moduleTitle={answersFor.moduleTitle}
          onClose={() => setAnswersFor(null)}
          onChanged={load}
        />
      )}
      {materialsFor && (
        <MaterialsPanel topicId={materialsFor} topics={isSpecialist ? teachingTopics : []} onClose={() => setMaterialsFor(null)} />
      )}
    </AppLayout>
  );
}
