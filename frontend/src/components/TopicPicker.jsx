import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';
import SelectAllControls from './SelectAllControls';
import { SkeletonLines } from './ui/Skeleton';

// The specialist's teaching topics on My Teaching Plan, one phase at a time.
export default function TopicPicker({ onSaved }) {
  const [topics, setTopics] = useState([]);
  const [phaseList, setPhaseList] = useState([]);
  const [phase, setPhase] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([axiosClient.get('/skills/elevate-topics'), axiosClient.get('/skills/me')])
      .then(([topicResponse, profileResponse]) => {
        if (!active) return;
        const available = topicResponse.data.data;
        const availableIds = new Set(available.map((topic) => Number(topic.skillId)));
        setTopics(available);
        setPhaseList(topicResponse.data.phases || []);
        setPhase(topicResponse.data.phases?.[0]?.number ?? null);
        setSelectedIds(profileResponse.data.data
          .filter((skill) => skill.relation_type === 'teaches' && availableIds.has(Number(skill.skill_id)))
          .map((skill) => Number(skill.skill_id)));
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the ELEVATE topics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Topics by phase number (topic.phase is "ELEVATE Phase N").
  const topicsByPhase = useMemo(() => {
    const groups = new Map();
    topics.forEach((topic) => {
      const number = Number(String(topic.phase).match(/\d+/)?.[0]);
      groups.set(number, [...(groups.get(number) || []), topic]);
    });
    return groups;
  }, [topics]);
  const phaseTopics = topicsByPhase.get(phase) || [];
  const selectedIn = (number) => (topicsByPhase.get(number) || []).filter((topic) => selectedIds.includes(Number(topic.skillId))).length;

  function toggleTopic(skillId) {
    const id = Number(skillId);
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setMessage('');
    setError('');
  }

  async function saveTopics(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axiosClient.put('/skills/me/teaching-topics', { skillIds: selectedIds });
      setMessage('Your teaching topics are saved.');
      onSaved?.(selectedIds);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your topics.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveTopics} className="space-y-5">
      <p className="text-sm text-slate-600">Choose the ELEVATE topics you teach, as listed for you in the training design. Beneficiaries who want these topics are matched to you when your preferred setup fits theirs.</p>

      {loading ? (
        <SkeletonLines lines={5} label="Loading ELEVATE topics…" />
      ) : topics.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Phase
              <select value={phase ?? ''} onChange={(event) => setPhase(Number(event.target.value))} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
                {phaseList.map((item) => (
                  <option key={item.number} value={item.number}>
                    {`Phase ${item.number} · ${item.name}${selectedIn(item.number) ? ` (${selectedIn(item.number)} selected)` : ''}`}
                  </option>
                ))}
              </select>
            </label>
            {phaseTopics.length > 0 && (
              <SelectAllControls
                label={`Phase ${phase} topics`}
                onCheckAll={() => {
                  const ids = phaseTopics.map((topic) => Number(topic.skillId));
                  setSelectedIds((current) => [...new Set([...current, ...ids])]);
                  setMessage('');
                }}
                onClear={() => {
                  const ids = new Set(phaseTopics.map((topic) => Number(topic.skillId)));
                  setSelectedIds((current) => current.filter((id) => !ids.has(id)));
                  setMessage('');
                }}
                allChecked={phaseTopics.every((topic) => selectedIds.includes(Number(topic.skillId)))}
                noneChecked={!phaseTopics.some((topic) => selectedIds.includes(Number(topic.skillId)))}
              />
            )}
          </div>
          {phaseTopics.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {phaseTopics.map((topic) => {
                const checked = selectedIds.includes(Number(topic.skillId));
                return (
                  <label
                    key={topic.skillId}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${checked ? 'border-brand-300 bg-brand-50' : 'border-stone-200 hover:bg-stone-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTopic(topic.skillId)}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{topic.title}</span>
                      <span className="block text-xs text-slate-500">{topic.hours} hours · {topic.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-sm text-slate-500">No modules in this phase yet.</p>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <button
        type="submit"
        // No topics means the load failed: saving an empty list would erase every teaching topic.
        disabled={loading || saving || !topics.length}
        className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-accent-550 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save teaching topics'}
      </button>
    </form>
  );
}
