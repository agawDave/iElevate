import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { SkeletonLines } from '../ui/Skeleton';

// ELEVATE skill check (Orientation, Pre-test, Profiling): one general page for
// every beneficiary. About-you questions, then one plain task per ELEVATE topic
// for their goal ("Not sure yet": the phase the admin chose, or all of them),
// rated Never / With help / On my own. The server scores it and picks topics.

// Demographic data (sex, age, work, barangay) lives on the Profile, not here.
const EMPTY_PROFILE = {
  goalTrack: '',
  usedComputer: null,
};
const GOAL_OTHER_MAX = 150;

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
    // "Other": their own goal, saved with "Not sure yet" (goalTrack) and asked about like it.
    otherGoal: Boolean(initialProfile?.goalOther),
    goalOther: initialProfile?.goalOther || '',
    usedComputer: initialProfile?.usedComputer ?? EMPTY_PROFILE.usedComputer,
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
        if (active) setError(requestError.response?.data?.message || 'Unable to load the pre-assessment.');
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
    if (profile.otherGoal && !profile.goalOther.trim()) return setError('Type your main goal, or choose one of the answers.');
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
          goalOther: profile.otherGoal ? profile.goalOther.trim() : null,
          usedComputer: profile.usedComputer,
        },
        answers: Object.fromEntries(topics.map((topic) => [topic.slug, { rating: ratings[topic.slug] }])),
      });
      onComplete?.(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your pre-assessment.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonLines lines={6} label="Loading the pre-assessment…" />;
  if (!questionnaire) return <p role="alert" className="text-sm text-red-600">{error}</p>;

  const answeredCount = topics.filter((topic) => ratings[topic.slug] !== undefined).length;
  const goalOffered = questionnaire.tracks.some((track) => track.value === profile.goalTrack);
  const undecided = questionnaire.tracks.find((track) => track.undecided);

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">What is your main goal in joining ELEVATE?</legend>
        <div className="grid gap-2">
          {questionnaire.tracks.map((track) => (
            <OptionCard
              key={track.value}
              name="goalTrack"
              checked={!profile.otherGoal && profile.goalTrack === track.value}
              onChange={() => updateProfile({ goalTrack: track.value, otherGoal: false })}
            >
              {track.label}
            </OptionCard>
          ))}
          {undecided && (
            <OptionCard
              name="goalTrack"
              checked={profile.otherGoal}
              onChange={() => updateProfile({ goalTrack: undecided.value, otherGoal: true })}
            >
              Other
            </OptionCard>
          )}
          {undecided && profile.otherGoal && (
            <input
              type="text"
              value={profile.goalOther}
              onChange={(event) => updateProfile({ goalOther: event.target.value })}
              maxLength={GOAL_OTHER_MAX}
              placeholder="Type your main goal"
              aria-label="Your main goal"
              autoFocus
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Have you used a desktop or laptop computer before?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionCard name="usedComputer" checked={profile.usedComputer === true} onChange={() => updateProfile({ usedComputer: true })}>Yes</OptionCard>
          <OptionCard name="usedComputer" checked={profile.usedComputer === false} onChange={() => updateProfile({ usedComputer: false })}>No</OptionCard>
        </div>
      </fieldset>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">How well can you do these?</h3>
          {goalOffered && <span className="text-xs text-slate-500">{answeredCount} of {topics.length} answered</span>}
        </div>
        {!goalOffered && (
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
