import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function AddSkillForm({ onAdded, allowTeaching = true, allowLearning = true, moduleMode = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [modules, setModules] = useState([]);
  const [moduleSearchLoading, setModuleSearchLoading] = useState(false);
  const [moduleSearchError, setModuleSearchError] = useState('');
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [relationType, setRelationType] = useState('teaches');
  const [proficiency, setProficiency] = useState('beginner');
  const [yearsExperience, setYearsExperience] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!allowTeaching && allowLearning) setRelationType('wants_to_learn');
  }, [allowTeaching, allowLearning]);

  useEffect(() => {
    if (moduleMode || !query || selectedSkill) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      axiosClient.get('/skills/search', { params: { q: query } })
        .then((response) => setResults(response.data.data))
        .catch((err) => setError(err.response?.data?.message || 'Unable to search skills. Try again.'));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selectedSkill, moduleMode]);

  useEffect(() => {
    const search = query.trim();
    if (!moduleMode || search.length < 2 || selectedSkill) {
      setModules([]);
      setModuleSearchLoading(false);
      setModuleSearchError('');
      return undefined;
    }

    let active = true;
    setModuleSearchLoading(true);
    setModuleSearchError('');
    const handle = setTimeout(() => {
      axiosClient.get('/modules', { params: { q: search, limit: 8, sort: 'relevance' } })
        .then((response) => {
          if (active) setModules(Array.isArray(response.data?.data) ? response.data.data : []);
        })
        .catch((err) => {
          if (active) setModuleSearchError(err.response?.data?.message || 'Unable to search modules. Try again.');
        })
        .finally(() => {
          if (active) setModuleSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, selectedSkill, moduleMode]);

  function pickSkill(skill) {
    setSelectedSkill(skill);
    setQuery(skill.name);
    setResults([]);
  }

  function clearSelection() {
    setSelectedSkill(null);
    setQuery('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!selectedSkill) {
      setError(moduleMode ? 'Choose a module first' : 'Pick a skill from the list first');
      return;
    }
    setSubmitting(true);
    try {
      await axiosClient.post(moduleMode ? '/modules/preferences/me' : '/skills/me', moduleMode
        ? { moduleId: selectedSkill.id }
        : { skillId: selectedSkill.id, relationType, proficiency: relationType === 'teaches' ? proficiency : null, yearsExperience: relationType === 'teaches' && yearsExperience ? yearsExperience : null, description: description || null });
      clearSelection();
      setYearsExperience('');
      setDescription('');
      onAdded?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add skill');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder={moduleMode ? 'Search modules by title, description, or skill…' : 'Search for a skill…'}
          autoComplete="off"
          className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedSkill(null);
            setError('');
          }}
        />
        {moduleMode && query.trim().length > 0 && !selectedSkill && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
            {query.trim().length < 2 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Enter at least 2 characters to search modules.</p>
            ) : moduleSearchLoading ? (
              <p className="px-4 py-3 text-sm text-slate-500">Searching modules…</p>
            ) : moduleSearchError ? (
              <p role="alert" className="px-4 py-3 text-sm text-red-600">{moduleSearchError}</p>
            ) : modules.length ? (
              <>
                <ul className="max-h-64 overflow-auto">
                  {modules.map((module) => (
                    <li key={module.id}>
                      <button
                        type="button"
                        className="w-full border-b border-stone-100 px-4 py-3 text-left hover:bg-stone-50"
                        onClick={() => {
                          setSelectedSkill(module);
                          setQuery(module.title);
                          setModules([]);
                        }}
                      >
                        <span className="block text-sm font-medium text-slate-800">{module.title}</span>
                        <span className="block text-xs text-slate-500">{module.phase}{module.specialistName ? ` · ${module.specialistName}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-stone-100 px-4 py-2 text-xs text-slate-500">
                  Showing up to 8 matches. Refine your search to narrow the results.
                </p>
              </>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">No approved modules found. Try another title or skill.</p>
            )}
          </div>
        )}
        {!moduleMode && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg max-h-48 overflow-auto shadow-lg">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-stone-100"
                  onClick={() => pickSkill(s)}
                >
                  {s.name} <span className="text-slate-500">({s.category})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-3">
        {allowTeaching ? (
          <select
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            value={relationType}
            onChange={(e) => setRelationType(e.target.value)}
          >
            <option value="teaches">I can teach this</option>
            {allowLearning && <option value="wants_to_learn">I want to learn this</option>}
          </select>
        ) : (
          <span className="rounded-lg bg-brand-50 text-brand-700 px-3 py-2 text-sm">I want to learn this</span>
        )}

        {relationType === 'teaches' && (
          <>
            <select
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={proficiency}
              onChange={(e) => setProficiency(e.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Years"
              className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
            />
          </>
        )}
      </div>

      <input
        type="text"
        placeholder="Short description (optional)"
        className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-accent-500 hover:bg-accent-550 transition px-4 py-2 text-sm font-semibold text-brand-900 disabled:opacity-50"
      >
        {submitting ? 'Adding…' : moduleMode ? 'Add module' : 'Add skill'}
      </button>
    </form>
  );
}
