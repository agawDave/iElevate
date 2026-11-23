const { pool } = require('../config/db');

// An online session is a day a beneficiary worked on a specialist's module online:
// answered an activity or took the pre-test or post-test. The first of these on a
// day starts the session; later ones the same day are added to it. (Face-to-face
// sessions are booked, in module_sessions.)
async function recordLearningSession({ moduleId, beneficiaryId, specialistId, answers = 0, preTest = false, postTest = false }) {
  if (!moduleId || !beneficiaryId || !specialistId) return;
  try {
    await pool.query(
      `INSERT INTO learning_sessions
         (module_id, beneficiary_id, specialist_id, session_date, started_at, ended_at, answers, pre_test, post_test)
       VALUES (?, ?, ?, CURDATE(), NOW(), NOW(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ended_at = GREATEST(ended_at, VALUES(ended_at)),
         answers = answers + VALUES(answers),
         pre_test = GREATEST(pre_test, VALUES(pre_test)),
         post_test = GREATEST(post_test, VALUES(post_test))`,
      [moduleId, beneficiaryId, specialistId, answers, preTest ? 1 : 0, postTest ? 1 : 0]
    );
  } catch (error) {
    // The answer or test is already saved; a missed session record mustn't undo it.
    console.error('Could not record the online session:', error.message);
  }
}

module.exports = { recordLearningSession };
