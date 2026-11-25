const { pool } = require('../config/db');

// The notification bell: this person's latest notices and how many are unread.
async function listMyNotifications(req, res) {
  const [rows] = await pool.query(
    'SELECT id, body, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20',
    [req.user.id]
  );
  const [[unread]] = await pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
  res.json({
    success: true,
    data: {
      unread: Number(unread.n),
      items: rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.created_at, read: Boolean(row.read_at) })),
    },
  });
}

// Marks one notice (body.id) or all of them as read.
async function markNotificationsRead(req, res) {
  const id = req.body?.id;
  if (id !== undefined && !(Number.isInteger(id) && id > 0)) {
    return res.status(400).json({ success: false, message: 'Invalid notification' });
  }
  await pool.query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL${id === undefined ? '' : ' AND id = ?'}`,
    id === undefined ? [req.user.id] : [req.user.id, id]
  );
  res.json({ success: true });
}

module.exports = { listMyNotifications, markNotificationsRead };
