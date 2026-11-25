// ELEVATE pre-assessment (the training designs' "Orientation, Pre-test,
// Profiling"): one general list for every beneficiary. Their goal, whether
// they've used a computer, and one plain task per module, rated Never / With
// help / On my own. The ratings decide which modules they learn.
//
// The modules come from the training design (every visible module of every
// phase), which the admin manages (lib/programPhases.js): each module has its task, the goals that need
// it, its prerequisites, and a few options. `topics` below is that list:
// { code, slug, title, phase, skillId, task, goals, needs, computerBased, foundation, note }.
const { phaseNumber } = require('./programPhases');

const RATING_SCALE = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'With help' },
  { value: 2, label: 'On my own' },
];

// Rating -> level on the 0-3 scale the bands, matching and results use.
const LEVEL_FOR_RATING = [0, 1.0, 2.0];

// The beneficiary's goal decides which modules are asked about: only the ones
// that list that goal. The goals ({ value, label, startPhase }) are the admin's
// (loadGoals in lib/programPhases.js). "Not sure yet" has a startPhase instead:
// it's asked about that phase's modules (or the next phase's, once those are
// all finished), or about every module when it's 0 (All phases).

// Phases 2 and 3 reported scheduling conflicts and overload, so only a few
// topics are matched at once; the rest wait as next up.
const ACTIVE_TOPIC_LIMIT = 4;

const BANDS = [
  { band: 'beginner', below: 1.0, proficiency: 'beginner', label: 'Beginner' },
  { band: 'developing', below: 2.0, proficiency: 'intermediate', label: 'Developing' },
  { band: 'proficient', below: 2.5, proficiency: 'advanced', label: 'Proficient' },
  { band: 'strong', below: Infinity, proficiency: 'expert', label: 'Strong' },
];

const PROFILE_OPTIONS = {
  sex: ['female', 'male', 'prefer_not_to_say'],
  workStatus: ['unemployed', 'employed', 'self_employed', 'student'],
};

function bandFor(level) {
  return BANDS.find((entry) => level < entry.below);
}

// The modules shown for a goal, in the training design's order.
function topicsForGoal(goalTrack, topics, goals) {
  const goal = goals.find((item) => item.value === goalTrack);
  if (!goal) return [];
  if (goal.startPhase === null) return topics.filter((topic) => topic.goals.includes(goal.value));
  if (goal.startPhase === 0) return topics;
  const first = Math.min(...topics.map((topic) => phaseNumber(topic.phase)).filter((phase) => phase >= goal.startPhase));
  return topics.filter((topic) => phaseNumber(topic.phase) === first);
}

// The modules the learner rates: their goal's modules, minus computer modules
// when they have never used a computer (those start from the basics without being asked).
function topicsToCheck(usedComputer, topics, goalTrack, goals) {
  return topicsForGoal(goalTrack, topics, goals).filter((topic) => usedComputer || !topic.computerBased);
}

// The questionnaire as the learner sees it. A goal with no modules to ask about
// (none ticked yet, or "Not sure yet" starting from an empty phase) isn't offered.
function publicQuestionnaire(topics, goals) {
  return {
    ratingScale: RATING_SCALE,
    tracks: goals.map((goal) => {
      const shows = topicsForGoal(goal.value, topics, goals).map((topic) => topic.slug);
      // "Not sure yet" also carries the answer "Other", where they type their own goal.
      return { value: goal.value, label: goal.label, slugs: shows, shows, undecided: goal.startPhase !== null };
    }).filter((track) => track.shows.length),
    activeTopicLimit: ACTIVE_TOPIC_LIMIT,
    topics: topics.map((topic) => ({
      code: topic.code,
      slug: topic.slug,
      title: topic.title,
      phase: topic.phase,
      computerBased: topic.computerBased,
      note: topic.note,
      task: topic.task,
    })),
  };
}

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validateSubmission(body, topics, goals) {
  const input = body || {};
  const profile = input.profile || {};
  const goal = goals.find((item) => item.value === profile.goalTrack);
  if (!goal) return { error: 'Choose your main goal for joining ELEVATE.' };
  // Nothing to ask would replace their topics with none.
  if (!topicsForGoal(profile.goalTrack, topics, goals).length) return { error: 'This goal has no modules to ask about yet. Choose another goal.' };
  // A goal typed under "Other" is saved with "Not sure yet", and asked about like it.
  const goalOther = typeof profile.goalOther === 'string' && goal.startPhase !== null ? profile.goalOther.trim() : '';
  if (goalOther.length > 150) return { error: 'Keep your goal to 150 characters.' };
  if (typeof profile.usedComputer !== 'boolean') return { error: 'Tell us whether you have used a computer before.' };

  const sex = profile.sex || null;
  if (sex && !PROFILE_OPTIONS.sex.includes(sex)) return { error: 'Choose a valid option for sex.' };
  const workStatus = profile.workStatus || null;
  if (workStatus && !PROFILE_OPTIONS.workStatus.includes(workStatus)) return { error: 'Choose a valid work status.' };
  const age = profile.age === undefined || profile.age === null || profile.age === '' ? null : Number(profile.age);
  if (age !== null && !isIntInRange(age, 12, 100)) return { error: 'Enter an age from 12 to 100.' };

  const answers = input.answers && typeof input.answers === 'object' ? input.answers : {};
  const cleanAnswers = {};
  for (const topic of topicsToCheck(profile.usedComputer, topics, profile.goalTrack, goals)) {
    const rating = answers[topic.slug]?.rating;
    if (!isIntInRange(rating, 0, RATING_SCALE.length - 1)) {
      return { error: `Answer every row, including “${topic.task}”.` };
    }
    cleanAnswers[topic.slug] = { rating };
  }

  return {
    value: {
      profile: {
        goalTrack: profile.goalTrack,
        goalOther: goalOther || null,
        usedComputer: profile.usedComputer,
        sex,
        age,
        workStatus,
      },
      answers: cleanAnswers,
    },
  };
}

function joinTitles(titles) {
  if (titles.length <= 1) return titles.join('');
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

// Level comes straight from the rating: Never 0, With help 1.0, On my own 2.0.
// Modules below 2.0 are learning topics, in the training design's order; the
// first four that aren't waiting on a prerequisite are active.
function scoreSubmission({ profile, answers }, topics, goals) {
  const shown = topicsForGoal(profile.goalTrack, topics, goals);
  const titleOf = (slug) => topics.find((topic) => topic.slug === slug)?.title || slug;

  const scored = shown.map((topic) => {
    const answer = answers[topic.slug];
    if (!answer) {
      return {
        slug: topic.slug, skipped: true, selfScore: null, checkCorrect: null, checkTotal: 0, level: 0, flagged: false, answers: null,
      };
    }
    return {
      slug: topic.slug,
      skipped: false,
      selfScore: answer.rating,
      checkCorrect: null,
      checkTotal: 0,
      level: LEVEL_FOR_RATING[answer.rating],
      flagged: false,
      answers: answer,
    };
  });

  const levelBySlug = new Map(scored.map((entry) => [entry.slug, entry.level]));
  // Modules the learner answered "Never" (not skipped ones, which start from the basics anyway).
  const answeredNever = new Set(scored.filter((entry) => entry.selfScore === 0).map((entry) => entry.slug));
  let activeCount = 0;
  return scored.map((entry, index) => {
    const topic = shown[index];
    const band = bandFor(entry.level);
    // A foundation module is still recommended when rated "On my own" if a
    // module built only on it was answered "Never" (e.g. Basic Computer
    // Operation for Google Document, Slides or Spreadsheet).
    const neverBuiltOn = topic.foundation
      ? shown.filter((other) => other.needs.length === 1 && other.needs[0] === topic.slug && answeredNever.has(other.slug)).map((other) => other.slug)
      : [];
    let outcome;
    let reason;
    if (entry.level >= 2.0 && neverBuiltOn.length) {
      const why = `Recommended because you answered Never for ${joinTitles(neverBuiltOn.map(titleOf))}, which ${neverBuiltOn.length === 1 ? 'builds' : 'build'} on it.`;
      if (activeCount < ACTIVE_TOPIC_LIMIT) {
        outcome = 'active';
        activeCount += 1;
        reason = why;
      } else {
        outcome = 'next_up';
        reason = `${why} Starts when you finish one of your current topics (up to ${ACTIVE_TOPIC_LIMIT} at a time).`;
      }
    } else if (entry.level >= 2.0) {
      outcome = 'refresher';
      reason = 'You can already do this on your own. A refresher is optional.';
    } else {
      const unmet = topic.needs.filter((slug) => levelBySlug.has(slug) && levelBySlug.get(slug) < 1.0);
      if (unmet.length) {
        outcome = 'next_up';
        reason = `Starts once you can do ${joinTitles(unmet.map(titleOf))} with help.`;
      } else if (activeCount < ACTIVE_TOPIC_LIMIT) {
        outcome = 'active';
        activeCount += 1;
        reason = entry.skipped ? 'Starts from the basics because you haven’t used a computer yet.' : null;
      } else {
        outcome = 'next_up';
        reason = `Starts when you finish one of your current topics (up to ${ACTIVE_TOPIC_LIMIT} at a time).`;
      }
    }
    // The module's own note for beneficiaries (e.g. the spoken English check).
    if (topic.note && outcome !== 'refresher' && !entry.skipped) {
      reason = [reason, topic.note].filter(Boolean).join(' ');
    }
    return {
      ...entry,
      code: topic.code,
      skillId: topic.skillId,
      title: topic.title,
      phase: topic.phase,
      onGoal: true,
      band: band.band,
      bandLabel: band.label,
      proficiency: band.proficiency,
      outcome,
      reason,
    };
  });
}

module.exports = {
  ACTIVE_TOPIC_LIMIT,
  BANDS,
  publicQuestionnaire,
  validateSubmission,
  scoreSubmission,
};
