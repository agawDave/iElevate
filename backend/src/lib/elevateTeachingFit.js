// Skill-match gates from a specialist's teaching details (skill-check Part D).
// Like learning circumstances, details a specialist hasn't filled in yet
// neither block nor add to a match.
const { describeWaiting } = require('./elevateCircumstances');

const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const QUALIFIED_PROFICIENCY = ['advanced', 'expert'];
const LEARNER_LEVELS = ['beginner', 'developing'];
const LEARNER_LEVEL_LABELS = { beginner: 'beginners', developing: 'developing learners' };

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// A learner's skill-check band is saved as their proficiency in the topic.
function learnerBandFrom(proficiency) {
  if (proficiency === 'beginner') return 'beginner';
  if (proficiency === 'intermediate') return 'developing';
  return null;
}

function learnerLevelsFrom(value) {
  return parseList(value).filter((level) => LEARNER_LEVELS.includes(level));
}

// teaching = the specialist's user_skills row for the topic.
function evaluateTeachingFit({ topicTitle, learnerProficiency, teaching, currentLearners }) {
  if (teaching?.proficiency && !QUALIFIED_PROFICIENCY.includes(teaching.proficiency)) {
    return { eligible: false, blocker: 'skill' };
  }
  const band = learnerBandFrom(learnerProficiency);
  const levels = learnerLevelsFrom(teaching?.learner_levels);
  if (band && levels.length && !levels.includes(band)) {
    return { eligible: false, blocker: 'level' };
  }
  const limit = Number(teaching?.max_learners) || 0;
  if (limit && currentLearners >= limit) {
    return { eligible: false, blocker: 'capacity' };
  }

  const reasons = [];
  let bonus = 0;
  if (teaching?.proficiency === 'expert') {
    bonus += 10;
    reasons.push(`Rated expert in ${topicTitle}`);
  }
  if (band && levels.includes(band)) {
    reasons.push(`Takes ${LEARNER_LEVEL_LABELS[band]} like you`);
  }
  return { eligible: true, bonus, reasons };
}

function describeTeachingWaiting(topicTitle, evaluations, learnerProficiency) {
  const blockers = new Set(evaluations.map((evaluation) => evaluation.blocker));
  const teachingBlocked = ['skill', 'level', 'capacity'].some((blocker) => blockers.has(blocker));
  if (!evaluations.length || !teachingBlocked) return describeWaiting(topicTitle, evaluations);
  if (blockers.size === 1 && blockers.has('skill')) {
    return `No ${topicTitle} specialist is rated advanced or expert in it yet.`;
  }
  if (blockers.size === 1 && blockers.has('level')) {
    const band = learnerBandFrom(learnerProficiency);
    return `The ${topicTitle} specialists aren’t taking ${LEARNER_LEVEL_LABELS[band] || 'learners at your level'} right now.`;
  }
  if (blockers.size === 1 && blockers.has('capacity')) {
    return `The ${topicTitle} specialists have no room for more learners right now.`;
  }
  return `No ${topicTitle} specialist fits your level, schedule and learning mode yet.`;
}

module.exports = {
  PROFICIENCY_LEVELS,
  QUALIFIED_PROFICIENCY,
  LEARNER_LEVELS,
  parseList,
  evaluateTeachingFit,
  describeTeachingWaiting,
};
