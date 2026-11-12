const { pool } = require('../config/db');

// Records one thing a user did (table user_activity_log). Called after
// the action succeeded; a logging problem never breaks the action itself.
//   userId       - who did it
//   action       - e.g. 'login', 'applied', 'accepted', 'message_sent'
//   moduleId     - the topic, if any
//   targetUserId - the other person, if any (the learner or the specialist)
//   details      - a short note, e.g. 'Correct' or 'Pre-test'
async function logActivity({ userId, action, moduleId = null, targetUserId = null, details = null }) {
  if (!userId || !action) return;
  try {
    await pool.query(
      'INSERT INTO user_activity_log (user_id, action, module_id, target_user_id, details) VALUES (?, ?, ?, ?, ?)',
      [userId, action, moduleId || null, targetUserId || null, details ? String(details).slice(0, 255) : null]
    );
  } catch (error) {
    console.error(`Activity log failed (${action}):`, error.message);
  }
}

module.exports = { logActivity };
