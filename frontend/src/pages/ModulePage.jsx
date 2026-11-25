import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import MaterialsList from '../components/modules/MaterialsList';
import { withFileLinks } from '../lib/moduleFiles';
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
      title={locked && kind === 'post' ? 'Opens after your face-to-face sessions' : undefined}
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

// Takes the pre-test or post-test, or shows the result. The same questions
// are used both times; the correct answers show only after the post-test.
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
        <p className="mt-3 text-sm text-slate-600">After your face-to-face sessions, you&apos;ll answer the same questions again in the post-test to see what you learned.</p>
      </div>
    );
  } else if (attempt && kind === 'post') {
    const gain = test.pre ? attempt.score - test.pre.score : null;
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
              {gain > 0 ? `${gain} more correct than before. Well done!` : gain === 0 ? 'The same as before.' : `${-gain} fewer than before.`}
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
            : `The same questions as your pre-test. Let's see what you learned! You take it once.`}
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
  } else if (kind === 'post' && test.questionCount) {
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
        {label}{test.questionCount ? ` · ${test.questionCount} question${test.questionCount === 1 ? '' : 's'}` : ''}
      </p>
      <h3 className="mb-4 mt-1 text-lg font-semibold text-slate-900">
        {kind === 'pre' ? 'What do you know already?' : 'What did you learn?'}
      </h3>
      {body}
    </article>
  );
}

// The Face-to-face pill in the row of steps: hours so far, of the module's hours.
function FaceToFaceStep({ faceToFace, active, onClick }) {
  const done = faceToFace.ready;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${active ? 'ring-2 ring-brand-600 ring-offset-2' : ''} ${
        done ? 'bg-emerald-600 text-white' : 'border border-brand-600 bg-white text-brand-700 hover:bg-brand-50'
      }`}
    >
      {done && <LineIcon name="check" strokeWidth={2.5} />}
      {faceToFace.onlineOnly ? 'Online' : `Face-to-face ${faceToFace.hoursDone}/${faceToFace.hours} h`}
    </button>
  );
}

// The face-to-face sessions between the pre-test and the post-test.
function FaceToFacePanel({ moduleId, faceToFace, firstName, done, postReady, onPost }) {
  const { hours, hoursDone, onlineOnly } = faceToFace;
  const percent = hours ? Math.min(100, Math.round((hoursDone / hours) * 100)) : 100;
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{onlineOnly ? 'Online' : 'Face-to-face sessions'}</p>
      {onlineOnly ? (
        <p className="mt-2 text-sm text-slate-600">You learn online, so you don&apos;t need face-to-face sessions. {firstName} opens your post-test.</p>
      ) : (
        <>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{hoursDone} <span className="text-lg font-semibold text-slate-500">of {hours} hours</span></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={hours} aria-valuenow={hoursDone} aria-label="Face-to-face hours">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {faceToFace.ready ? `Your face-to-face hours are done. ${firstName} opens your post-test.` : `Learn with ${firstName} face to face. Once your sessions reach ${hours} hours, ${firstName} opens your post-test.`}
          </p>
        </>
      )}
      {!done && (
        <div className="mt-4 flex flex-wrap gap-2">
          {postReady && <button type="button" onClick={onPost} className="rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550">Take the post-test →</button>}
          {!onlineOnly && !postReady && <Link to={`/sessions?moduleId=${moduleId}`} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Book a session →</Link>}
        </div>
      )}
    </article>
  );
}

// Where the module page opens: the pre-test if it's waiting, the post-test
// once it's open or taken, else the face-to-face sessions.
function startingStep(loaded) {
  if (loaded.test?.preOpen) return 'pre';
  if (loaded.test && (loaded.test.postOpen || loaded.test.post)) return 'post';
  return 'f2f';
}

// The module page: the pre-test, face-to-face sessions with the specialist,
// then the post-test, which the specialist opens once the hours are done.
export default function ModulePage() {
  const { moduleId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [resources, setResources] = useState([]);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState('f2f'); // 'pre', 'f2f' or 'post'
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
  const postWaiting = !faceToFace || faceToFace.ready
    ? `${firstName} opens your post-test after your face-to-face sessions.`
    : `Your post-test opens after your face-to-face sessions (${faceToFace.hoursDone} of ${faceToFace.hours} hours). ${firstName} opens it for you.`;
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
  else if (faceToFace && !faceToFace.ready) next = { label: 'Book a face-to-face session', to: `/sessions?moduleId=${module.id}` };
  else next = { note: `${firstName} opens your post-test next.` };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
        <ModuleHero module={module} specialist={specialist} faceToFace={faceToFace} completed={completed} chatLink={chatLink} next={next} />

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

        <section className="mt-7">
          <h2 className="mb-2 text-[17px] font-semibold text-slate-900">Materials</h2>
          <MaterialsList resources={resources} />
        </section>

        <section ref={stepsRef} className="mt-8 scroll-mt-6">
          <h2 className="mb-3 text-[17px] font-semibold text-slate-900">Steps</h2>
          <ol className="mb-4 flex flex-wrap items-center gap-2" aria-label="Steps">
            {test && <li><TestStep kind="pre" attempt={test.pre} active={current === 'pre'} onClick={() => setCurrent('pre')} /></li>}
            {faceToFace && <li><FaceToFaceStep faceToFace={faceToFace} active={current === 'f2f'} onClick={() => setCurrent('f2f')} /></li>}
            {test && <li><TestStep kind="post" attempt={test.post} active={current === 'post'} locked={!test.post && !postReady} onClick={() => setCurrent('post')} /></li>}
          </ol>

          {current === 'f2f' && faceToFace && (
            <FaceToFacePanel moduleId={module.id} faceToFace={faceToFace} firstName={firstName} done={completed || Boolean(test?.post)} postReady={postReady} onPost={() => setCurrent('post')} />
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
          {!test && current !== 'f2f' && (
            <div className="rounded-2xl border border-stone-200 bg-white"><EmptyState icon="pencil" compact title="No pre-test yet">{firstName} hasn&apos;t added the pre-test and post-test yet.</EmptyState></div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
