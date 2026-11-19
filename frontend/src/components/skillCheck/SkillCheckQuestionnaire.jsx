import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import SelectAllControls from '../SelectAllControls';
import { SkeletonLines } from '../ui/Skeleton';

// ELEVATE skill check (Orientation, Pre-test, Profiling): one general page for
// every beneficiary. About-you questions, then one plain task per ELEVATE topic
// for their goal ("Not sure yet" shows all of them), rated Never / With help /
// On my own. The server scores it and picks topics.

// Demographic data (sex, age, work, barangay) lives on the Profile, not here.
const EMPTY_PROFILE = {
  goalTrack: '',
  usedComputer: null,
  phasesCompleted: [],
  notes: '',
};

const MAX_NOTES = 1000;

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function OptionCard({ name, checked, onChange, children, type = 'radio' }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${checked ? 'border-brand-300 bg-brand-50' : 'border-stone-200 hover:bg-stone-50'}`}>
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className={`mt-0.5 h-4 w-4 border-stone-300 text-brand-600 focus:ring-brand-500 ${type === 'checkbox' ? 'rounded' : ''}`}
      />
      <span className="min-w-0 flex-1 text-slate-800">{children}</span>
    </label>
  );
}

function TaskRow({ topic, value, scale, onChange, missing }) {
  return (
    <fieldset
      id={`topic-${topic.slug}`}
      className={`grid gap-2 px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 ${missing ? 'bg-red-50' : ''}`}
    >
      <legend className="sr-only">{topic.task}</legend>
      <p className="text-sm text-slate-800" aria-hidden="true">{topic.task}</p>
      <div className="grid grid-cols-3 gap-1.5 sm:w-80" role="radiogroup" aria-label={topic.task}>
        {scale.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium transition ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-200 text-slate-700 hover:bg-stone-50'}`}
            >
              <input
                type="radio"
                name={`rating-${topic.slug}`}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function SkillCheckQuestionnaire({ initialProfile, onComplete }) {
  const [questionnaire, setQuestionnaire] = useState(null);
  const [profile, setProfile] = useState(() => ({
    goalTrack: initialProfile?.goalTrack || EMPTY_PROFILE.goalTrack,
    usedComputer: initialProfile?.usedComputer ?? EMPTY_PROFILE.usedComputer,
    phasesCompleted: initialProfile?.phasesCompleted || EMPTY_PROFILE.phasesCompleted,
    notes: initialProfile?.notes || EMPTY_PROFILE.notes,
  }));
  const [ratings, setRatings] = useState({});
  const [missingSlug, setMissingSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    axiosClient.get('/elevate/skill-check')
      .then((response) => { if (active) setQuestionnaire(response.data.data); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the skill check.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // The goal's topics (none until a goal is chosen), except computer topics for
  // someone who has never used a computer: they start from the basics without being asked.
  const topics = useMemo(() => {
    if (!questionnaire) return [];
    const shows = questionnaire.tracks.find((track) => track.value === profile.goalTrack)?.shows;
    if (!shows) return [];
    return questionnaire.topics
      .filter((topic) => shows.includes(topic.slug))
      .filter((topic) => profile.usedComputer !== false || !topic.computerBased);
  }, [questionnaire, profile.goalTrack, profile.usedComputer]);

  function updateProfile(changes) {
    setProfile((current) => ({ ...current, ...changes }));
    setError('');
  }

  function rate(slug, value) {
    setRatings((current) => ({ ...current, [slug]: value }));
    setMissingSlug('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!profile.goalTrack) return setError('Choose your main goal for joining ELEVATE.');
    if (profile.usedComputer === null) return setError('Tell us whether you have used a computer before.');
    const unanswered = topics.find((topic) => ratings[topic.slug] === undefined);
    if (unanswered) {
      setMissingSlug(unanswered.slug);
      document.getElementById(`topic-${unanswered.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return setError('Answer every row in the list.');
    }

    setSaving(true);
    setError('');
    try {
      const response = await axiosClient.post('/elevate/skill-check/me', {
        profile: {
          goalTrack: profile.goalTrack,
          usedComputer: profile.usedComputer,
          phasesCompleted: profile.phasesCompleted,
          notes: profile.notes.trim(),
        },
        answers: Object.fromEntries(topics.map((topic) => [topic.slug, { rating: ratings[topic.slug] }])),
      });
      onComplete?.(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your skill check.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonLines lines={6} label="Loading the skill check…" />;
  if (!questionnaire) return <p role="alert" className="text-sm text-red-600">{error}</p>;

  const answeredCount = topics.filter((topic) => ratings[topic.slug] !== undefined).length;

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">What is your main goal in joining ELEVATE?</legend>
        <div className="grid gap-2">
          {questionnaire.tracks.map((track) => (
            <OptionCard
              key={track.value}
              name="goalTrack"
              checked={profile.goalTrack === track.value}
              onChange={() => updateProfile({ goalTrack: track.value })}
            >
              {track.label}
            </OptionCard>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Have you used a desktop or laptop computer before?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionCard name="usedComputer" checked={profile.usedComputer === true} onChange={() => updateProfile({ usedComputer: true })}>Yes</OptionCard>
          <OptionCard name="usedComputer" checked={profile.usedComputer === false} onChange={() => updateProfile({ usedComputer: false })}>
            No
            <span className="block text-xs text-slate-500">You’ll start from the computer basics, so we skip those rows.</span>
          </OptionCard>
        </div>
      </fieldset>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">How well can you do these?</h3>
          {profile.goalTrack && <span className="text-xs text-slate-500">{answeredCount} of {topics.length} answered</span>}
        </div>
        {profile.goalTrack ? (
          <p className="mb-2 text-xs text-slate-500">
            {profile.goalTrack === 'undecided' ? 'These are all the ELEVATE skills.' : 'These are the skills your goal needs.'} Be honest: anything you can’t do on your own yet becomes a topic you learn, matched with a specialist.
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 px-3 py-4 text-sm text-slate-500">Choose your main goal above, and the skills it needs show here.</p>
        )}
        {topics.length > 0 && <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {topics.map((topic) => (
            <TaskRow
              key={topic.slug}
              topic={topic}
              value={ratings[topic.slug]}
              scale={questionnaire.ratingScale}
              missing={missingSlug === topic.slug}
              onChange={(value) => rate(topic.slug, value)}
            />
          ))}
        </div>}
      </section>

      <details className="rounded-lg border border-stone-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">ELEVATE phases you’ve finished (optional)</summary>
        <div className="mt-4 pb-2">
          <fieldset>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><legend className="text-sm text-slate-600">Leave all unticked if this is your first time.</legend><SelectAllControls label="phases" onCheckAll={() => updateProfile({ phasesCompleted: [1, 2, 3, 4] })} onClear={() => updateProfile({ phasesCompleted: [] })} allChecked={profile.phasesCompleted.length === 4} noneChecked={!profile.phasesCompleted.length} /></div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4].map((phase) => (
                <OptionCard
                  key={phase}
                  type="checkbox"
                  checked={profile.phasesCompleted.includes(phase)}
                  onChange={() => updateProfile({ phasesCompleted: toggle(profile.phasesCompleted, phase).sort() })}
                >
                  Phase {phase}
                </OptionCard>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      <div>
        <label htmlFor="skill-check-notes" className="block text-sm font-semibold text-slate-800">
          Tell us more <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <p className="mb-2 text-xs text-slate-500">
          What do you want to learn, and why? Anything your specialist should know, like tools you already use or times you can’t attend. Your matched specialists can read this.
        </p>
        <textarea
          id="skill-check-notes"
          rows="4"
          maxLength={MAX_NOTES}
          value={profile.notes}
          onChange={(event) => updateProfile({ notes: event.target.value })}
          placeholder="e.g. I want to work as a virtual assistant. I already use Canva for posters, and I can’t attend on Fridays."
          className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{profile.notes.length} / {MAX_NOTES}</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-accent-550 disabled:opacity-50"
      >
        {saving ? 'Finding your topics…' : 'See my topics'}
      </button>
    </form>
  );
}
