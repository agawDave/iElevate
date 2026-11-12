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

// Program analytics: new (incoming), ongoing and completed learners per topic,
// and each specialist's counts and weekly trend.
async function analytics(req, res) {
  res.json({ success: true, data: await programAnalytics() });
}

module.exports = { analytics, updateUserStatus };
