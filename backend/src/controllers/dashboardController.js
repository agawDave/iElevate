const { pool } = require('../config/db');
const { specialistAnalytics } = require('../lib/elevateAnalytics');

// Specialist dashboard: their incoming, ongoing and completed learners.
async function getSpecialistAnalytics(req, res) {
  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'specialist') {
    return res.status(403).json({ success: false, message: 'Only specialists have learner analytics' });
  }
  res.json({ success: true, data: await specialistAnalytics(req.user.id) });
}

module.exports = { getSpecialistAnalytics };
