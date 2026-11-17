import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { DetailPanel } from '../admin/Directory';
import { ActivityFileLink, FilePicker } from './ActivityFiles';
import TestQuestionsEditor, { TestSummaryBox, useTestQuestions } from './TestQuestionsEditor';
import PasteQuestions from './PasteQuestions';
import ChoiceInputs, { enterGoesTo, fillChoiceBoxes, filledChoiceCount, packChoices } from './ChoiceInputs';
import { ACTIVITY_FILE_HINT } from '../../lib/activityFiles';
import { SkeletonLines } from '../ui/Skeleton';

// file: a new file to upload; currentFile: the file a file task already has.
const EMPTY_FORM = { id: null, type: 'multiple_choice', prompt: '', options: fillChoiceBoxes(), correctOption: 0, file: null, currentFile: null };
const TYPE_LABELS = { multiple_choice: 'Multiple choice', written: 'Written task', file: 'File task' };
const PROMPT_LABELS = { multiple_choice: 'Question', written: 'Task', file: 'Instructions' };
const PLACEHOLDERS = {
  multiple_choice: 'e.g. What is the difference between a post and a page?',
  written: 'e.g. Make a page called “About us” and describe what you put on it.',
  file: 'e.g. Download the worksheet, fill in your weekly budget, and send it back.',
};
const MAX_TEST_QUESTIONS = 30;
const MAX_ACTIVITIES = 50;

// A specialist writes the activities their learners answer for a topic, and the
// pre/post-test. Three screens: the activities, the test, and Paste questions
// (many multiple-choice questions at once, for either). start = 'test' opens
// straight on the test.
export default function ActivitiesPanel({ topicId, topics = [], onClose, onChanged, start = 'activities' }) {
  const [currentId, setCurrentId] = useState(topicId);
  const [activities, setActivities] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState(''); // shown in the form, next to its buttons
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState(start); // 'activities' | 'test' | 'paste'
  const [pasteFrom, setPasteFrom] = useState('activities');
  const [pasteTarget, setPasteTarget] = useState('activities');
  const [pasteText, setPasteText] = useState('');
  const [testNotice, setTestNotice] = useState('');
  const top = useRef(null);
  const shownTopic = useRef(topicId);
  const promptBox = useRef(null);
  const firstChoice = useRef(null);
  const { test, reload: reloadTest } = useTestQuestions(currentId);
  const topicTitle = topics.find((topic) => String(topic.id) === String(currentId))?.title || 'this topic';

  useEffect(() => { setCurrentId(topicId); }, [topicId]);
  // Another topic: back to its activities, with an empty paste box.
  useEffect(() => {
    if (String(shownTopic.current) === String(currentId)) return;
    shownTopic.current = currentId;
    setScreen('activities');
    setPasteText('');
    setTestNotice('');
  }, [currentId]);
  // Each screen starts at the top of the panel.
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); }, [screen]);

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
    setFormError('');
    setNotice('');
    load();
  }, [load]);

  const savedPrompts = useMemo(() => ({
    test: (test?.questions || []).map((question) => question.prompt),
    activities: (activities || []).filter((activity) => activity.type === 'multiple_choice').map((activity) => activity.prompt),
  }), [test, activities]);
  const room = {
    test: MAX_TEST_QUESTIONS - (test?.questions.length || 0),
    activities: MAX_ACTIVITIES - (activities?.length || 0),
  };

  function openPaste(from) {
    setPasteFrom(from);
    setPasteTarget(from === 'test' ? 'test' : 'activities');
    setNotice('');
    setScreen('paste');
  }

  function openTest() {
    setTestNotice('');
    setScreen('test');
  }

  async function pasted({ target, added, left }) {
    const stillThere = left ? ` ${left === 1 ? 'The one that needs a fix is' : `The ${left} that need a fix are`} still in the paste box.` : '';
    if (target === 'test') {
      await reloadTest();
      setTestNotice(`${added} question${added === 1 ? '' : 's'} added to your pre/post-test.${stillThere}`);
      setScreen('test');
    } else {
      await load();
      setError('');
      setNotice(`${added} multiple-choice activit${added === 1 ? 'y' : 'ies'} added.${stillThere}`);
      setScreen('activities');
    }
    onChanged?.();
  }

  const update = (changes) => setForm((previous) => ({ ...previous, ...changes }));

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!form.prompt.trim()) { setFormError(form.type === 'file' ? 'Write the instructions for the file.' : 'Write the question or task first.'); return; }
    let choices = {};
    if (form.type === 'multiple_choice') {
      choices = packChoices(form.options, form.correctOption);
      if (choices.error) { setFormError(choices.error); return; }
    }
    const editing = activities.find((activity) => activity.id === form.id);
    if (editing && editing.type !== form.type && editing.answers > 0
      && !window.confirm(`Changing the kind of activity deletes the ${editing.answers} answer${editing.answers === 1 ? '' : 's'} learners already gave. Continue?`)) return;
    setSaving(true);
    setError('');
    setFormError('');
    setNotice('');
    let body = { moduleId: currentId, type: form.type, prompt: form.prompt, ...choices };
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
      // Ready for the next one.
      if (!form.id) promptBox.current?.focus();
    } catch (requestError) {
      setFormError(requestError.response?.data?.message || 'Could not save the activity.');
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
  const multipleChoice = form.type === 'multiple_choice';
  return (
    <DetailPanel open={Boolean(topicId)} title={`Tests & activities · ${topicTitle}`} onClose={onClose}>
      <div ref={top} className="scroll-mt-4" />
      {topics.length > 1 && screen !== 'paste' && (
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Topic
          <select value={currentId || ''} onChange={(event) => setCurrentId(event.target.value)} className={input}>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
      )}
      {screen === 'paste' && (
        <PasteQuestions
          moduleId={currentId}
          target={pasteTarget}
          onTargetChange={setPasteTarget}
          text={pasteText}
          onTextChange={setPasteText}
          savedPrompts={savedPrompts}
          room={room}
          takenBy={test ? test.taken.pre : 0}
          backLabel={pasteFrom === 'test' ? 'Back to questions' : 'Back to activities'}
          onBack={() => setScreen(pasteFrom)}
          onAdded={pasted}
        />
      )}
      {screen === 'test' && (
        <TestQuestionsEditor
          key={currentId}
          moduleId={currentId}
          topicTitle={topicTitle}
          test={test}
          initialNotice={testNotice}
          onChanged={async () => { await reloadTest(); onChanged?.(); }}
          onBack={() => setScreen('activities')}
          onPaste={() => openPaste('test')}
        />
      )}
      {screen === 'activities' && (
      <>
      <TestSummaryBox test={test} onEdit={openTest} />
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
                  <button type="button" onClick={() => { setForm({ ...EMPTY_FORM, id: activity.id, type: activity.type, prompt: activity.prompt, options: fillChoiceBoxes(activity.options), correctOption: activity.correctOption ?? 0, currentFile: activity.file }); setFormError(''); }} className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Edit</button>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">{form.id ? 'Edit activity' : 'Add an activity'}</p>
          {!form.id && (
            <button type="button" onClick={() => openPaste('activities')} className="rounded-lg border border-brand-600 bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
              Paste many questions
            </button>
          )}
        </div>
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
            ref={promptBox}
            value={form.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            onKeyDown={multipleChoice ? enterGoesTo(firstChoice) : undefined}
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
        {multipleChoice && (
          <div className="mt-3">
            <ChoiceInputs name="correct-option" options={form.options} correctOption={form.correctOption} onChange={update} firstRef={firstChoice} />
          </div>
        )}
{formError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving || !form.prompt.trim() || (form.type === 'file' && !form.file && !form.currentFile) || (multipleChoice && filledChoiceCount(form.options) < 2)}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40"
          >
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add activity'}
          </button>
          {form.id && <button type="button" onClick={() => { setForm(EMPTY_FORM); setFormError(''); }} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>}
        </div>
      </form>
      </>
      )}
    </DetailPanel>
  );
}
