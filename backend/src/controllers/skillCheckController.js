const { pool } = require('../config/db');
const { recomputeElevateAssignments } = require('../services/elevateAssignmentService');
const { logActivity } = require('../lib/activityLog');
const {
  publicQuestionnaire,
  validateSubmission,
  scoreSubmission,
} = require('../lib/elevateSkillCheck');
// The current year's modules, with their tasks, goals and prerequisites.
const { loadProgramTopics } = require('../lib/programPhases');

async function requireBeneficiary(req, res) {
  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'beneficiary') {
    res.status(403).json({ success: false, message: 'Only beneficiaries take the ELEVATE pre-assessment' });
    return false;
  }
  return true;
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getQuestionnaire(req, res) {
  res.json({ success: true, data: publicQuestionnaire(await loadProgramTopics()) });
}

// The learner's latest attempt: Part A answers plus one result per topic.
async function getMySkillCheck(req, res) {
  if (!(await requireBeneficiary(req, res))) return;
  const [profiles] = await pool.query('SELECT * FROM elevate_learner_profiles WHERE user_id = ?', [req.user.id]);
  const [rows] = await pool.query(
    `SELECT a.*, s.slug, lm.title, lm.phase
     FROM elevate_skill_assessments a
     JOIN skills s ON s.id = a.skill_id
     LEFT JOIN learning_modules lm ON lm.slug = s.slug
     WHERE a.user_id = ?
       AND a.attempt = (SELECT MAX(attempt) FROM elevate_skill_assessments WHERE user_id = ?)
     ORDER BY lm.sort_order, a.id`,
    [req.user.id, req.user.id]
  );
  const profile = profiles[0];
  res.json({
    success: true,
    data: {
      completed: Boolean(profile && rows.length),
      profile: profile ? {
        goalTrack: profile.goal_track,
        usedComputer: Boolean(profile.used_computer),
        phasesCompleted: parseJsonList(profile.phases_completed),
        notes: profile.notes || '',
        sex: profile.sex,
        age: profile.age,
        workStatus: profile.work_status,
        completedAt: profile.completed_at,
      } : null,
      attempt: rows[0]?.attempt || 0,
      takenAt: rows[0]?.taken_at || null,
      results: rows.map((row) => ({
        skillId: row.skill_id,
        slug: row.slug,
        title: row.title,
        phase: row.phase,
        selfScore: row.self_score === null ? null : Number(row.self_score),
        checkCorrect: row.check_correct,
        checkTotal: row.check_total,
        level: Number(row.level),
        band: row.band,
        flagged: Boolean(row.flagged),
        outcome: row.outcome,
        reason: row.outcome_reason,
      })),
    },
  });
}

async function submitSkillCheck(req, res) {
  if (!(await requireBeneficiary(req, res))) return;
  const topics = await loadProgramTopics();
  const { value, error } = validateSubmission(req.body, topics);
  if (error) return res.status(400).json({ success: false, message: error });
  const results = scoreSubmission(value, topics);
  const { profile } = value;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Sex, age and work status are demographic data and live on the Profile
    // (users table); the skill check only records what it's used for.
    await connection.query(
      `INSERT INTO elevate_learner_profiles
         (user_id, goal_track, used_computer, phases_completed, notes, completed_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE goal_track = VALUES(goal_track), used_computer = VALUES(used_computer),
         phases_completed = VALUES(phases_completed), notes = VALUES(notes), completed_at = NOW()`,
      [req.user.id, profile.goalTrack, profile.usedComputer ? 1 : 0, JSON.stringify(profile.phasesCompleted), profile.notes]
    );
    const [[{ lastAttempt }]] = await connection.query(
      'SELECT COALESCE(MAX(attempt), 0) AS lastAttempt FROM elevate_skill_assessments WHERE user_id = ? FOR UPDATE',
      [req.user.id]
    );
    const attempt = Number(lastAttempt) + 1;
    for (const result of results) {
      await connection.query(
        `INSERT INTO elevate_skill_assessments
           (user_id, skill_id, attempt, test_kind, self_score, check_correct, check_total, level, band,
            flagged, outcome, outcome_reason, answers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, result.skillId, attempt, attempt === 1 ? 'pre' : 'post', result.selfScore,
          result.checkCorrect, result.checkTotal, result.level, result.band, result.flagged ? 1 : 0,
          result.outcome, result.reason, result.answers ? JSON.stringify(result.answers) : null]
      );
    }

    // The skill check decides the learner's topics: active ones are matched
    // now, next-up ones wait on the Modules page.
    await connection.query(
      "DELETE FROM user_skills WHERE user_id = ? AND relation_type = 'wants_to_learn'",
      [req.user.id]
    );
    for (const result of results.filter((item) => ['active', 'next_up'].includes(item.outcome))) {
      await connection.query(
        `INSERT INTO user_skills (user_id, skill_id, relation_type, proficiency, learning_status, status_reason)
         VALUES (?, ?, 'wants_to_learn', ?, ?, ?)`,
        [req.user.id, result.skillId, result.proficiency, result.outcome, result.reason]
      );
    }
    await recomputeElevateAssignments(req.user.id, connection);
    await connection.commit();
    await logActivity({ userId: req.user.id, action: 'skill_check', details: attempt === 1 ? 'Pre-test' : 'Post-test' });
    res.status(201).json({
      success: true,
      message: 'Pre-assessment saved',
      data: {
        attempt,
        results: results.map(({ answers, ...rest }) => rest),
      },
    });
  } catch (submitError) {
    await connection.rollback();
    throw submitError;
  } finally {
    connection.release();
  }
}

module.exports = { getQuestionnaire, getMySkillCheck, submitSkillCheck };
