import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { SkeletonBlock } from '../ui/Skeleton';

const EMPTY_FORM = { id: null, prompt: '', options: ['', ''], correctOption: 0 };
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

// The summary box at the top of the Activities panel.
export function TestSummaryBox({ test, onEdit }) {
  const count = test?.questions.length || 0;
  const taken = test ? test.taken.pre : 0;
  return (
    <section className="mb-5 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">Pre-test &amp; post-test</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {!test ? <span role="status" className="block pt-1"><SkeletonBlock className="h-3.5 w-72 max-w-full" /><span className="sr-only">Loading the test…</span></span>
              : count
                ? `${count} question${count === 1 ? '' : 's'}, checked automatically. Learners take it before the activities and again at the end.${taken ? ` ${taken} took the pre-test.` : ''}`
                : 'No test yet. Add multiple-choice questions, and learners take them before the activities (pre-test) and again at the end (post-test).'}
          </p>
        </div>
        <button type="button" onClick={onEdit} disabled={!test} className="shrink-0 rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
          {count ? 'Edit questions' : 'Add questions'}
        </button>
      </div>
    </section>
  );
}

// The specialist writes the test: multiple-choice questions, one correct choice each.
export default function TestQuestionsEditor({ moduleId, topicTitle, test, onChanged, onBack }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const questions = test?.questions || [];
  const takenBy = test ? test.taken.pre : 0;

  useEffect(() => { setForm(EMPTY_FORM); setError(''); setNotice(''); }, [moduleId]);

  const update = (changes) => setForm((previous) => ({ ...previous, ...changes }));
  const setOption = (index, value) => update({ options: form.options.map((option, i) => (i === index ? value : option)) });
  function removeOption(index) {
    const options = form.options.filter((_, i) => i !== index);
    const correctOption = form.correctOption === index ? 0 : form.correctOption > index ? form.correctOption - 1 : form.correctOption;
    update({ options, correctOption });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const body = { moduleId, prompt: form.prompt, options: form.options, correctOption: form.correctOption };
    try {
      const response = form.id
        ? await axiosClient.put(`/elevate/tests/${form.id}`, body)
        : await axiosClient.post('/elevate/tests', body);
      setNotice(response.data.message);
      setForm(EMPTY_FORM);
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save the question.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(question) {
    if (!window.confirm('Remove this question from the test?')) return;
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
      <button type="button" onClick={onBack} className="mb-3 text-sm text-slate-500 hover:text-brand-600">← Back to activities</button>
      <h3 className="text-lg font-semibold text-slate-900">Pre-test &amp; post-test</h3>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Your learners in {topicTitle} answer these questions before the activities (pre-test) and the same questions again after finishing them (post-test), so you both see what they learned. They see their score, but not the correct answers until after the post-test.
      </p>
      {takenBy > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {takenBy} learner{takenBy === 1 ? ' has' : 's have'} taken the pre-test. Their scores stay as they are. If you change the questions now, their post-test won&apos;t be the same test.
        </p>
      )}
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <ol className="mb-6 space-y-3">
        {questions.map((question, index) => (
          <li key={question.id} className={`rounded-xl border p-4 ${form.id === question.id ? 'border-brand-400 ring-2 ring-brand-100' : 'border-stone-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-900"><span className="text-slate-500">{index + 1}.</span> {question.prompt}</p>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setForm({ id: question.id, prompt: question.prompt, options: question.options, correctOption: question.correctOption })} className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Edit</button>
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
        {!questions.length && <li className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-slate-500">No questions yet. Add the first one below. Five to ten questions is a good test.</li>}
      </ol>

      <form onSubmit={save} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="mb-3 font-semibold text-slate-900">{form.id ? 'Edit question' : 'Add a question'}</p>
        <label className="block text-sm font-medium text-slate-700">
          Question
          <textarea value={form.prompt} onChange={(event) => update({ prompt: event.target.value })} rows={2} maxLength={1000} placeholder="e.g. Where do you change the look of a WordPress site?" className={input} />
        </label>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-slate-700">Choices <span className="font-normal text-slate-500">(mark the correct one)</span></legend>
          <div className="mt-1 space-y-2">
            {form.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input type="radio" name="test-correct-option" checked={form.correctOption === index} onChange={() => update({ correctOption: index })} aria-label={`Choice ${letter(index)} is correct`} className="h-4 w-4 accent-emerald-600" />
                <input value={option} onChange={(event) => setOption(index, event.target.value)} maxLength={190} placeholder={`Choice ${letter(index)}`} className="block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                {form.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(index)} aria-label={`Remove choice ${letter(index)}`} className="px-1 text-lg leading-none text-slate-400 hover:text-red-600">×</button>
                )}
              </div>
            ))}
          </div>
          {form.options.length < 4 && (
            <button type="button" onClick={() => update({ options: [...form.options, ''] })} className="mt-2 text-sm font-medium text-brand-600 hover:underline">+ Add a choice</button>
          )}
        </fieldset>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving || !form.prompt.trim() || form.options.some((option) => !option.trim())} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add question'}
          </button>
          {form.id && <button type="button" onClick={() => setForm(EMPTY_FORM)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>}
        </div>
      </form>
    </div>
  );
}
