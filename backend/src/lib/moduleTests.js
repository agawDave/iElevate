const { pool } = require('../config/db');

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

// How many of the specialist's activities the learner has done.
async function loadActivityProgress(beneficiaryId, moduleId, specialistId, connection = pool) {
  const [[row]] = await connection.query(
    `SELECT COUNT(act.id) AS total,
            SUM(CASE WHEN (act.activity_type = 'multiple_choice' AND ans.is_correct = 1)
                       OR (act.activity_type <> 'multiple_choice' AND ans.id IS NOT NULL) THEN 1 ELSE 0 END) AS done
     FROM module_activities act
     LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = ?
     WHERE act.module_id = ? AND act.specialist_id = ?`,
    [beneficiaryId, moduleId, specialistId]
  );
  return { total: Number(row.total) || 0, done: Number(row.done) || 0 };
}

// Each question of an attempt with the learner's pick and the correct choice.
function attemptReview(row) {
  return row ? parseJson(row.answers, []) : [];
}

module.exports = { loadTestState, loadActivityProgress, attemptDto, attemptReview, parseJson };
