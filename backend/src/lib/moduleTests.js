const { pool } = require('../config/db');
const { livesAbroad } = require('./places');

// Pre-test / post-test state for one learner on one topic with one specialist
// (tables module_test_questions and module_test_attempts).

function parseJson(value, fallback) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function attemptDto(row) {
  return row ? { score: Number(row.score), total: Number(row.total), takenAt: row.taken_at } : null;
}

// The specialist's questions, and the learner's two attempts.
async function loadTestState(beneficiaryId, moduleId, specialistId, connection = pool) {
  const [questions] = await connection.query(
    `SELECT id, prompt, options, correct_option FROM module_test_questions
     WHERE module_id = ? AND specialist_id = ? ORDER BY sort_order, id`,
    [moduleId, specialistId]
  );
  const [attempts] = await connection.query(
    `SELECT test_kind, score, total, answers, taken_at FROM module_test_attempts
     WHERE module_id = ? AND specialist_id = ? AND beneficiary_id = ?`,
    [moduleId, specialistId, beneficiaryId]
  );
  return {
    questions: questions.map((row) => ({ id: row.id, prompt: row.prompt, options: parseJson(row.options, []), correctOption: Number(row.correct_option) })),
    pre: attempts.find((row) => row.test_kind === 'pre') || null,
    post: attempts.find((row) => row.test_kind === 'post') || null,
  };
}

// The post-test waits for the face-to-face sessions: the one-on-one sessions and
// the open sessions the learner came to, once marked done, must reach the
// module's training hours. Then the specialist opens it (post_test_opened_at).
// Beneficiaries outside the Philippines learn online only, so they don't need the hours.
function faceToFaceDto(row) {
  const minutes = Number(row.minutes) || 0;
  const hours = Number(row.hours) || 0;
  const onlineOnly = livesAbroad(row.country);
  return {
    moduleId: Number(row.module_id),
    beneficiaryId: Number(row.beneficiary_id),
    hours,
    hoursDone: Math.round(minutes / 6) / 10,
    onlineOnly,
    ready: onlineOnly || minutes >= hours * 60,
    postTestOpened: Boolean(row.post_test_opened_at),
  };
}

// Face-to-face hours on accepted topics, for one learner or one specialist's
// learners (and optionally one topic).
async function loadFaceToFace({ beneficiaryId, specialistId, moduleId }, connection = pool) {
  const where = ["a.assignment_status = 'assigned'"];
  const params = [];
  if (beneficiaryId) { where.push('a.beneficiary_id = ?'); params.push(beneficiaryId); }
  if (specialistId) { where.push('a.specialist_id = ?'); params.push(specialistId); }
  if (moduleId) { where.push('a.module_id = ?'); params.push(moduleId); }
  const [rows] = await connection.query(
    `SELECT a.module_id, a.beneficiary_id, u.country, mc.post_test_opened_at,
            COALESCE(NULLIF(sm.hours, 0), lm.hours) AS hours,
            (SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, s.starts_at, s.ends_at)), 0)
             FROM module_sessions s
             LEFT JOIN module_session_attendees sa ON sa.session_id = s.id AND sa.beneficiary_id = a.beneficiary_id
             WHERE s.module_id = a.module_id AND s.status = 'completed'
               AND (s.beneficiary_id = a.beneficiary_id OR sa.attended = 1)) AS minutes
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     JOIN users u ON u.id = a.beneficiary_id
     LEFT JOIN specialist_modules sm ON sm.topic_id = a.module_id AND sm.specialist_id = a.specialist_id
     LEFT JOIN module_connections mc ON mc.beneficiary_id = a.beneficiary_id AND mc.module_id = a.module_id
     WHERE ${where.join(' AND ')}`,
    params
  );
  return rows.map(faceToFaceDto);
}

// Each question of an attempt with the learner's pick and the correct choice.
function attemptReview(row) {
  return row ? parseJson(row.answers, []) : [];
}

module.exports = { loadTestState, loadFaceToFace, faceToFaceDto, attemptDto, attemptReview, parseJson };
