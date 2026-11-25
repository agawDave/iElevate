const test = require('node:test');
const assert = require('node:assert');
const { publicQuestionnaire, validateSubmission } = require('./elevateSkillCheck');

const goals = [
  { value: 'job', label: 'Get hired', startPhase: null },
  { value: 'government', label: 'Get a government job', startPhase: null },
  { value: 'undecided', label: 'Not sure yet', startPhase: 1 },
];
const topic = (slug, topicGoals, phase = 1) => ({ code: slug, slug, title: slug, phase: `ELEVATE Phase ${phase}`, task: `Do ${slug}`, goals: topicGoals, needs: [], computerBased: false, foundation: false });
const topics = [topic('docs', ['job']), topic('forms', ['government'], 2)];

test('each goal asks about the modules that need it; "Not sure yet" starts from Phase 1', () => {
  const tracks = publicQuestionnaire(topics, goals).tracks;
  assert.deepStrictEqual(tracks.map((track) => [track.value, track.shows]), [
    ['job', ['docs']],
    ['government', ['forms']],
    ['undecided', ['docs']],
  ]);
});

test('"Not sure yet" is asked about the phase the admin picked, or every phase', () => {
  const shows = (startPhase) => publicQuestionnaire(topics, goals.map((goal) => (goal.value === 'undecided' ? { ...goal, startPhase } : goal))).tracks.at(-1).shows;
  assert.deepStrictEqual(shows(2), ['forms']);
  assert.deepStrictEqual(shows(0), ['docs', 'forms']);
  assert.deepStrictEqual(shows(1), ['docs'], 'starts from Phase 1');
  assert.deepStrictEqual(publicQuestionnaire([topics[1]], goals).tracks.at(-1).shows, ['forms'], 'Phase 1 finished: moves on to Phase 2');
});

test('a goal with no modules to ask about is not offered, and refused', () => {
  const body = (goalTrack) => ({ profile: { goalTrack, usedComputer: true }, answers: {} });
  // "Government" has no module yet; "Not sure yet" starts from Phase 3, which is empty.
  const empty = goals.map((goal) => (goal.value === 'undecided' ? { ...goal, startPhase: 3 } : goal));
  assert.deepStrictEqual(publicQuestionnaire([topics[0]], empty).tracks.map((track) => track.value), ['job']);
  assert.match(validateSubmission(body('government'), [topics[0]], empty).error, /no modules/);
  assert.match(validateSubmission(body('undecided'), [topics[0]], empty).error, /no modules/);
});

test('"Other": a typed goal is kept only with "Not sure yet", trimmed and at most 150 characters', () => {
  const body = (goalTrack, goalOther) => ({ profile: { goalTrack, goalOther, usedComputer: true }, answers: { docs: { rating: 1 }, forms: { rating: 2 } } });
  assert.strictEqual(validateSubmission(body('undecided', '  Become a nurse '), topics, goals).value.profile.goalOther, 'Become a nurse');
  assert.strictEqual(validateSubmission(body('undecided', '   '), topics, goals).value.profile.goalOther, null);
  assert.strictEqual(validateSubmission(body('job', 'Become a nurse'), topics, goals).value.profile.goalOther, null, 'a normal goal ignores it');
  assert.match(validateSubmission(body('undecided', 'x'.repeat(151)), topics, goals).error, /150/);
  assert.deepStrictEqual(publicQuestionnaire(topics, goals).tracks.map((track) => track.undecided), [false, false, true]);
});

test('a goal the admin removed is refused', () => {
  const body = (goalTrack) => ({ profile: { goalTrack, usedComputer: true }, answers: { docs: { rating: 1 }, forms: { rating: 2 } } });
  assert.ok(validateSubmission(body('government'), topics, goals).value);
  assert.match(validateSubmission(body('business'), topics, goals).error, /main goal/);
});
