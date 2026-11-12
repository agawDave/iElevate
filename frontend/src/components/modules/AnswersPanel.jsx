import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { DetailPanel } from '../admin/Directory';
import { formatDay } from '../../lib/sessions';
import { ActivityFileLink } from './ActivityFiles';
import { EMPTY_RUBRIC, RUBRIC_ITEMS, RubricInput, RubricSummary } from './Rubric';
import { SkeletonLines } from '../ui/Skeleton';

const TYPE_LABELS = { multiple_choice: 'Multiple choice', written: 'Written task', file: 'File task' };
// Written and file answers are read and replied to; multiple choice checks itself.
const needsReading = (activity) => activity.type !== 'multiple_choice' && activity.answer && !activity.answer.reviewedAt;

function ReplyForm({ answer, onSent }) {
  const [text, setText] = useState(answer.feedback || '');
  const [rubric, setRubric] = useState(answer.rubric || EMPTY_RUBRIC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scored = RUBRIC_ITEMS.filter((item) => rubric[item.key]).length;
  async function send(event) {
    event.preventDefault();
    if (scored > 0 && scored < RUBRIC_ITEMS.length) {
      setError('Score all three rubric items, or clear them.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axiosClient.post(`/elevate/activities/answers/${answer.id}/review`, { feedback: text, rubric: scored ? rubric : null });
      onSent();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your reply.');
      setSaving(false);
    }
  }
  return (
    <form onSubmit={send} className="mt-2">
      <label className="text-xs font-medium text-slate-600">
        Your reply
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={2000} placeholder="Good work! Next time, try…" className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <RubricInput value={rubric} onChange={setRubric} />
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
        {saving ? 'Sending…' : text.trim() || scored ? 'Send reply' : 'Mark as read'}
      </button>
    </form>
  );
}

const scoreText = (attempt) => (attempt ? `${attempt.score} of ${attempt.total}` : 'not taken');

// The learner's pre-test and post-test: the scores, and each question right or wrong.
function TestResults({ tests }) {
  const { pre, post } = tests;
  const rows = [];
  [pre, post].forEach((attempt, column) => {
    (attempt?.questions || []).forEach((item) => {
      let row = rows.find((entry) => entry.questionId === item.questionId);
      if (!row) {
        row = { questionId: item.questionId, prompt: item.prompt, results: [null, null] };
        rows.push(row);
      }
      row.results[column] = item.correct;
    });
  });
  const mark = (value) => (value === null ? <span className="text-slate-400">—</span>
    : value ? <span className="font-bold text-emerald-600" aria-label="Correct">✓</span>
      : <span className="font-bold text-red-600" aria-label="Not correct">✗</span>);
  return (
    <section className="mb-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="font-semibold text-slate-900">Pre-test {scoreText(pre)} → Post-test {scoreText(post)}</p>
      <p className="mt-0.5 text-sm text-slate-600">
        {!pre ? 'Not taken yet. The activities open once they take it.'
          : !post ? 'The post-test opens when they finish all the activities.'
            : post.score > pre.score ? `${post.score - pre.score} more correct after the activities.`
              : post.score === pre.score ? 'The same score both times.' : 'A lower score the second time.'}
      </p>
      {rows.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-wide text-slate-500">
              <th className="py-1 font-medium">Question</th>
              <th className="w-16 py-1 text-center font-medium">Before</th>
              <th className="w-16 py-1 text-center font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.questionId ?? index} className="border-t border-brand-100">
                <td className="py-1.5 pr-2 text-slate-800">{index + 1}. {row.prompt}</td>
                <td className="py-1.5 text-center">{mark(row.results[0])}</td>
                <td className="py-1.5 text-center">{mark(row.results[1])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// A specialist reads one learner's answers to their activities for a topic,
// and replies to written and file tasks.
export default function AnswersPanel({ moduleId, beneficiaryId, moduleTitle, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await axiosClient.get('/elevate/activities/answers', { params: { moduleId, beneficiaryId } });
      setData(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the answers.');
    }
  }, [moduleId, beneficiaryId]);

  useEffect(() => { load(); }, [load]);

  const done = data?.activities.filter((activity) => activity.done).length || 0;
  const toReview = data?.activities.filter(needsReading).length || 0;

  return (
    <DetailPanel open title={data ? `${data.learnerName} · ${moduleTitle}` : 'Answers'} onClose={onClose}>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!data && !error && <SkeletonLines lines={8} label="Loading their answers…" />}
      {data && (
        <>
          {(data.tests.questionCount > 0 || data.tests.pre || data.tests.post) && <TestResults tests={data.tests} />}
          <p className="mb-4 text-sm text-slate-600">
            {data.activities.length
              ? `${done} of ${data.activities.length} activities done${toReview ? ` · ${toReview} answer${toReview === 1 ? '' : 's'} to read` : ''}`
              : 'You have no activities for this topic yet. Add them from the topic card under All topics (Tests & activities).'}
          </p>
          <ol className="space-y-3">
            {data.activities.map((activity, index) => {
              const { answer } = activity;
              const needsReview = needsReading(activity);
              return (
                <li key={activity.id} className={`rounded-xl border p-4 ${needsReview ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{index + 1}. {TYPE_LABELS[activity.type]}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                      !answer ? 'bg-stone-100 text-slate-500'
                        : needsReview ? 'bg-amber-100 text-amber-800'
                          : activity.done ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                    >
                      {!answer ? 'Not answered' : needsReview ? 'To read' : activity.type !== 'multiple_choice' ? 'Replied' : activity.done ? 'Correct' : 'Not yet right'}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm font-medium text-slate-900">{activity.prompt}</p>
                  {activity.type === 'multiple_choice' && answer && (
                    <p className="mt-2 text-sm text-slate-700">
                      Answered <span className="font-semibold">{activity.options[answer.selectedOption]}</span>
                      {answer.correct ? ' ✓' : ` (correct: ${activity.options[activity.correctOption]})`}
                      <span className="text-slate-500"> · {answer.attempts} tr{answer.attempts === 1 ? 'y' : 'ies'}</span>
                    </p>
                  )}
                  {activity.type !== 'multiple_choice' && answer && (
                    <>
                      <p className="mt-2 text-xs text-slate-500">Sent {formatDay(answer.submittedAt)}</p>
                      {answer.file && <div className="mt-1"><ActivityFileLink kind="answer" id={answer.id} file={answer.file} /></div>}
                      {answer.text && <div className="mt-1 whitespace-pre-line rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-slate-800">{answer.text}</div>}
                      {answer.reviewedAt && editing !== activity.id ? (
                        <div className="mt-2 text-sm">
                          <p className="text-slate-700"><span className="font-semibold">Your reply:</span> {answer.feedback || 'Marked as read.'}</p>
                          <RubricSummary rubric={answer.rubric} className="mt-0.5" />
                          <button type="button" onClick={() => setEditing(activity.id)} className="mt-1 text-xs font-medium text-brand-600 hover:underline">Change reply</button>
                        </div>
                      ) : (
                        <ReplyForm answer={answer} onSent={async () => { setEditing(null); await load(); onChanged?.(); }} />
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </DetailPanel>
  );
}
