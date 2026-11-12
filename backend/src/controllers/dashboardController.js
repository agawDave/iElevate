const { pool } = require('../config/db');
const { specialistAnalytics } = require('../lib/elevateAnalytics');

async function getSummary(req, res) {
  const userId = req.user.id;

  const [[{ activeExchanges }]] = await pool.query(
    `SELECT COUNT(*) AS activeExchanges FROM skill_exchanges
     WHERE (user_a_id = ? OR user_b_id = ?)
       AND status IN ('proposed', 'scheduled', 'in_progress')`,
    [userId, userId]
  );

  const [[{ activeModuleSessions }]] = await pool.query(
    `SELECT COUNT(*) AS activeModuleSessions FROM module_sessions
     WHERE (beneficiary_id = ? OR specialist_id = ?)
       AND status IN ('pending', 'confirmed')`,
    [userId, userId]
  );

  const [[{ pendingModuleSessions }]] = await pool.query(
    `SELECT COUNT(*) AS pendingModuleSessions FROM module_sessions
     WHERE (beneficiary_id = ? OR specialist_id = ?)
       AND status = 'pending'`,
    [userId, userId]
  );

  const [[{ skillCredentials }]] = await pool.query(
    `SELECT COUNT(*) AS skillCredentials FROM credentials
     WHERE recipient_id = ? AND status = 'minted'`,
    [userId]
  );
  const [[{ moduleCertificates }]] = await pool.query(
    'SELECT COUNT(*) AS moduleCertificates FROM module_certificates WHERE user_id = ?',
    [userId]
  );

  res.json({
    success: true,
    data: {
      activeExchanges: Number(activeExchanges) + Number(activeModuleSessions),
      pendingMatches: Number(pendingModuleSessions),
      credentialsEarned: Number(skillCredentials) + Number(moduleCertificates),
    },
  });
}

// Specialist dashboard: their incoming, ongoing and completed learners.
async function getSpecialistAnalytics(req, res) {
  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'specialist') {
    return res.status(403).json({ success: false, message: 'Only specialists have learner analytics' });
  }
  res.json({ success: true, data: await specialistAnalytics(req.user.id) });
}

module.exports = { getSummary, getSpecialistAnalytics };
