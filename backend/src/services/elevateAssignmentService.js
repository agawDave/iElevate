const { pool } = require('../config/db');
const {
  circumstancesFromRow,
  evaluateMatch,
} = require('../lib/elevateCircumstances');
const { evaluateTeachingFit, describeTeachingWaiting } = require('../lib/elevateTeachingFit');
const { ACTIVE_TOPIC_LIMIT, PREREQUISITES } = require('../lib/elevateSkillCheck');

// Circumstances plus the Profile address (country, province or state, city,
// barangay), which is where both learners and specialists say where they are.
async function loadCircumstances(connection, userIds) {
  if (!userIds.length) return new Map();
  const [rows] = await connection.query(
    `SELECT c.*, u.id AS user_id, u.country, u.province, u.state_region,
            COALESCE(c.city, u.city) AS city
     FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     WHERE u.id IN (?)`,
    [userIds]
  );
  return new Map(rows.map((row) => [Number(row.user_id), circumstancesFromRow(row)]));
}

function parseReasons(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

// Locks the learner's user row until the transaction ends. Everything that
// changes a learner's topic assignments takes this lock first, so concurrent
// changes queue up instead of deadlocking. (Outside a transaction it's a no-op.)
async function lockLearner(connection, learnerId) {
  await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [learnerId]);
}

// Everything needed to compare a learner with the specialists who teach their
// topics: who teaches what, their loads and circumstances, the learner's
// assignments, and who declined them.
async function loadMatchingContext(connection, learnerId) {
  const [topics] = await connection.query(
    `SELECT lm.id AS module_id, lm.title, ms.skill_id, wants.learning_status, wants.status_reason,
            wants.proficiency AS learner_proficiency
     FROM learning_modules lm
     JOIN module_skills ms ON ms.module_id = lm.id AND ms.is_primary = 1
     JOIN user_skills wants ON wants.skill_id = ms.skill_id
       AND wants.user_id = ? AND wants.relation_type = 'wants_to_learn'
     WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved'
     ORDER BY lm.sort_order, lm.id`,
    [learnerId]
  );
  const moduleIds = topics.map((topic) => topic.module_id);

  // Candidates: specialists who teach the topic AND have an approved module
  // for it (specialists create their own module; the admin approves it).
  const [candidates] = moduleIds.length
    ? await connection.query(
      `SELECT ms.module_id, specialist.id AS specialist_id,
              teaches.proficiency, teaches.learner_levels, teaches.max_learners
       FROM module_skills ms
       JOIN user_skills teaches ON teaches.skill_id = ms.skill_id AND teaches.relation_type = 'teaches'
       JOIN users specialist ON specialist.id = teaches.user_id
         AND specialist.user_type = 'specialist' AND specialist.status = 'active'
       JOIN specialist_modules sm ON sm.topic_id = ms.module_id AND sm.specialist_id = specialist.id
         AND sm.status = 'approved'
       WHERE ms.module_id IN (?) AND ms.is_primary = 1`,
      [moduleIds]
    )
    : [[]];
  // Topics with at least one approved module (the others are "coming soon").
  const topicsWithModules = new Set(candidates.map((row) => Number(row.module_id)));
  const specialistIds = [...new Set(candidates.map((row) => Number(row.specialist_id)))];

  const [loadRows] = specialistIds.length
    ? await connection.query(
      `SELECT specialist_id, COUNT(DISTINCT beneficiary_id) AS learners
       FROM elevate_module_assignments
       WHERE specialist_id IN (?) AND assignment_status = 'assigned' AND beneficiary_id <> ?
       GROUP BY specialist_id`,
      [specialistIds, learnerId]
    )
    : [[]];
  const loadBySpecialist = new Map(loadRows.map((row) => [Number(row.specialist_id), Number(row.learners)]));

  // Learners each specialist already has per topic, for their learner limit.
  const [topicLoadRows] = specialistIds.length
    ? await connection.query(
      `SELECT specialist_id, module_id, COUNT(*) AS learners
       FROM elevate_module_assignments
       WHERE specialist_id IN (?) AND assignment_status = 'assigned' AND beneficiary_id <> ?
       GROUP BY specialist_id, module_id`,
      [specialistIds, learnerId]
    )
    : [[]];
  const topicLoad = new Map(topicLoadRows.map((row) => [`${row.specialist_id}:${row.module_id}`, Number(row.learners)]));

  const circumstances = await loadCircumstances(connection, [learnerId, ...specialistIds]);
  const learner = circumstances.get(learnerId) || null;

  const [existingRows] = await connection.query(
    `SELECT module_id, specialist_id, matched_skill_id, match_score, assignment_status,
            match_reasons, waiting_reason, assigned_at, applied_at
     FROM elevate_module_assignments WHERE beneficiary_id = ?`,
    [learnerId]
  );
  const existing = new Map(existingRows.map((row) => [Number(row.module_id), row]));
  const [declineRows] = await connection.query(
    'SELECT module_id, specialist_id FROM elevate_application_declines WHERE beneficiary_id = ?',
    [learnerId]
  );
  const declined = new Set(declineRows.map((row) => `${row.module_id}:${row.specialist_id}`));
  const stillTeaches = (moduleId, specialistId) => candidates.some(
    (row) => Number(row.module_id) === Number(moduleId) && Number(row.specialist_id) === Number(specialistId)
  );

  // How each specialist who teaches the topic (and hasn't declined this
  // learner) fits: teaching level and limits, then circumstances.
  function evaluate(topic, currentSpecialistId = null) {
    const moduleId = Number(topic.module_id);
    return candidates
      .filter((row) => Number(row.module_id) === moduleId && !declined.has(`${moduleId}:${row.specialist_id}`))
      .map((row) => {
        const specialistId = Number(row.specialist_id);
        const base = {
          specialistId,
          load: loadBySpecialist.get(specialistId) || 0,
          current: specialistId === currentSpecialistId,
        };
        const fit = evaluateTeachingFit({
          topicTitle: topic.title,
          learnerProficiency: topic.learner_proficiency,
          teaching: row,
          currentLearners: topicLoad.get(`${specialistId}:${moduleId}`) || 0,
        });
        if (!fit.eligible) return { ...base, ...fit };
        const match = evaluateMatch(learner, circumstances.get(specialistId) || null);
        if (!match.eligible) return { ...base, ...match };
        return {
          ...base,
          eligible: true,
          score: match.score + fit.bonus,
          reasons: [...fit.reasons, ...match.reasons],
        };
      });
  }

  // Specialists who fit, best first; on a tie the current one, then fewer learners.
  function rank(evaluations) {
    return evaluations
      .filter((evaluation) => evaluation.eligible)
      .sort((a, b) => b.score - a.score
        || Number(b.current) - Number(a.current)
        || a.load - b.load
        || a.specialistId - b.specialistId);
  }

  return { topics, existing, evaluate, rank, stillTeaches, topicsWithModules };
}

function noModuleYet(topicTitle) {
  return `No specialist has a module for ${topicTitle} yet. It opens here once one is approved.`;
}

// Keeps a learner's topic assignments up to date. The learner chooses the
// specialist they apply to; this only works out who fits.
//   - not applied yet       -> 'suggested' (best fit shown first), learner picks one
//   - applied               -> 'pending' with the chosen specialist while they
//                              still teach the topic; otherwise back to 'suggested'
//   - accepted ('assigned') -> keeps its specialist (Ongoing / Completed)
//   - nobody fits           -> 'waiting'; next-up topics -> 'queued'
async function recomputeElevateAssignments(beneficiaryId, connection = pool) {
  const learnerId = Number(beneficiaryId);
  // One update of a learner's matches at a time: a second one (e.g. two page
  // requests at once) waits here instead of deadlocking on the same rows.
  await lockLearner(connection, learnerId);
  const { topics, existing, evaluate, rank, stillTeaches, topicsWithModules } = await loadMatchingContext(connection, learnerId);

  const desired = new Map();
  topics.forEach((topic) => {
    const moduleId = Number(topic.module_id);
    const previous = existing.get(moduleId);
    const appliedAt = previous?.applied_at || null;
    // An accepted topic keeps its specialist while they still teach it; a
    // completed one keeps the specialist who certified the learner.
    if (previous?.assignment_status === 'assigned' && previous.specialist_id
      && (topic.learning_status === 'completed' || stillTeaches(moduleId, previous.specialist_id))) {
      desired.set(moduleId, {
        specialistId: Number(previous.specialist_id),
        matchedSkillId: Number(previous.matched_skill_id),
        score: Number(previous.match_score),
        status: 'assigned',
        reasons: parseReasons(previous.match_reasons),
        waitingReason: null,
        appliedAt,
      });
      return;
    }
    // Next-up topics from the skill check wait without a specialist.
    if (topic.learning_status === 'next_up') {
      desired.set(moduleId, {
        specialistId: null,
        matchedSkillId: Number(topic.skill_id),
        score: 0,
        status: 'queued',
        reasons: [],
        waitingReason: topic.status_reason || 'Starts when you finish one of your current topics.',
        appliedAt: null,
      });
      return;
    }
    // An application stays with the specialist the learner chose while they
    // still teach the topic (they accept or decline it).
    if (previous?.assignment_status === 'pending' && previous.specialist_id && appliedAt
      && stillTeaches(moduleId, previous.specialist_id)) {
      desired.set(moduleId, {
        specialistId: Number(previous.specialist_id),
        matchedSkillId: Number(previous.matched_skill_id),
        score: Number(previous.match_score),
        status: 'pending',
        reasons: parseReasons(previous.match_reasons),
        waitingReason: null,
        appliedAt,
      });
      return;
    }
    const evaluations = evaluate(topic, Number(previous?.specialist_id) || null);
    const best = rank(evaluations)[0];
    desired.set(moduleId, best
      ? {
        specialistId: best.specialistId,
        matchedSkillId: Number(topic.skill_id),
        score: best.score,
        status: 'suggested',
        reasons: [`Teaches ${topic.title}`, ...best.reasons],
        waitingReason: null,
        appliedAt: null,
      }
      : {
        specialistId: null,
        matchedSkillId: Number(topic.skill_id),
        score: 0,
        status: 'waiting',
        reasons: [],
        waitingReason: topicsWithModules.has(moduleId)
          ? describeTeachingWaiting(topic.title, evaluations, topic.learner_proficiency)
          : noModuleYet(topic.title),
        appliedAt: null,
      });
  });

  const staleModuleIds = [...existing.keys()].filter((moduleId) => !desired.has(moduleId));
  if (staleModuleIds.length) {
    await connection.query(
      'DELETE FROM elevate_module_assignments WHERE beneficiary_id = ? AND module_id IN (?)',
      [learnerId, staleModuleIds]
    );
  }

  // Nothing is written when nothing changed, so opening a page never takes
  // write locks on its own.
  let anyChanged = staleModuleIds.length > 0;
  for (const [moduleId, next] of desired) {
    const previous = existing.get(moduleId);
    const reasonsJson = JSON.stringify(next.reasons);
    const specialistChanged = !previous
      || String(previous.specialist_id || '') !== String(next.specialistId || '');
    const sameTime = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
    const changed = specialistChanged
      || previous.assignment_status !== next.status
      || Number(previous.match_score) !== next.score
      || Number(previous.matched_skill_id) !== next.matchedSkillId
      || (previous.match_reasons || '[]') !== reasonsJson
      || (previous.waiting_reason || null) !== next.waitingReason
      || !sameTime(previous.applied_at, next.appliedAt);
    if (!changed) continue;
    anyChanged = true;

    if (specialistChanged && previous) {
      await connection.query(
        'DELETE FROM module_connections WHERE beneficiary_id = ? AND module_id = ?',
        [learnerId, moduleId]
      );
    }
    {
      // assigned_at is when the specialist accepted; only accepted topics have it.
      const keepAssignedAt = next.status === 'assigned' && !specialistChanged && previous?.assigned_at;
      await connection.query(
        `INSERT INTO elevate_module_assignments
           (beneficiary_id, module_id, specialist_id, matched_skill_id, match_score,
            match_reasons, waiting_reason, assignment_status, assigned_at, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${keepAssignedAt ? '?' : "IF(? = 'assigned', NOW(), NULL)"}, ?)
         ON DUPLICATE KEY UPDATE specialist_id = VALUES(specialist_id),
           matched_skill_id = VALUES(matched_skill_id), match_score = VALUES(match_score),
           match_reasons = VALUES(match_reasons), waiting_reason = VALUES(waiting_reason),
           assignment_status = VALUES(assignment_status), assigned_at = VALUES(assigned_at),
           applied_at = VALUES(applied_at)`,
        [
          learnerId,
          moduleId,
          next.specialistId,
          next.matchedSkillId,
          next.score,
          reasonsJson,
          next.waitingReason,
          next.status,
          keepAssignedAt ? previous.assigned_at : next.status,
          next.appliedAt,
        ]
      );
    }
    // Only an accepted topic opens the chat.
    if (next.specialistId && next.status === 'assigned') {
      await connection.query(
        'INSERT IGNORE INTO module_connections (beneficiary_id, module_id) VALUES (?, ?)',
        [learnerId, moduleId]
      );
      const [userAId, userBId] = [learnerId, next.specialistId].sort((a, b) => a - b);
      await connection.query(
        'INSERT IGNORE INTO conversations (module_id, user_a_id, user_b_id) VALUES (?, ?, ?)',
        [moduleId, userAId, userBId]
      );
    }
  }

  if (!anyChanged) return;
  // Drop ELEVATE connections that no longer have an assigned specialist.
  await connection.query(
    `DELETE mc FROM module_connections mc
     JOIN learning_modules lm ON lm.id = mc.module_id AND lm.is_elevate_program = 1
     WHERE mc.beneficiary_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM elevate_module_assignments assignment
         WHERE assignment.beneficiary_id = mc.beneficiary_id
           AND assignment.module_id = mc.module_id
           AND assignment.assignment_status = 'assigned'
       )`,
    [learnerId]
  );
}

// A specialist's topics or circumstances changed, so every beneficiary's
// best fit may have changed too.
async function recomputeAssignmentsForSpecialist() {
  const [users] = await pool.query(
    "SELECT id FROM users WHERE user_type = 'beneficiary' AND status = 'active' ORDER BY id"
  );
  const connection = await pool.getConnection();
  try {
    for (const user of users) {
      await connection.beginTransaction();
      try {
        await recomputeElevateAssignments(user.id, connection);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    connection.release();
  }
}

// After a topic is completed, start next-up topics (in training-design order)
// until the learner is back to the active-topic limit. A next-up topic waits
// while any of its prerequisites is still being learned.
async function promoteNextUpTopics(beneficiaryId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT us.id, s.slug, us.learning_status
     FROM user_skills us
     JOIN skills s ON s.id = us.skill_id
     LEFT JOIN learning_modules lm ON lm.slug = s.slug
     WHERE us.user_id = ? AND us.relation_type = 'wants_to_learn'
     ORDER BY lm.sort_order, lm.id`,
    [beneficiaryId]
  );
  const statusBySlug = new Map(rows.map((row) => [row.slug, row.learning_status || 'active']));
  let active = rows.filter((row) => (row.learning_status || 'active') === 'active').length;
  const promoted = [];
  for (const row of rows) {
    if (active >= ACTIVE_TOPIC_LIMIT) break;
    if (row.learning_status !== 'next_up') continue;
    const blocked = (PREREQUISITES.get(row.slug) || [])
      .some((slug) => ['active', 'next_up'].includes(statusBySlug.get(slug)));
    if (blocked) continue;
    await connection.query(
      "UPDATE user_skills SET learning_status = 'active', status_reason = NULL WHERE id = ?",
      [row.id]
    );
    statusBySlug.set(row.slug, 'active');
    active += 1;
    promoted.push(row.slug);
  }
  return promoted;
}

// The specialists a learner can apply to for each topic they haven't applied
// to yet: everyone who teaches it and fits them, best fit first.
async function specialistOptions(beneficiaryId, connection = pool) {
  const learnerId = Number(beneficiaryId);
  const { topics, existing, evaluate, rank } = await loadMatchingContext(connection, learnerId);
  const options = new Map();
  topics.forEach((topic) => {
    const row = existing.get(Number(topic.module_id));
    if (!row || row.assignment_status !== 'suggested') return;
    options.set(Number(topic.module_id), rank(evaluate(topic)).map((evaluation, index) => ({
      specialistId: evaluation.specialistId,
      score: evaluation.score,
      reasons: evaluation.reasons,
      best: index === 0,
      title: topic.title,
    })));
  });
  return options;
}

module.exports = { recomputeElevateAssignments, recomputeAssignmentsForSpecialist, promoteNextUpTopics, specialistOptions, lockLearner };
