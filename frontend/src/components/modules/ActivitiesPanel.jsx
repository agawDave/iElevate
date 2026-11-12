import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { DetailPanel } from '../admin/Directory';
import { ActivityFileLink, FilePicker } from './ActivityFiles';
import TestQuestionsEditor, { TestSummaryBox, useTestQuestions } from './TestQuestionsEditor';
import { ACTIVITY_FILE_HINT } from '../../lib/activityFiles';
import { SkeletonLines } from '../ui/Skeleton';

// file: a new file to upload; currentFile: the file a file task already has.
const EMPTY_FORM = { id: null, type: 'multiple_choice', prompt: '', options: ['', ''], correctOption: 0, file: null, currentFile: null };
const TYPE_LABELS = { multiple_choice: 'Multiple choice', written: 'Written task', file: 'File task' };
const PROMPT_LABELS = { multiple_choice: 'Question', written: 'Task', file: 'Instructions' };
const PLACEHOLDERS = {
  multiple_choice: 'e.g. What is the difference between a post and a page?',
  written: 'e.g. Make a page called “About us” and describe what you put on it.',
  file: 'e.g. Download the worksheet, fill in your weekly budget, and send it back.',
};

// A specialist writes the activities their learners answer for a topic.
export default function ActivitiesPanel({ topicId, topics = [], onClose, onChanged }) {
  const [currentId, setCurrentId] = useState(topicId);
  const [activities, setActivities] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const { test, reload: reloadTest } = useTestQuestions(currentId);
  const topicTitle = topics.find((topic) => String(topic.id) === String(currentId))?.title || 'this topic';

  useEffect(() => { setCurrentId(topicId); }, [topicId]);
  useEffect(() => { setShowTest(false); }, [currentId]);

  const load = useCallback(async () => {
    if (!currentId) return;
    try {
      const response = await axiosClient.get('/elevate/activities', { params: { moduleId: currentId } });
      setActivities(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the activities.');
    }
  }, [currentId]);

  useEffect(() => {
    setActivities(null);
    setForm(EMPTY_FORM);
    setError('');
    setNotice('');
    load();
  }, [load]);

  const update = (changes) => setForm((previous) => ({ ...previous, ...changes }));
  const setOption = (index, value) => update({ options: form.options.map((option, i) => (i === index ? value : option)) });
  function removeOption(index) {
    const options = form.options.filter((_, i) => i !== index);
    const correctOption = form.correctOption === index ? 0 : form.correctOption > index ? form.correctOption - 1 : form.correctOption;
    update({ options, correctOption });
  }

  async function save(event) {
    event.preventDefault();
    const editing = activities.find((activity) => activity.id === form.id);
    if (editing && editing.type !== form.type && editing.answers > 0
      && !window.confirm(`Changing the kind of activity deletes the ${editing.answers} answer${editing.answers === 1 ? '' : 's'} learners already gave. Continue?`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    let body = { moduleId: currentId, type: form.type, prompt: form.prompt, options: form.options, correctOption: form.correctOption };
    if (form.type === 'file') {
      // A form with the file; without a new file, an edit keeps the current one.
      body = new FormData();
      body.append('moduleId', currentId);
      body.append('type', 'file');
      body.append('prompt', form.prompt);
      if (form.file) body.append('file', form.file);
    }
    try {
      const response = form.id
        ? await axiosClient.put(`/elevate/activities/${form.id}`, body)
        : await axiosClient.post('/elevate/activities', body);
      setNotice(response.data.message);
      setForm(EMPTY_FORM);
      await load();
      onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save the activity.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(activity) {
    const warning = activity.answers ? ` ${activity.answers} learner answer${activity.answers === 1 ? '' : 's'} to it will be deleted too.` : '';
    if (!window.confirm(`Remove this activity?${warning}`)) return;
    setError('');
    try {
      const response = await axiosClient.delete(`/elevate/activities/${activity.id}`);
      setNotice(response.data.message);
      if (form.id === activity.id) setForm(EMPTY_FORM);
      await load();
      onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove the activity.');
    }
  }

  const input = 'mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';
  return (
    <DetailPanel open={Boolean(topicId)} title={`Tests & activities · ${topicTitle}`} onClose={onClose}>
      {topics.length > 1 && (
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Topic
          <select value={currentId || ''} onChange={(event) => setCurrentId(event.target.value)} className={input}>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
      )}
      {showTest ? (
        <TestQuestionsEditor
          moduleId={currentId}
          topicTitle={topicTitle}
          test={test}
          onChanged={async () => { await reloadTest(); onChanged?.(); }}
          onBack={() => setShowTest(false)}
        />
      ) : (
      <>
      <TestSummaryBox test={test} onEdit={() => setShowTest(true)} />
      <p className="mb-4 text-sm text-slate-600">
        Your learners in {topicTitle} answer these on their module page, in this order. Multiple-choice answers are checked automatically. For a file task, learners download your file (a worksheet you made in Word, a PDF…) and send back their file, a photo of their answer, or a typed answer. You read written and file answers and reply.
      </p>
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!activities ? <SkeletonLines lines={6} label="Loading activities…" /> : (
        <ol className="mb-6 space-y-3">
          {activities.map((activity, index) => (
            <li key={activity.id} className={`rounded-xl border p-4 ${form.id === activity.id ? 'border-brand-400 ring-2 ring-brand-100' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  {index + 1}. {TYPE_LABELS[activity.type]}{activity.answers ? ` · ${activity.answers} answered` : ''}
                </p>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setForm({ ...EMPTY_FORM, id: activity.id, type: activity.type, prompt: activity.prompt, options: activity.options.length ? activity.options : ['', ''], correctOption: activity.correctOption ?? 0, currentFile: activity.file })} className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Edit</button>
                  <button type="button" onClick={() => remove(activity)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">Remove</button>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm font-medium text-slate-900">{activity.prompt}</p>
              {activity.type === 'multiple_choice' && (
                <ul className="mt-2 space-y-1 text-sm">
                  {activity.options.map((option, optionIndex) => (
                    <li key={optionIndex} className={optionIndex === activity.correctOption ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
                      {String.fromCharCode(65 + optionIndex)}. {option}{optionIndex === activity.correctOption ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
              )}
              {activity.type === 'file' && <div className="mt-2"><ActivityFileLink kind="task" id={activity.id} file={activity.file} /></div>}
            </li>
          ))}
          {!activities.length && <li className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-slate-500">No activities yet. Add the first one below.</li>}
        </ol>
      )}

      <form onSubmit={save} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="mb-3 font-semibold text-slate-900">{form.id ? 'Edit activity' : 'Add an activity'}</p>
        <div className="mb-3 flex gap-2" role="radiogroup" aria-label="Kind of activity">
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.type === value}
              onClick={() => update({ type: value })}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${form.type === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-slate-700 hover:bg-stone-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-sm font-medium text-slate-700">
          {PROMPT_LABELS[form.type]}
          <textarea
            value={form.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            rows={3}
            maxLength={1000}
            placeholder={PLACEHOLDERS[form.type]}
            className={input}
          />
        </label>
        {form.type === 'file' && (
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">File learners will download</p>
            {form.currentFile && !form.file && (
              <div className="mb-2 mt-1">
                <ActivityFileLink kind="task" id={form.id} file={form.currentFile} note="current file" />
              </div>
            )}
            <div className="mt-1">
              <FilePicker
                file={form.file}
                onChange={(file) => update({ file })}
                buttonText={form.currentFile ? 'Replace file' : 'Choose file'}
                hint={`${ACTIVITY_FILE_HINT}${form.currentFile ? ' Replacing it keeps the answers learners already sent.' : ''}`}
              />
            </div>
          </div>
        )}
        {form.type === 'multiple_choice' && (
          <fieldset className="mt-3">
            <legend className="text-sm font-medium text-slate-700">Choices <span className="font-normal text-slate-500">(mark the correct one)</span></legend>
            <div className="mt-1 space-y-2">
              {form.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={form.correctOption === index}
                    onChange={() => update({ correctOption: index })}
                    aria-label={`Choice ${String.fromCharCode(65 + index)} is correct`}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <input
                    value={option}
                    onChange={(event) => setOption(index, event.target.value)}
                    maxLength={190}
                    placeholder={`Choice ${String.fromCharCode(65 + index)}`}
                    className="block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(index)} aria-label={`Remove choice ${String.fromCharCode(65 + index)}`} className="px-1 text-lg leading-none text-slate-400 hover:text-red-600">×</button>
                  )}
                </div>
              ))}
            </div>
            {form.options.length < 4 && (
              <button type="button" onClick={() => update({ options: [...form.options, ''] })} className="mt-2 text-sm font-medium text-brand-600 hover:underline">+ Add a choice</button>
            )}
          </fieldset>
        )}
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving || !form.prompt.trim() || (form.type === 'file' && !form.file && !form.currentFile)} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add activity'}
          </button>
          {form.id && <button type="button" onClick={() => setForm(EMPTY_FORM)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>}
        </div>
      </form>
      </>
      )}
    </DetailPanel>
  );
}
