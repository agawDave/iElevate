import { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { runCodeTests } from '../lib/pyodide';

export default function CodeExercise({ question, onCompleted }) {
  const { functionName, starterCode, tests } = question.code;
  const [code, setCode] = useState(starterCode);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const allPassed = Boolean(results) && results.every((result) => result.passed);

  async function handleRun() {
    setRunning(true);
    setError('');
    setResults(null);
    try {
      const runResults = await runCodeTests({ code, tests });
      setResults(runResults);
    } catch (runError) {
      setError(runError?.message || 'Your code raised an error. Check the console output and try again.');
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!allPassed) return;
    setSubmitting(true);
    setError('');
    try {
      await axiosClient.post(`/modules/questions/${question.id}/complete`, {
        passed: true,
        code,
        testResults: results.map((result) => ({ testId: result.id, passed: result.passed })),
      });
      onCompleted?.();
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Could not save your submission.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleTab(event) {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const { selectionStart, selectionEnd, value } = event.target;
    setCode(`${value.slice(0, selectionStart)}    ${value.slice(selectionEnd)}`);
    requestAnimationFrame(() => {
      event.target.selectionStart = event.target.selectionEnd = selectionStart + 4;
    });
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Implement <code className="rounded bg-slate-100 px-1.5 py-0.5 text-brand-700">{functionName}(...)</code> below, then run the tests.
      </p>

      <textarea
        value={code}
        onChange={(e) => { setCode(e.target.value); setResults(null); }}
        onKeyDown={handleTab}
        spellCheck={false}
        className="w-full min-h-[220px] rounded-xl bg-slate-900 text-slate-100 font-mono text-sm p-4 outline-none focus:ring-2 focus:ring-brand-400"
      />

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="rounded-lg bg-slate-800 hover:bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run tests'}
        </button>
        <button
          type="button"
          onClick={() => { setCode(starterCode); setResults(null); setError(''); }}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Reset starter code
        </button>
        {results && (
          <span className={`text-sm font-semibold ${allPassed ? 'text-emerald-600' : 'text-slate-500'}`}>
            {results.filter((r) => r.passed).length} / {results.length} tests passed
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {results && (
        <div className="mt-5 space-y-2">
          {tests.map((test, index) => {
            const result = results.find((r) => r.id === test.id);
            return (
              <div
                key={test.id}
                className={`rounded-lg border px-4 py-3 text-sm ${result?.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-700">
                    {test.hidden ? `Hidden test ${index + 1}` : `Test ${index + 1}: ${test.assertion}`}
                  </span>
                  <span className={result?.passed ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
                    {result?.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
                {!test.hidden && !result?.passed && (result?.actual !== undefined || result?.error) && (
                  <p className="text-slate-500 mt-1">{result?.error ? `Error: ${result.error}` : `Got: ${result.actual}`}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allPassed || submitting}
          className="rounded-lg bg-accent-500 px-6 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40"
        >
          {submitting ? 'Saving...' : 'Submit & continue'}
        </button>
      </div>
    </div>
  );
}
