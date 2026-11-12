import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import SelectAllControls from './SelectAllControls';
import { SkeletonLines } from './ui/Skeleton';

// Skill-check Part D: per topic a specialist teaches, their level, the learner
// levels they take, a learner limit, certifications and earlier ELEVATE phases.
// Only advanced or expert specialists are matched; blank details don't block.

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const LEARNER_LEVELS = [
  { value: 'beginner', label: 'Beginners' },
  { value: 'developing', label: 'Developing learners' },
];

// The certifications the ELEVATE proposals cite for their trainers.
const KNOWN_CERTIFICATIONS = [
  'TESDA Computer Systems Servicing',
  'Microsoft Office Specialist',
  'CEFR-calibrated language trainer',
  'Certified virtual assistant trainer',
];

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function detailFromSkill(skill) {
  const certifications = skill.certifications || [];
  return {
    skillId: Number(skill.skill_id),
    title: skill.title,
    proficiency: skill.proficiency || '',
    yearsExperience: skill.years_experience ?? '',
    certifications: certifications.filter((item) => KNOWN_CERTIFICATIONS.includes(item)),
    otherCertification: certifications.filter((item) => !KNOWN_CERTIFICATIONS.includes(item)).join(', '),
    learnerLevels: skill.learner_levels?.length ? skill.learner_levels : LEARNER_LEVELS.map((level) => level.value),
    phasesTaught: skill.elevate_phases_taught || [],
    maxLearners: skill.max_learners ?? '',
  };
}

export default function TeachingDetailsForm({ refreshKey = 0 }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([axiosClient.get('/skills/elevate-topics'), axiosClient.get('/skills/me')])
      .then(([topicResponse, skillResponse]) => {
        if (!active) return;
        const titleBySkill = new Map(topicResponse.data.data.map((topic) => [Number(topic.skillId), topic.title]));
        const order = topicResponse.data.data.map((topic) => Number(topic.skillId));
        setDetails(skillResponse.data.data
          .filter((skill) => skill.relation_type === 'teaches' && titleBySkill.has(Number(skill.skill_id)))
          .sort((a, b) => order.indexOf(Number(a.skill_id)) - order.indexOf(Number(b.skill_id)))
          .map((skill) => detailFromSkill({ ...skill, title: titleBySkill.get(Number(skill.skill_id)) })));
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load your teaching topics.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  function update(skillId, changes) {
    setDetails((current) => current.map((detail) => (detail.skillId === skillId ? { ...detail, ...changes } : detail)));
    setError('');
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    const missingLevels = details.find((detail) => !detail.learnerLevels.length);
    if (missingLevels) {
      setError(`Choose at least one learner level for ${missingLevels.title}.`);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axiosClient.put('/skills/me/teaching-details', {
        topics: details.map((detail) => ({
          skillId: detail.skillId,
          proficiency: detail.proficiency || null,
          yearsExperience: detail.yearsExperience === '' ? null : Number(detail.yearsExperience),
          certifications: [
            ...detail.certifications,
            ...detail.otherCertification.split(',').map((item) => item.trim()).filter(Boolean),
          ],
          learnerLevels: detail.learnerLevels,
          phasesTaught: detail.phasesTaught,
          maxLearners: detail.maxLearners === '' ? null : Number(detail.maxLearners),
        })),
      });
      setMessage('Saved. Beneficiary matches are updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your teaching details.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonLines lines={4} label="Loading your teaching topics…" />;
  if (!details.length) {
    return <p className="text-sm text-slate-500">Save the topics you teach above, then describe each one here.</p>;
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {details.map((detail) => {
        const unqualified = ['beginner', 'intermediate'].includes(detail.proficiency);
        return (
          <fieldset key={detail.skillId} className="rounded-lg border border-stone-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">{detail.title}</legend>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`level-${detail.skillId}`} className="mb-1 block text-xs font-semibold text-slate-700">Your level</label>
                <select
                  id={`level-${detail.skillId}`}
                  value={detail.proficiency}
                  onChange={(event) => update(detail.skillId, { proficiency: event.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="">Not set</option>
                  {LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`years-${detail.skillId}`} className="mb-1 block text-xs font-semibold text-slate-700">Years using or teaching it</label>
                <input
                  id={`years-${detail.skillId}`}
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  value={detail.yearsExperience}
                  onChange={(event) => update(detail.skillId, { yearsExperience: event.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor={`limit-${detail.skillId}`} className="mb-1 block text-xs font-semibold text-slate-700">Learner limit for this topic</label>
                <input
                  id={`limit-${detail.skillId}`}
                  type="number"
                  min="1"
                  max="500"
                  placeholder="No limit"
                  value={detail.maxLearners}
                  onChange={(event) => update(detail.skillId, { maxLearners: event.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            {unqualified && (
              <p className="mt-2 text-xs text-amber-700">Only advanced or expert specialists are matched with learners for a topic.</p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-semibold text-slate-700">Learners you take</p><SelectAllControls label="learner levels" onCheckAll={() => update(detail.skillId, { learnerLevels: LEARNER_LEVELS.map((level) => level.value) })} onClear={() => update(detail.skillId, { learnerLevels: [] })} allChecked={detail.learnerLevels.length === LEARNER_LEVELS.length} noneChecked={!detail.learnerLevels.length} /></div>
                <div className="flex flex-wrap gap-2">
                  {LEARNER_LEVELS.map((level) => (
                    <label key={level.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={detail.learnerLevels.includes(level.value)}
                        onChange={() => update(detail.skillId, { learnerLevels: toggle(detail.learnerLevels, level.value) })}
                        className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                      />
                      {level.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-semibold text-slate-700">Taught it in ELEVATE before</p><SelectAllControls label="phases" onCheckAll={() => update(detail.skillId, { phasesTaught: [1, 2, 3, 4] })} onClear={() => update(detail.skillId, { phasesTaught: [] })} allChecked={detail.phasesTaught.length === 4} noneChecked={!detail.phasesTaught.length} /></div>
                <div className="flex flex-wrap gap-3">
                  {[1, 2, 3, 4].map((phase) => (
                    <label key={phase} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={detail.phasesTaught.includes(phase)}
                        onChange={() => update(detail.skillId, { phasesTaught: toggle(detail.phasesTaught, phase).sort() })}
                        className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                      />
                      Phase {phase}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-semibold text-slate-700">Certifications</p><SelectAllControls label="certifications" onCheckAll={() => update(detail.skillId, { certifications: KNOWN_CERTIFICATIONS })} onClear={() => update(detail.skillId, { certifications: [] })} allChecked={detail.certifications.length === KNOWN_CERTIFICATIONS.length} noneChecked={!detail.certifications.length} /></div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {KNOWN_CERTIFICATIONS.map((certification) => (
                  <label key={certification} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={detail.certifications.includes(certification)}
                      onChange={() => update(detail.skillId, { certifications: toggle(detail.certifications, certification) })}
                      className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    />
                    {certification}
                  </label>
                ))}
              </div>
              <input
                value={detail.otherCertification}
                onChange={(event) => update(detail.skillId, { otherCertification: event.target.value })}
                maxLength={200}
                placeholder="Other certifications, separated by commas"
                aria-label={`Other certifications for ${detail.title}`}
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>
        );
      })}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-accent-550 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save teaching details'}
      </button>
    </form>
  );
}
