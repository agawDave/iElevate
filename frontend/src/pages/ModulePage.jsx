import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import MaterialsList from '../components/modules/MaterialsList';
import { withFileLinks } from '../lib/moduleFiles';
import { formatSessionRange } from '../lib/sessions';
import LineIcon from '../components/ui/LineIcon';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonLines } from '../components/ui/Skeleton';
import ModuleHero from '../components/modules/ModuleHero';
import CompletionCelebration from '../components/modules/CompletionCelebration';

const TEST_LABELS = { pre: 'Pre-test', post: 'Post-test' };

// The Pre-test / Post-test pill in the row of steps.
function TestStep({ kind, attempt, active, locked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      title={locked && kind === 'post' ? 'Your specialist opens it when you’re ready' : undefined}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${active ? 'ring-2 ring-brand-600 ring-offset-2' : ''} ${
        attempt ? 'bg-emerald-600 text-white'
          : locked ? 'border border-dashed border-stone-300 bg-stone-50 text-slate-400'
            : 'border border-brand-600 bg-white text-brand-700 hover:bg-brand-50'
      }`}
    >
      {attempt ? <><LineIcon name="check" strokeWidth={2.5} />{`${TEST_LABELS[kind]} ${attempt.score}/${attempt.total}`}</> : TEST_LABELS[kind]}
    </button>
  );
}

// Takes the pre-test or post-test, or shows the result. Each test has its own
// questions; the correct answers show only after the post-test.
// postWaiting: why the post-test isn't open yet.
function TestPanel({ moduleId, kind, test, completed, postReady, postWaiting, onTaken }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const label = TEST_LABELS[kind];
  const attempt = test[kind];
  const open = kind === 'pre' ? test.preOpen : postReady;
  const questions = test.questions || [];
  const answeredCount = questions.filter((question) => answers[question.id] !== undefined).length;

  async function submit(event) {
    event.preventDefault();
    if (answeredCount < questions.length) return;
    setSaving(true);
    setError('');
    try {
      await axiosClient.post(`/elevate/tests/module/${moduleId}/${kind}`, { answers });
      await onTaken();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit the test.');
      setSaving(false);
    }
  }

  let body;
  if (attempt && kind === 'pre') {
    body = (
      <div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-sm text-emerald-800">Your pre-test score</p>
          <p className="text-3xl font-extrabold tabular-nums text-emerald-900">{attempt.score} of {attempt.total}</p>
        </div>
        <p className="mt-3 text-sm text-slate-600">After you study the materials, the post-test shows what you learned.</p>
      </div>
    );
  } else if (attempt && kind === 'post') {
    const share = (result) => (result.total ? result.score / result.total : 0);
    const gain = test.pre ? share(attempt) - share(test.pre) : null;
    body = (
      <div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          {test.pre && (
            <>
              <div>
                <p className="text-sm text-slate-600">Pre-test</p>
                <p className="text-2xl font-bold tabular-nums text-slate-700">{test.pre.score} of {test.pre.total}</p>
              </div>
              <span className="text-2xl text-emerald-700" aria-hidden="true">→</span>
            </>
          )}
          <div>
            <p className="text-sm text-emerald-800">Post-test</p>
            <p className="text-3xl font-extrabold tabular-nums text-emerald-900">{attempt.score} of {attempt.total}</p>
          </div>
          {gain !== null && (
            <p className="ml-auto text-sm font-semibold text-emerald-800">
              {gain > 0 ? 'Better than your pre-test. Well done!' : gain === 0 ? 'The same as your pre-test.' : 'Lower than your pre-test.'}
            </p>
          )}
        </div>
        {test.review?.length > 0 && (
          <ol className="mt-5 space-y-3">
            {test.review.map((item, index) => (
              <li key={item.questionId ?? index} className="rounded-xl border border-stone-200 p-4">
                <p className="text-sm font-medium text-slate-900">
                  <span className={item.correct ? 'text-emerald-600' : 'text-red-600'} aria-label={item.correct ? 'Correct' : 'Not correct'}>{item.correct ? '✓' : '✗'}</span>{' '}
                  {index + 1}. {item.prompt}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {item.options.map((option, optionIndex) => (
                    <li key={optionIndex} className={optionIndex === item.correctOption ? 'font-semibold text-emerald-700' : optionIndex === item.selected ? 'text-red-600 line-through' : 'text-slate-500'}>
                      {String.fromCharCode(65 + optionIndex)}. {option}
                      {optionIndex === item.selected && <span className="ml-1 text-xs font-normal no-underline">(your answer)</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  } else if (open && questions.length) {
    body = (
      <form onSubmit={submit}>
        <p className="mb-4 text-sm text-slate-600">
          {kind === 'pre'
            ? `Before you start, answer these ${questions.length} questions to show what you already know. It's fine not to know them yet! You take it once and see your score.`
            : `${questions.length} questions about what you learned. You take it once.`}
        </p>
        <ol className="space-y-4">
          {questions.map((question, index) => (
            <li key={question.id} className="rounded-xl border border-stone-200 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">{index + 1}. {question.prompt}</p>
              <div className="grid gap-2" role="radiogroup" aria-label={`Question ${index + 1}`}>
                {question.options.map((option, optionIndex) => {
                  const selected = answers[question.id] === optionIndex;
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAnswers((previous) => ({ ...previous, [question.id]: optionIndex }))}
                      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${selected ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white hover:border-brand-300'}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${selected ? 'border-current' : 'border-stone-300 text-slate-400'}`}>{String.fromCharCode(65 + optionIndex)}</span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={answeredCount < questions.length || saving} className="rounded-lg bg-accent-500 px-6 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
            {saving ? 'Submitting…' : `Submit ${label.toLowerCase()}`}
          </button>
          <span className="text-sm text-slate-500">{answeredCount} of {questions.length} answered</span>
        </div>
      </form>
    );
  } else if (completed) {
    body = <p className="text-sm text-slate-600">This topic is completed. You didn&apos;t take the {label.toLowerCase()}.</p>;
  } else if (kind === 'post' && test.counts.post) {
    body = (
      <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-600">
        {test.pre ? postWaiting : 'Take the pre-test first.'}
      </p>
    );
  } else {
    body = <p className="text-sm text-slate-600">There&apos;s no {label.toLowerCase()} for this topic right now.</p>;
  }

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        {label}{test.counts[kind] ? ` · ${test.counts[kind]} question${test.counts[kind] === 1 ? '' : 's'}` : ''}
      </p>
      <h3 className="mb-4 mt-1 text-lg font-semibold text-slate-900">
        {kind === 'pre' ? 'What do you know already?' : 'What did you learn?'}
      </h3>
      {body}
    </article>
  );
}

// The Materials pill in the row of steps, between the pre-test and the post-test.
function MaterialsStep({ count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      className={`flex h-9 items-center rounded-full border border-brand-600 bg-white px-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 ${active ? 'ring-2 ring-brand-600 ring-offset-2' : ''}`}
    >
      Materials{count ? ` (${count})` : ''}
    </button>
  );
}

// The face-to-face sessions the specialist set on this topic. Learners get a
// notification when one is set, and say they'll attend to save their seat.
function FaceToFaceSessions({ sessions, firstName, onChange }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function toggle(session) {
    setBusy(session.moduleSessionId);
    setError('');
    try {
      const url = `/sessions/open/${session.moduleSessionId}/join`;
      await (session.joined ? axiosClient.delete(url) : axiosClient.post(url));
      await onChange();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[17px] font-semibold text-slate-900">Face-to-face sessions</h2>
      {sessions.length ? (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.moduleSessionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{formatSessionRange(session.startsAt, session.endsAt)}</p>
                <p className="text-sm text-slate-600">{session.place}</p>
              </div>
              {session.joined ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><LineIcon name="check" strokeWidth={2.5} />You&apos;re attending</span>
                  <button type="button" disabled={busy !== null} onClick={() => toggle(session)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-stone-100 disabled:opacity-50">Can&apos;t make it</button>
                </div>
              ) : session.full ? (
                <span className="text-sm text-slate-500">Full</span>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => toggle(session)} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-50">
                  {busy === session.moduleSessionId ? 'Saving…' : 'I’ll attend'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-600">
          {firstName} hasn&apos;t set a face-to-face session yet. You&apos;ll get a notification when they do.
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

// Where the module page opens: the pre-test if it's waiting, the post-test
// once it's open or taken, else the materials.
function startingStep(loaded) {
  if (loaded.test?.preOpen) return 'pre';
  if (loaded.test && (loaded.test.postOpen || loaded.test.post)) return 'post';
  return 'materials';
}

// The module page: the pre-test, the specialist's materials, then the
// post-test, which the specialist opens when the learner is ready. Below them,
// the face-to-face sessions the specialist set on the topic.
export default function ModulePage() {
  const { moduleId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [resources, setResources] = useState([]);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState('materials'); // 'pre', 'materials' or 'post'
  const stepsRef = useRef(null); // the steps, for the header's next-step button

  const load = useCallback(async () => {
    try {
      const [moduleResponse, listResponse] = await Promise.all([
        axiosClient.get(`/elevate/activities/module/${moduleId}`),
        axiosClient.get('/modules', { params: { moduleId, limit: 1 } }),
      ]);
      const loaded = moduleResponse.data.data;
      setData(loaded);
      setCurrent(startingStep(loaded));
      const listed = listResponse.data.data[0];
      setResources(listed ? await withFileLinks(listed) : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open this module.');
    }
  }, [moduleId]);

  useEffect(() => { load(); }, [load]);

  // After a test: fresh data, staying on this step.
  async function refresh() {
    const response = await axiosClient.get(`/elevate/activities/module/${moduleId}`);
    setData(response.data.data);
  }

  if (user?.userType === 'specialist') return <Navigate to={`/modules?topic=${moduleId}`} replace />;

  if (error) {
    return (
      <AppLayout>
        <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
        <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{error}</p>
      </AppLayout>
    );
  }
  if (!data) return <AppLayout><SkeletonLines lines={8} label="Loading the module…" className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6" /></AppLayout>;

  const { module, specialist, faceToFace, completed, test } = data;
  const firstName = specialist.name.split(' ')[0];
  const preFirst = Boolean(test?.preOpen);
  const postReady = Boolean(test?.postOpen);
  const postWaiting = `${firstName} opens your post-test when you're ready. Study the materials in the meantime.`;
  const chatLink = data.conversationId ? `/modules?tab=${completed ? 'completed' : 'ongoing'}&chat=${data.conversationId}` : '/modules';

  // The header's one next step: go to that step and scroll down to it.
  function goTo(step) {
    setCurrent(step);
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => stepsRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }));
  }
  // When completed, the congratulations below has the certificate buttons.
  let next = null;
  if (completed) next = null;
  else if (!test) next = { note: `${firstName} hasn't added the pre-test yet. Start with the materials.` };
  else if (preFirst) next = { label: 'Take the pre-test', onClick: () => goTo('pre') };
  else if (postReady) next = { label: 'Take the post-test', onClick: () => goTo('post') };
  else if (test.post) next = { note: `Done! ${firstName} will mark you completed.` };
  else if (resources.length) next = { label: 'Study the materials', onClick: () => goTo('materials') };
  else next = { note: `${firstName} opens your post-test next.` };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
        <ModuleHero module={module} specialist={specialist} completed={completed} chatLink={chatLink} next={next} />

        {completed && data.certificate && (
          <CompletionCelebration
            userId={user?.id}
            learnerName={user?.fullName}
            module={module}
            certificate={data.certificate}
            test={test}
            nextTopic={data.nextTopic}
          />
        )}

        <section ref={stepsRef} className="mt-7 scroll-mt-6">
          <h2 className="mb-3 text-[17px] font-semibold text-slate-900">Steps</h2>
          <ol className="mb-4 flex flex-wrap items-center gap-2" aria-label="Steps">
            {test && <li><TestStep kind="pre" attempt={test.pre} active={current === 'pre'} onClick={() => setCurrent('pre')} /></li>}
            <li><MaterialsStep count={resources.length} active={current === 'materials'} onClick={() => setCurrent('materials')} /></li>
            {test && <li><TestStep kind="post" attempt={test.post} active={current === 'post'} locked={!test.post && !postReady} onClick={() => setCurrent('post')} /></li>}
          </ol>

          {current === 'materials' && (
            <article className="rounded-2xl border border-stone-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Materials from {firstName}</p>
              <h3 className="mb-4 mt-1 text-lg font-semibold text-slate-900">Study these before the post-test</h3>
              <MaterialsList resources={resources} />
              {postReady && (
                <button type="button" onClick={() => setCurrent('post')} className="mt-4 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550">Take the post-test →</button>
              )}
            </article>
          )}
          {(current === 'pre' || current === 'post') && test && (
            <TestPanel
              key={current}
              moduleId={moduleId}
              kind={current}
              test={test}
              completed={completed}
              postReady={postReady}
              postWaiting={postWaiting}
              onTaken={refresh}
            />
          )}
          {!test && current !== 'materials' && (
            <div className="rounded-2xl border border-stone-200 bg-white"><EmptyState icon="pencil" compact title="No pre-test yet">{firstName} hasn&apos;t added the pre-test and post-test yet.</EmptyState></div>
          )}
        </section>

        {!completed && !faceToFace?.onlineOnly && <FaceToFaceSessions sessions={data.sessions || []} firstName={firstName} onChange={refresh} />}
      </div>
    </AppLayout>
  );
}
