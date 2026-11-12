import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import MaterialsList from '../components/modules/MaterialsList';
import { ActivityFileLink, FilePicker } from '../components/modules/ActivityFiles';
import { RubricSummary } from '../components/modules/Rubric';
import { withFileLinks } from '../lib/moduleFiles';
import { ACTIVITY_FILE_HINT } from '../lib/activityFiles';
import LineIcon from '../components/ui/LineIcon';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonLines } from '../components/ui/Skeleton';
import ModuleHero from '../components/modules/ModuleHero';
import CompletionCelebration from '../components/modules/CompletionCelebration';

const TYPE_HEADINGS = { multiple_choice: 'Choose the answer', written: 'Written task', file: 'File task' };

function MultipleChoice({ activity, locked, onAnswered }) {
  const [choice, setChoice] = useState(activity.done ? activity.selectedOption : null);
  const [result, setResult] = useState(activity.done ? 'correct' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function check() {
    if (choice === null) return;
    setSaving(true);
    setError('');
    try {
      const response = await axiosClient.post(`/elevate/activities/${activity.id}/answer`, { selectedOption: choice });
      if (response.data.data.correct) {
        setResult('correct');
        onAnswered({ ...activity, done: true, selectedOption: choice });
      } else {
        setResult('wrong');
        setChoice(null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not check your answer.');
    } finally {
      setSaving(false);
    }
  }

  const done = result === 'correct';
  return (
    <div>
      <div className="grid gap-2.5" role="radiogroup" aria-label="Choices">
        {activity.options.map((option, index) => {
          const selected = choice === index;
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={done || locked}
              onClick={() => { setChoice(index); setResult(''); }}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                done && selected ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                  : selected ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white hover:border-brand-300'
              } disabled:cursor-default`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${selected ? 'border-current' : 'border-stone-300 text-slate-400'}`}>
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      {done && <p role="status" className="mt-4 flex items-center gap-1.5 font-semibold text-emerald-700"><LineIcon name="check" strokeWidth={2.5} />Correct!</p>}
      {result === 'wrong' && <p role="alert" className="mt-4 font-medium text-red-600">Not quite. Read the choices again and try once more.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      {!done && !locked && (
        <button type="button" disabled={choice === null || saving} onClick={check} className="mt-4 rounded-lg bg-accent-500 px-6 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
          {saving ? 'Checking…' : 'Check answer'}
        </button>
      )}
    </div>
  );
}

function WrittenTask({ activity, specialistName, locked, onAnswered }) {
  const [editing, setEditing] = useState(!activity.done);
  const [text, setText] = useState(activity.answerText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstName = specialistName.split(' ')[0];

  async function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError('');
    try {
      await axiosClient.post(`/elevate/activities/${activity.id}/answer`, { answerText: text });
      setEditing(false);
      onAnswered({ ...activity, done: true, answerText: text.trim(), feedback: '', rubric: null, reviewedAt: null });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your answer.');
    } finally {
      setSaving(false);
    }
  }

  if (editing && !locked) {
    return (
      <form onSubmit={submit}>
        <label htmlFor={`answer-${activity.id}`} className="text-sm font-medium text-slate-700">Your answer</label>
        <textarea
          id={`answer-${activity.id}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          maxLength={5000}
          className="mt-1 block w-full rounded-xl border border-stone-300 px-4 py-3 text-sm leading-6 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          placeholder="Write your answer here."
        />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={!text.trim() || saving} className="rounded-lg bg-accent-500 px-6 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
            {saving ? 'Sending…' : activity.done ? 'Send new answer' : 'Send answer'}
          </button>
          {activity.done && <button type="button" onClick={() => { setText(activity.answerText); setEditing(false); }} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>}
        </div>
      </form>
    );
  }
  return (
    <div className="space-y-3">
      <div className="whitespace-pre-line rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-800">{activity.answerText}</div>
      <SpecialistReply activity={activity} firstName={firstName} />
      {!locked && <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-brand-600 hover:underline">Change my answer</button>}
    </div>
  );
}

function SpecialistReply({ activity, firstName }) {
  return activity.reviewedAt ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <p className="font-semibold">{firstName} replied</p>
      <p className="mt-1 whitespace-pre-line">{activity.feedback || 'Seen ✓'}</p>
      <RubricSummary rubric={activity.rubric} className="mt-1" />
    </div>
  ) : (
    <p className="text-sm text-slate-500">Sent. Waiting for {firstName} to read it.</p>
  );
}

// The specialist's file: download it, then send back a file, a photo of a
// paper answer, typed text, or several of these.
function FileTask({ activity, specialistName, locked, onSaved }) {
  const [editing, setEditing] = useState(!activity.done);
  const [text, setText] = useState(activity.answerText);
  const [file, setFile] = useState(null); // a new file to send
  const [keepSent, setKeepSent] = useState(Boolean(activity.answerFile)); // keep the file already sent
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstName = specialistName.split(' ')[0];
  const hasSentFile = Boolean(activity.answerFile) && keepSent && !file;
  const canSend = Boolean(file) || hasSentFile || Boolean(text.trim());

  // Starts or cancels editing from what was last sent.
  function resetTo(nextEditing) {
    setText(activity.answerText);
    setFile(null);
    setKeepSent(Boolean(activity.answerFile));
    setError('');
    setEditing(nextEditing);
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSend) return;
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('answerText', text);
    if (file) form.append('file', file);
    else if (hasSentFile) form.append('keepFile', '1');
    try {
      await axiosClient.post(`/elevate/activities/${activity.id}/answer`, form);
      setFile(null);
      setEditing(false);
      await onSaved();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your answer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {activity.file && (
        <div>
          <p className="mb-1.5 text-sm text-slate-600">{locked ? 'The file:' : `Download ${firstName}'s file, answer it, then send your answer below.`}</p>
          <ActivityFileLink kind="task" id={activity.id} file={activity.file} />
        </div>
      )}

      {editing && !locked ? (
        <form onSubmit={submit} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Your answer</p>
          <p className="mb-3 text-xs text-slate-500">Send your filled-in file or a photo of your answer on paper, or type it. You can do both.</p>
          {hasSentFile && (
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <span className="truncate">Sent: {activity.answerFile.name}</span>
              <button type="button" onClick={() => setKeepSent(false)} aria-label={`Remove ${activity.answerFile.name}`} className="px-1 text-lg leading-none text-slate-400 hover:text-red-600">×</button>
            </div>
          )}
          <FilePicker
            file={file}
            onChange={setFile}
            buttonText={hasSentFile ? 'Replace file or photo' : 'Attach file or photo'}
            hint={ACTIVITY_FILE_HINT}
          />
          <label htmlFor={`answer-${activity.id}`} className="mt-3 block text-sm font-medium text-slate-700">
            Type your answer or a note <span className="font-normal text-slate-500">(optional if you attached a file)</span>
          </label>
          <textarea
            id={`answer-${activity.id}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            maxLength={5000}
            className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={!canSend || saving} className="rounded-lg bg-accent-500 px-6 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
              {saving ? 'Sending…' : activity.done ? 'Send new answer' : 'Send answer'}
            </button>
            {activity.done && <button type="button" onClick={() => resetTo(false)} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>}
          </div>
        </form>
      ) : activity.done && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Your answer</p>
          {activity.answerFile && <ActivityFileLink kind="answer" id={activity.answerId} file={activity.answerFile} />}
          {activity.answerText && <div className="whitespace-pre-line rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-800">{activity.answerText}</div>}
          <SpecialistReply activity={activity} firstName={firstName} />
          {!locked && <button type="button" onClick={() => resetTo(true)} className="text-sm font-medium text-brand-600 hover:underline">Change my answer</button>}
        </div>
      )}
    </div>
  );
}

const TEST_LABELS = { pre: 'Pre-test', post: 'Post-test' };

// The Pre-test / Post-test pill in the row of steps.
function TestStep({ kind, attempt, active, locked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      title={locked ? (kind === 'post' ? 'Opens when you finish all the activities' : undefined) : undefined}
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
function TestPanel({ moduleId, kind, test, completed, postReady, progress, hasActivities, onTaken, onStartActivities }) {
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
        <p className="mt-3 text-sm text-slate-600">This shows what you knew before the activities. At the end, you&apos;ll answer the same questions again in the post-test to see what you learned.</p>
        {hasActivities && !completed && (
          <button type="button" onClick={onStartActivities} className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Start the activities →</button>
        )}
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
        {!test.pre ? 'Take the pre-test first.' : `The post-test opens when you finish all the activities (${progress.done} of ${progress.total} done).`}
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

// Where the module page opens: the pre-test if it's waiting, else the first
// unfinished activity, else the post-test.
function startingStep(loaded) {
  if (loaded.test?.preOpen) return 'pre';
  const firstOpen = loaded.activities.findIndex((activity) => !activity.done);
  if (firstOpen !== -1) return firstOpen;
  if (loaded.test && (loaded.test.postOpen || loaded.test.post)) return 'post';
  return 0;
}

// The module page: a learner answers their specialist's activities for a topic.
export default function ModulePage() {
  const { moduleId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [resources, setResources] = useState([]);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0); // 'pre', an activity's index, or 'post'
  const stepsRef = useRef(null); // the tests and activities, for the header's next-step button

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

  // After a file answer or a test: fresh data, staying on this step.
  async function refresh() {
    const response = await axiosClient.get(`/elevate/activities/module/${moduleId}`);
    setData(response.data.data);
  }

  if (user?.userType === 'specialist') return <Navigate to={`/modules?topic=${moduleId}`} replace />;

  function answered(updated) {
    setData((previous) => {
      const activities = previous.activities.map((activity) => (activity.id === updated.id ? updated : activity));
      return { ...previous, activities, progress: { total: activities.length, done: activities.filter((activity) => activity.done).length } };
    });
  }

  function nextOpen() {
    const after = data.activities.findIndex((activity, index) => index > current && !activity.done);
    const any = data.activities.findIndex((activity) => !activity.done);
    setCurrent(after !== -1 ? after : any !== -1 ? any : current);
  }

  if (error) {
    return (
      <AppLayout>
        <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
        <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{error}</p>
      </AppLayout>
    );
  }
  if (!data) return <AppLayout><SkeletonLines lines={8} label="Loading the module…" className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6" /></AppLayout>;

  const { module, specialist, activities, progress, completed, test } = data;
  const firstName = specialist.name.split(' ')[0];
  const onTest = current === 'pre' || current === 'post';
  const activity = onTest ? null : activities[current];
  const allDone = progress.total > 0 && progress.done === progress.total;
  // The activities wait for the pre-test; the post-test waits for the activities.
  const preFirst = Boolean(test?.preOpen);
  const postReady = Boolean(test) && !completed && Boolean(test.pre) && !test.post && test.questionCount > 0 && progress.done >= progress.total;
  const firstUnfinished = Math.max(0, activities.findIndex((item) => !item.done));

  async function goToPost() {
    // Finishing the last activity opens the post-test: load its questions.
    if (postReady && !test.questions.length) await refresh();
    setCurrent('post');
  }
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
  else if (preFirst) next = { label: 'Take the pre-test', onClick: () => goTo('pre') };
  else if (postReady) next = { label: 'Take the post-test', onClick: async () => { await goToPost(); goTo('post'); } };
  else if (activities.length && progress.done < progress.total) next = { label: `${progress.done ? 'Continue' : 'Start'}: Activity ${firstUnfinished + 1} of ${activities.length}`, onClick: () => goTo(firstUnfinished) };
  else if (activities.length) next = { note: `Done! ${firstName} will look over your work and mark you completed.` };
  else next = { note: `${firstName} hasn't added activities yet. Start with the materials.` };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
        <ModuleHero module={module} specialist={specialist} progress={progress} completed={completed} chatLink={chatLink} next={next} />

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
          <h2 className="mb-3 text-[17px] font-semibold text-slate-900">{test ? 'Tests and activities' : 'Activities'}</h2>
          {!activities.length && !test ? (
            <div className="rounded-2xl border border-stone-200 bg-white">
              <EmptyState icon="pencil" title="No activities yet" action={{ to: chatLink, label: `Chat with ${firstName}` }}>
                {firstName} hasn&apos;t added activities for this topic yet. Read the materials, and ask in the chat if you have questions.
              </EmptyState>
            </div>
          ) : (
            <>
              <ol className="mb-4 flex flex-wrap items-center gap-2" aria-label="Steps">
                {test && (
                  <li><TestStep kind="pre" attempt={test.pre} active={current === 'pre'} onClick={() => setCurrent('pre')} /></li>
                )}
                {activities.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setCurrent(index)}
                      disabled={preFirst}
                      title={preFirst ? 'Take the pre-test first' : undefined}
                      aria-current={index === current ? 'step' : undefined}
                      aria-label={`Activity ${index + 1}${item.done ? ', done' : ''}`}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        index === current ? 'ring-2 ring-brand-600 ring-offset-2' : ''
                      } ${item.done ? 'bg-emerald-600 text-white' : 'border border-stone-300 bg-white text-slate-600 hover:border-brand-400'}`}
                    >
                      {item.done ? <LineIcon name="check" strokeWidth={3} /> : index + 1}
                    </button>
                  </li>
                ))}
                {test && (
                  <li><TestStep kind="post" attempt={test.post} active={current === 'post'} locked={!test.post && !postReady} onClick={goToPost} /></li>
                )}
              </ol>

              {preFirst && current !== 'pre' && (
                <p className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">Start with the pre-test. The activities open after it.</p>
              )}

              {allDone && !onTest && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p>
                    {completed ? 'All activities done.'
                      : postReady ? 'You finished all the activities! Now take the post-test to see what you learned.'
                        : `You finished all the activities! ${firstName} will look over your work and mark you completed.`}
                  </p>
                  {postReady && <button type="button" onClick={goToPost} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Take the post-test →</button>}
                </div>
              )}

              {onTest && (
                <TestPanel
                  key={current}
                  moduleId={moduleId}
                  kind={current}
                  test={test}
                  completed={completed}
                  postReady={postReady}
                  progress={progress}
                  hasActivities={activities.length > 0}
                  onTaken={refresh}
                  onStartActivities={() => setCurrent(firstUnfinished)}
                />
              )}

              {!onTest && !activities.length && (
                <div className="rounded-2xl border border-stone-200 bg-white"><EmptyState icon="pencil" compact title="No activities yet">{firstName} hasn&apos;t added activities for this topic yet.</EmptyState></div>
              )}

              {activity && !preFirst && (
                <article key={activity.id} className="rounded-2xl border border-stone-200 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    Activity {current + 1} of {activities.length} · {TYPE_HEADINGS[activity.type]}
                  </p>
                  <h3 className="mb-4 mt-1 whitespace-pre-line text-lg font-semibold text-slate-900">{activity.prompt}</h3>
                  {activity.type === 'multiple_choice' && <MultipleChoice activity={activity} locked={completed} onAnswered={answered} />}
                  {activity.type === 'written' && <WrittenTask activity={activity} specialistName={specialist.name} locked={completed} onAnswered={answered} />}
                  {activity.type === 'file' && <FileTask activity={activity} specialistName={specialist.name} locked={completed} onSaved={refresh} />}
                  {activity.done && !allDone && (
                    <button type="button" onClick={nextOpen} className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Next activity →</button>
                  )}
                </article>
              )}
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
