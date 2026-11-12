import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';
import SelectAllControls from './SelectAllControls';
import { SkeletonLines } from './ui/Skeleton';

const COPY = {
  wants_to_learn: {
    intro: 'Choose the ELEVATE topics you want to learn. You won’t pick a specialist; the system assigns the one whose schedule, learning mode, and location fit yours.',
    endpoint: '/skills/me/learning-goals',
    saved: 'Your topics are saved. Your matched specialists are on the Modules page.',
    empty: 'Select at least one topic to continue.',
    button: 'Save topics',
  },
  teaches: {
    intro: 'Choose the ELEVATE topics you teach, as listed for you in the training design. Beneficiaries who want these topics are matched to you when your circumstances fit theirs.',
    endpoint: '/skills/me/teaching-topics',
    saved: 'Your teaching topics are saved.',
    empty: 'Select at least one topic you teach.',
    button: 'Save teaching topics',
  },
};

export default function TopicPicker({ relation = 'wants_to_learn', onSaved, requireSelection = false, submitLabel }) {
  const copy = COPY[relation];
  const [topics, setTopics] = useState([]);
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
        setSelectedIds(profileResponse.data.data
          .filter((skill) => skill.relation_type === relation && availableIds.has(Number(skill.skill_id)))
          .map((skill) => Number(skill.skill_id)));
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the ELEVATE topics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [relation]);

  const phases = useMemo(() => {
    const groups = new Map();
    topics.forEach((topic) => {
      const list = groups.get(topic.phase) || [];
      list.push(topic);
      groups.set(topic.phase, list);
    });
    return [...groups.entries()];
  }, [topics]);

  function toggleTopic(skillId) {
    const id = Number(skillId);
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setMessage('');
    setError('');
  }

  async function saveTopics(event) {
    event.preventDefault();
    if (requireSelection && !selectedIds.length) {
      setError(copy.empty);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axiosClient.put(copy.endpoint, { skillIds: selectedIds });
      setMessage(copy.saved);
      onSaved?.(selectedIds);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your topics.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveTopics} className="space-y-5">
      <p className="text-sm text-slate-600">{copy.intro}</p>

      {!loading && topics.length > 0 && (
        <div className="flex justify-end">
          <SelectAllControls
            label="all topics"
            onCheckAll={() => { setSelectedIds(topics.map((topic) => Number(topic.skillId))); setMessage(''); setError(''); }}
            onClear={() => { setSelectedIds([]); setMessage(''); setError(''); }}
            allChecked={selectedIds.length === topics.length}
            noneChecked={!selectedIds.length}
          />
        </div>
      )}
      {loading ? (
        <SkeletonLines lines={5} label="Loading ELEVATE topics…" />
      ) : phases.map(([phase, phaseTopics]) => (
        <fieldset key={phase}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-accent-600">{phase}</legend>
            <SelectAllControls
              label={`${phase} topics`}
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
          </div>
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
        </fieldset>
      ))}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <button
        type="submit"
        disabled={loading || saving || (requireSelection && selectedIds.length === 0)}
        className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-accent-550 disabled:opacity-50"
      >
        {saving ? 'Saving…' : submitLabel || copy.button}
      </button>
    </form>
  );
}
