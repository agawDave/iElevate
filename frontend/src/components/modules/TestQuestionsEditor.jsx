import { useCallback, useEffect, useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { useConfirm } from '../../context/ConfirmContext';
import ChoiceInputs, { enterGoesTo, fillChoiceBoxes, filledChoiceCount, packChoices } from './ChoiceInputs';

const EMPTY_FORM = { id: null, prompt: '', options: fillChoiceBoxes(), correctOption: 0 };
const letter = (index) => String.fromCharCode(65 + index);

// Loads a topic's pre-test / post-test questions for the specialist.
export function useTestQuestions(moduleId) {
  const [test, setTest] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!moduleId) return;
    try {
      const response = await axiosClient.get('/elevate/tests', { params: { moduleId } });
      setTest(response.data.data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the test.');
    }
  }, [moduleId]);
  useEffect(() => { setTest(null); load(); }, [load]);
  return { test, error, reload: load };
}

// The specialist writes the test: multiple-choice questions, one correct choice
// each. One at a time here, or many at once with Paste questions (onPaste).
// Rendered with key={moduleId}, so a new topic starts it fresh.
export default function TestQuestionsEditor({ moduleId, topicTitle, test, onChanged, onPaste, initialNotice = '' }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState(''); // shown in the form, next to its buttons
  const [notice, setNotice] = useState(initialNotice);
  const [saving, setSaving] = useState(false);
  const promptBox = useRef(null);
  const firstChoice = useRef(null);
  const questions = test?.questions || [];
  const takenBy = test ? test.taken.pre : 0;

  const update = (changes) => setForm((previous) => ({ ...previous, ...changes }));

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!form.prompt.trim()) { setFormError('Write the question first.'); return; }
    const choices = packChoices(form.options, form.correctOption);
    if (choices.error) { setFormError(choices.error); return; }
    setSaving(true);
    setError('');
    setFormError('');
    setNotice('');
    const body = { moduleId, prompt: form.prompt, ...choices };
    try {
      const response = form.id
        ? await axiosClient.put(`/elevate/tests/${form.id}`, body)
        : await axiosClient.post('/elevate/tests', body);
      setNotice(form.id ? response.data.message : 'Question added. Type the next one.');
      setForm(EMPTY_FORM);
      await onChanged();
      promptBox.current?.focus();
    } catch (requestError) {
      setFormError(requestError.response?.data?.message || 'Could not save the question.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(question) {
    if (!await confirm({ title: 'Remove this question?', message: 'It comes out of the pre-test and the post-test.', confirmLabel: 'Remove', danger: true })) return;
    setError('');
    try {
      const response = await axiosClient.delete(`/elevate/tests/${question.id}`);
      setNotice(response.data.message);
      if (form.id === question.id) setForm(EMPTY_FORM);
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove the question.');
    }
  }

  const input = 'mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';
  return (
    <div>
      <p className="mb-4 text-sm text-slate-600">
        Your learners in {topicTitle} answer these before learning (pre-test), and again after their face-to-face sessions, once you open it (post-test).
      </p>
      {takenBy > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {takenBy} learner{takenBy === 1 ? ' has' : 's have'} taken the pre-test. Their scores stay as they are. If you change the questions now, their post-test won&apos;t be the same test.
        </p>
      )}
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {onPaste && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3">
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-sm font-semibold text-slate-900">Have your questions in Word or Google Docs?</p>
            <p className="text-xs text-slate-600">Paste them all at once instead of typing them one by one.</p>
          </div>
          <button type="button" onClick={onPaste} className="shrink-0 rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">Paste questions</button>
        </div>
      )}

      <ol className="mb-6 space-y-3">
        {questions.map((question, index) => (
          <li key={question.id} className={`rounded-xl border p-4 ${form.id === question.id ? 'border-brand-400 ring-2 ring-brand-100' : 'border-stone-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-900"><span className="text-slate-500">{index + 1}.</span> {question.prompt}</p>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => { setForm({ id: question.id, prompt: question.prompt, options: fillChoiceBoxes(question.options), correctOption: question.correctOption }); setFormError(''); promptBox.current?.focus(); }} className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Edit</button>
                <button type="button" onClick={() => remove(question)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">Remove</button>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {question.options.map((option, optionIndex) => (
                <li key={optionIndex} className={optionIndex === question.correctOption ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
                  {letter(optionIndex)}. {option}{optionIndex === question.correctOption ? ' ✓' : ''}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {!questions.length && <li className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-slate-500">No questions yet. Paste them, or add the first one below. Five to ten questions is a good test.</li>}
      </ol>

      <form onSubmit={save} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="mb-3 font-semibold text-slate-900">{form.id ? 'Edit question' : 'Add a question'}</p>
        <label className="block text-sm font-medium text-slate-700">
          Question
          <textarea ref={promptBox} value={form.prompt} onChange={(event) => update({ prompt: event.target.value })} onKeyDown={enterGoesTo(firstChoice)} rows={2} maxLength={1000} placeholder="e.g. Where do you change the look of a WordPress site?" className={input} />
        </label>
        <div className="mt-3">
          <ChoiceInputs name="test-correct-option" options={form.options} correctOption={form.correctOption} onChange={update} firstRef={firstChoice} />
        </div>
        {formError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving || !form.prompt.trim() || filledChoiceCount(form.options) < 2} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add question'}
          </button>
          {form.id && <button type="button" onClick={() => { setForm(EMPTY_FORM); setFormError(''); }} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>}
        </div>
      </form>
    </div>
  );
}
