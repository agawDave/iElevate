import { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { DetailPanel } from '../admin/Directory';

// A beneficiary asked this specialist for a recommendation for their career
// portfolio. The specialist writes it (and can edit it later) or declines.
export default function RecommendationPanel({ recommendation, learnerName, moduleTitle, onClose, onChanged }) {
  const [text, setText] = useState(recommendation.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const firstName = learnerName.split(' ')[0];

  async function run(action, fallback) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged?.();
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || fallback);
      setBusy(false);
    }
  }

  function save(event) {
    event.preventDefault();
    run(() => axiosClient.put(`/elevate/portfolio/recommendations/${recommendation.id}/write`, { body: text }), 'Could not save the recommendation.');
  }

  function decline() {
    if (!window.confirm(`Tell ${firstName} you can't write a recommendation right now?`)) return;
    run(() => axiosClient.post(`/elevate/portfolio/recommendations/${recommendation.id}/decline`), 'Could not decline the request.');
  }

  return (
    <DetailPanel open title={`Recommendation · ${learnerName}`} onClose={onClose}>
      <p className="text-sm text-slate-600">
        {firstName} asked you for a recommendation for <span className="font-medium text-slate-800">{moduleTitle}</span>. It appears in their career portfolio with your name, and employers may read it.
      </p>
      {recommendation.note && <p className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm italic text-slate-700">&ldquo;{recommendation.note}&rdquo;</p>}
      <form onSubmit={save} className="mt-4">
        <label className="text-sm font-medium text-slate-700">
          Your recommendation
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            maxLength={3000}
            placeholder={`What can ${firstName} do well? How did they work during this topic?`}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" disabled={!text.trim() || busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? 'Saving…' : recommendation.status === 'written' ? 'Save changes' : 'Send recommendation'}
          </button>
          {recommendation.status === 'requested' && (
            <button type="button" disabled={busy} onClick={decline} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-stone-50">Decline</button>
          )}
        </div>
      </form>
    </DetailPanel>
  );
}
