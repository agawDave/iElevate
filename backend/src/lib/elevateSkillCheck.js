// ELEVATE pre-assessment (the training designs' "Orientation, Pre-test,
// Profiling"): one general list for every beneficiary. Their goal, whether
// they've used a computer, and one plain task per module, rated Never / With
// help / On my own. The ratings decide which modules they learn.
//
// The modules come from the training design (every visible module of every
// phase), which the admin manages (lib/programPhases.js): each module has its task, the goals that need
// it, its prerequisites, and a few options. `topics` below is that list:
// { code, slug, title, phase, skillId, task, goals, needs, computerBased, foundation, note }.

const RATING_SCALE = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'With help' },
  { value: 2, label: 'On my own' },
];

// Rating -> level on the 0-3 scale the bands, matching and results use.
const LEVEL_FOR_RATING = [0, 1.0, 2.0];

// The beneficiary's goal decides which modules are asked about: only the ones
// that list that goal. "Not sure yet" (showsAll) sees every module.
const TRACKS = {
  job: { label: 'Get hired for an office or BPO job' },
  freelance: { label: 'Work from home as a freelancer or virtual assistant' },
  business: { label: 'Start or grow my own online business' },
  undecided: { label: 'Not sure yet', showsAll: true },
};
const GOAL_VALUES = ['job', 'freelance', 'business'];

// Phases 2 and 3 reported scheduling conflicts and overload, so only a few
// topics are matched at once; the rest wait as next up.
const ACTIVE_TOPIC_LIMIT = 4;
const MAX_NOTES_LENGTH = 1000;

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
function topicsForGoal(goalTrack, topics) {
  const track = TRACKS[goalTrack];
  if (!track) return [];
  return track.showsAll ? topics : topics.filter((topic) => topic.goals.includes(goalTrack));
}

// The modules the learner rates: their goal's modules, minus computer modules
// when they have never used a computer (those start from the basics without being asked).
function topicsToCheck(usedComputer, topics, goalTrack) {
  return topicsForGoal(goalTrack, topics).filter((topic) => usedComputer || !topic.computerBased);
}

// The questionnaire as the learner sees it.
function publicQuestionnaire(topics) {
  return {
    ratingScale: RATING_SCALE,
    tracks: Object.entries(TRACKS).map(([value, track]) => {
      const shows = topicsForGoal(value, topics).map((topic) => topic.slug);
      return { value, label: track.label, slugs: shows, shows };
    }),
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

function validateSubmission(body, topics) {
  const input = body || {};
  const profile = input.profile || {};
  if (!TRACKS[profile.goalTrack]) return { error: 'Choose your main goal for joining ELEVATE.' };
  if (typeof profile.usedComputer !== 'boolean') return { error: 'Tell us whether you have used a computer before.' };

  const phases = profile.phasesCompleted === undefined ? [] : profile.phasesCompleted;
  if (!Array.isArray(phases) || phases.some((phase) => !isIntInRange(phase, 1, 4))) {
    return { error: 'Choose the ELEVATE phases you finished from Phase 1 to Phase 4.' };
  }
  const sex = profile.sex || null;
  if (sex && !PROFILE_OPTIONS.sex.includes(sex)) return { error: 'Choose a valid option for sex.' };
  const workStatus = profile.workStatus || null;
  if (workStatus && !PROFILE_OPTIONS.workStatus.includes(workStatus)) return { error: 'Choose a valid work status.' };
  const age = profile.age === undefined || profile.age === null || profile.age === '' ? null : Number(profile.age);
  if (age !== null && !isIntInRange(age, 12, 100)) return { error: 'Enter an age from 12 to 100.' };

  const answers = input.answers && typeof input.answers === 'object' ? input.answers : {};
  const cleanAnswers = {};
  for (const topic of topicsToCheck(profile.usedComputer, topics, profile.goalTrack)) {
    const rating = answers[topic.slug]?.rating;
    if (!isIntInRange(rating, 0, RATING_SCALE.length - 1)) {
      return { error: `Answer every row, including “${topic.task}”.` };
    }
    cleanAnswers[topic.slug] = { rating };
  }

  // "Tell us more": free text the matched specialists can read.
  const notes = typeof profile.notes === 'string' ? profile.notes.trim() : '';
  if (notes.length > MAX_NOTES_LENGTH) return { error: `Keep “Tell us more” under ${MAX_NOTES_LENGTH} characters.` };

  return {
    value: {
      profile: {
        goalTrack: profile.goalTrack,
        usedComputer: profile.usedComputer,
        phasesCompleted: [...new Set(phases)].sort(),
        notes: notes || null,
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
function scoreSubmission({ profile, answers }, topics) {
  const shown = topicsForGoal(profile.goalTrack, topics);
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
  TRACKS,
  GOAL_VALUES,
  publicQuestionnaire,
  validateSubmission,
  scoreSubmission,
};
