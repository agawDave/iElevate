import { useMemo, useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import LineIcon from '../ui/LineIcon';
import { leftoverText, rangeOf, readPastedQuestions } from '../../lib/pasteQuestions';

// The specialist pastes a whole quiz instead of typing questions one by one.
// Every question shows in the preview as it's read; the ones with a problem
// are flagged and stay in the box when the rest are added.

const PLACEHOLDER = '1. Which function adds up a range of numbers?\na. AVERAGE\n*b. SUM\nc. COUNT\n\n2. What symbol does every formula start with?\na. +\nb. =\nc. #\nAnswer: b';
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const letter = (index) => String.fromCharCode(65 + index);

// Adds them to the pre-test or the post-test (kind). savedPrompts: the questions it already has; room: how many more fit.
export default function PasteQuestions({ moduleId, kind, text, onTextChange, savedPrompts, room, takenBy = 0, onBack, onAdded }) {
  const box = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const questions = useMemo(() => readPastedQuestions(text, savedPrompts), [text, savedPrompts]);
  const ready = questions.filter((question) => !question.problem);
  const needFix = questions.length - ready.length;
  const tooMany = ready.length > room;

  function showInBox(question) {
    const element = box.current;
    if (!element) return;
    const [start, end] = rangeOf(element.value, question);
    element.focus({ preventScroll: true });
    element.setSelectionRange(start, end);
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 22;
    element.scrollTop = Math.max(0, (question.start - 1) * lineHeight);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  }

  async function add() {
    setSaving(true);
    setError('');
    try {
      await axiosClient.post('/elevate/tests/bulk', {
        moduleId,
        kind,
        questions: ready.map(({ prompt, options, correctOption }) => ({ prompt, options, correctOption })),
      });
      const left = questions.filter((question) => question.problem);
      onTextChange(leftoverText(text, left));
      await onAdded({ added: ready.length, left: left.length });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not add the questions.');
      setSaving(false);
    }
  }

  let note = '';
  if (tooMany) note = `This test has room for ${room} more question${room === 1 ? '' : 's'} (30 at most). Remove some from the box.`;
  else if (needFix) note = needFix === 1 ? 'The one that needs a fix stays in the box, so you can fix it after.' : `The ${needFix} that need a fix stay in the box, so you can fix them after.`;
  else if (ready.length) note = 'They go after the questions this test already has.';

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-sm text-slate-500 hover:text-brand-600">← Back to questions</button>
      <h3 className="text-lg font-semibold text-slate-900">Add questions to the {kind === 'pre' ? 'pre-test' : 'post-test'}</h3>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Copy your quiz from Word, Google Docs or a text file and paste it below, or check the one read from your Word file. iELEVATE shows each question here first. Nothing is added until you click Add.
      </p>

      {takenBy > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {takenBy} learner{takenBy === 1 ? ' has' : 's have'} taken this test. Their scores stay as they are; learners who take it later get the new questions too.
        </p>
      )}

      <label htmlFor="paste-box" className="block text-sm font-medium text-slate-700">Your questions</label>
      <textarea
        id="paste-box"
        ref={box}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        rows={12}
        spellCheck={false}
        placeholder={PLACEHOLDER}
        className="mt-1 block w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      <ul className="mb-5 mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
        <li>Start each choice with <b className="text-slate-800">a.</b> <b className="text-slate-800">b.</b> <b className="text-slate-800">c.</b> or <b className="text-slate-800">d.</b> (2 to 4 choices)</li>
        <li>Put <b className="text-slate-800">*</b> before the correct choice, or add a line like <b className="text-slate-800">Answer: b</b></li>
        <li>Numbers like <b className="text-slate-800">1.</b> and blank lines are fine. They&apos;re ignored.</li>
      </ul>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">Preview</h4>
        <div aria-live="polite" className="flex flex-wrap gap-1.5">
          {ready.length > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{ready.length} ready</span>}
          {needFix > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{needFix} need{needFix === 1 ? 's' : ''} a fix</span>}
        </div>
      </div>
      {questions.length ? (
        <ol className="space-y-2">
          {questions.map((question, index) => (
            <li key={`${question.start}-${index}`} className={`rounded-xl border px-4 py-3 ${question.problem ? 'border-amber-300 bg-amber-50' : 'border-stone-200'}`}>
              {question.problem && (
                <div className="mb-2 flex items-start gap-2 text-sm text-amber-800">
                  <LineIcon name="alert" className="mt-0.5 h-4 w-4" />
                  <div>
                    <p>{question.problem}</p>
                    <button type="button" onClick={() => showInBox(question)} className="font-semibold underline underline-offset-2 hover:text-amber-900">Show it in the box</button>
                  </div>
                </div>
              )}
              <p className="text-sm font-medium text-slate-900">
                <span className="text-slate-500">{index + 1}.</span> {question.prompt || <em className="font-normal text-slate-400">No question text</em>}
              </p>
              {question.options.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-sm">
                  {question.options.map((option, optionIndex) => (
                    <li key={optionIndex} className={optionIndex === question.correctOption ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
                      {letter(optionIndex)}. {option || <em className="text-slate-400">empty</em>}{optionIndex === question.correctOption ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-slate-500">Paste your questions in the box above. Each one shows here as iELEVATE reads it.</p>
      )}

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Pinned to the panel's bottom edge (-bottom-4 makes up for the panel's padding). */}
      <div className="sticky -bottom-4 -mx-5 mt-4 border-t border-stone-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={add} disabled={saving || !ready.length || tooMany} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
            {saving ? 'Adding…' : ready.length ? `Add ${count(ready.length, 'question', 'questions')}` : 'Add questions'}
          </button>
          <button type="button" onClick={onBack} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>
        </div>
        {note && <p className={`mt-1.5 text-xs ${tooMany ? 'font-medium text-amber-800' : 'text-slate-500'}`}>{note}</p>}
      </div>
    </div>
  );
}
