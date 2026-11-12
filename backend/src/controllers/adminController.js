const { pool } = require('../config/db');
const { programAnalytics } = require('../lib/elevateAnalytics');

async function updateUserStatus(req, res) {
  const { userId } = req.params;
  const { status } = req.body;
  const allowed = ['active', 'suspended', 'banned', 'deleted'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  // Locking yourself out would leave nobody to undo it.
  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ success: false, message: 'You cannot change the status of your own account.' });
  }
  const [result] = await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, message: `User status updated to ${status}` });
}

async function listDisputes(req, res) {
  const [rows] = await pool.query(
    `SELECT d.id, d.reason, d.status, d.created_at, d.exchange_id,
            u.full_name AS raised_by_name
     FROM disputes d JOIN users u ON u.id = d.raised_by
     ORDER BY d.created_at DESC`
  );
  res.json({ success: true, data: rows });
}

async function resolveDispute(req, res) {
  const { disputeId } = req.params;
  const { status, resolutionNotes } = req.body;
  const allowed = ['under_review', 'resolved', 'dismissed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  await pool.query(
    `UPDATE disputes SET status = ?, resolution_notes = ?, resolved_by = ?, resolved_at = NOW()
     WHERE id = ?`,
    [status, resolutionNotes || null, req.user.id, disputeId]
  );
  res.json({ success: true, message: 'Dispute updated' });
}

async function systemStats(req, res) {
  const [[userCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
  const [[exchangeCount]] = await pool.query('SELECT COUNT(*) AS count FROM skill_exchanges');
  const [[activeExchanges]] = await pool.query(
    `SELECT COUNT(*) AS count FROM skill_exchanges WHERE status IN ('scheduled','in_progress')`
  );
  const [[credentialCount]] = await pool.query(
    `SELECT COUNT(*) AS count FROM credentials WHERE status = 'minted'`
  );
  const [[openDisputes]] = await pool.query(
    `SELECT COUNT(*) AS count FROM disputes WHERE status IN ('open','under_review')`
  );

  res.json({
    success: true,
    data: {
      totalUsers: userCount.count,
      totalExchanges: exchangeCount.count,
      activeExchanges: activeExchanges.count,
      credentialsIssued: credentialCount.count,
      openDisputes: openDisputes.count,
    },
  });
}

// Program analytics: new (incoming), ongoing and completed learners per topic,
// and each specialist's counts and weekly trend.
async function analytics(req, res) {
  res.json({ success: true, data: await programAnalytics() });
}

module.exports = { analytics, updateUserStatus, listDisputes, resolveDispute, systemStats };
