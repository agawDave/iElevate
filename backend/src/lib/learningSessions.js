const { pool } = require('../config/db');

// An online session is one time a beneficiary worked on a specialist's module
// online: took the pre-test ('pre_test'), answered an activity ('activity') or
// took the post-test ('post_test'). Each one is its own session. (Face-to-face
// sessions are booked, in module_sessions.)
async function recordLearningSession({ moduleId, beneficiaryId, specialistId, kind }) {
  if (!moduleId || !beneficiaryId || !specialistId) return;
  try {
    await pool.query(
      'INSERT INTO learning_sessions (module_id, beneficiary_id, specialist_id, kind) VALUES (?, ?, ?, ?)',
      [moduleId, beneficiaryId, specialistId, kind]
    );
  } catch (error) {
    // The answer or test is already saved; a missed session record mustn't undo it.
    console.error('Could not record the online session:', error.message);
  }
}

module.exports = { recordLearningSession };
