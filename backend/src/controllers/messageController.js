const { pool } = require('../config/db');
const { findAccessibleConversation } = require('../lib/moduleConversationAccess');
const { loadInbox, summarize } = require('../lib/conversationInbox');

async function getMessageNotifications(req, res) {
  const [rows] = await pool.query(
    `SELECT c.id AS conversation_id, c.module_id, lm.title AS module_title,
            other.full_name AS sender_name, MAX(m.created_at) AS last_message_at,
            COUNT(m.id) AS unread_count,
            (SELECT latest.body FROM messages latest
             WHERE latest.conversation_id = c.id
             ORDER BY latest.created_at DESC LIMIT 1) AS last_message
     FROM conversations c
     JOIN learning_modules lm ON lm.id = c.module_id AND lm.approval_status = 'approved'
     JOIN users other ON other.id = IF(c.user_a_id = CAST(? AS UNSIGNED), c.user_b_id, c.user_a_id)
     JOIN messages m ON m.conversation_id = c.id
       AND m.sender_id <> CAST(? AS UNSIGNED) AND m.read_at IS NULL
     WHERE (c.user_a_id = CAST(? AS UNSIGNED) OR c.user_b_id = CAST(? AS UNSIGNED))
       AND (
         (
           lm.is_elevate_program = 1
           AND EXISTS (
             SELECT 1 FROM elevate_module_assignments assignment
             WHERE assignment.module_id = c.module_id
               AND assignment.assignment_status = 'assigned'
               AND (
                 (assignment.beneficiary_id = c.user_a_id AND assignment.specialist_id = c.user_b_id)
                 OR (assignment.beneficiary_id = c.user_b_id AND assignment.specialist_id = c.user_a_id)
               )
           )
         )
         OR (
           lm.is_elevate_program = 0
           AND EXISTS (
             SELECT 1 FROM module_connections mc
             WHERE mc.module_id = c.module_id
               AND (
                 (c.user_a_id = lm.owner_id AND c.user_b_id = mc.beneficiary_id)
                 OR (c.user_b_id = lm.owner_id AND c.user_a_id = mc.beneficiary_id)
               )
           )
         )
       )
     GROUP BY c.id, c.module_id, lm.title, other.full_name
     ORDER BY last_message_at DESC`,
    [req.user.id, req.user.id, req.user.id, req.user.id]
  );
  res.json({ success: true, data: rows });
}

async function getModuleConversations(req, res) {
  const [modules] = await pool.query(
    "SELECT id, owner_id, is_elevate_program FROM learning_modules WHERE id = ? AND approval_status = 'approved'",
    [req.params.moduleId]
  );
  const module = modules[0];
  if (!module || !module.owner_id) {
    if (!module || !module.is_elevate_program) {
      return res.status(404).json({ success: false, message: 'Approved ELEVATE module not found' });
    }
  }

  let specialistId = module.is_elevate_program ? null : module.owner_id;
  if (module.is_elevate_program) {
    const [users] = await pool.query('SELECT user_type FROM users WHERE id = ? AND status = \'active\'', [req.user.id]);
    if (users[0]?.user_type === 'beneficiary') {
      const [assignments] = await pool.query(
        `SELECT specialist_id, assignment_status
         FROM elevate_module_assignments
         WHERE module_id = ? AND beneficiary_id = ?`,
        [module.id, req.user.id]
      );
      if (assignments[0]?.assignment_status !== 'assigned' || !assignments[0].specialist_id) {
        return res.status(403).json({ success: false, message: 'A matching specialist has not been assigned to this ELEVATE phase yet' });
      }
      specialistId = assignments[0].specialist_id;
    } else if (users[0]?.user_type === 'specialist') {
      specialistId = req.user.id;
      const [assignments] = await pool.query(
        `SELECT beneficiary_id FROM elevate_module_assignments
         WHERE module_id = ? AND specialist_id = ? AND assignment_status = 'assigned'`,
        [module.id, specialistId]
      );
      if (!assignments.length) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this ELEVATE phase' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Only assigned learners and specialists can open this discussion' });
    }
  }

  const isOwner = String(specialistId) === String(req.user.id);
  if (!module.is_elevate_program && !isOwner) {
    const [connections] = await pool.query(
      `SELECT mc.beneficiary_id FROM module_connections mc
       WHERE mc.module_id = ? AND mc.beneficiary_id = ?`,
      [module.id, req.user.id]
    );
    if (!connections[0]) {
      return res.status(403).json({ success: false, message: 'Connect to this module before messaging its specialist' });
    }
  }

  const [beneficiaries] = module.is_elevate_program
    ? await pool.query(
      `SELECT beneficiary_id AS id FROM elevate_module_assignments
       WHERE module_id = ? AND specialist_id = ? AND assignment_status = 'assigned'`,
      [module.id, specialistId]
    )
    : await pool.query(
      `SELECT mc.beneficiary_id AS id FROM module_connections mc
       WHERE mc.module_id = ?`,
      [module.id]
    );

  for (const beneficiary of beneficiaries) {
    const [userAId, userBId] = [beneficiary.id, specialistId].sort((a, b) => a - b);
    await pool.query(
      `INSERT IGNORE INTO conversations (module_id, user_a_id, user_b_id)
       VALUES (?, ?, ?)`,
      [module.id, userAId, userBId]
    );
  }

  const [conversations] = await pool.query(
    `SELECT c.id, c.module_id, other.id AS other_user_id,
            other.full_name AS other_user_name, other.avatar_url AS other_user_avatar,
            (SELECT body FROM messages m WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT created_at FROM messages m WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
            (SELECT COUNT(*) FROM messages unread
             WHERE unread.conversation_id = c.id
               AND unread.sender_id <> CAST(? AS UNSIGNED)
               AND unread.read_at IS NULL) AS unread_count
     FROM conversations c
     JOIN learning_modules lm ON lm.id = c.module_id
     JOIN users other ON other.id = IF(c.user_a_id = ?, c.user_b_id, c.user_a_id)
     WHERE c.module_id = ? AND (c.user_a_id = ? OR c.user_b_id = ?)
       AND (
         (
           lm.is_elevate_program = 1
           AND EXISTS (
             SELECT 1 FROM elevate_module_assignments assignment
             WHERE assignment.module_id = c.module_id
               AND assignment.assignment_status = 'assigned'
               AND (
                 (assignment.beneficiary_id = c.user_a_id AND assignment.specialist_id = c.user_b_id)
                 OR (assignment.beneficiary_id = c.user_b_id AND assignment.specialist_id = c.user_a_id)
               )
           )
         )
         OR (
           lm.is_elevate_program = 0
           AND EXISTS (
             SELECT 1 FROM module_connections mc
             WHERE mc.module_id = c.module_id
               AND mc.beneficiary_id = IF(c.user_a_id = ?, c.user_b_id, c.user_a_id)
               AND lm.owner_id = IF(c.user_a_id = ?, c.user_a_id, c.user_b_id)
           )
         )
       )
       AND lm.id = ?
     ORDER BY last_message_at DESC`,
    [req.user.id, req.user.id, module.id, req.user.id, req.user.id, req.user.id, req.user.id, module.id]
  );
  res.json({ success: true, data: conversations });
}

async function markConversationRead(req, res) {
  const conversation = await findAccessibleConversation(req.params.conversationId, req.user.id);
  if (!conversation) {
    return res.status(403).json({ success: false, message: 'You do not have access to this module conversation' });
  }
  await pool.query(
    'UPDATE messages SET read_at = NOW() WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL',
    [conversation.id, req.user.id]
  );
  res.json({ success: true });
}

async function getMessages(req, res) {
  const conversation = await findAccessibleConversation(req.params.conversationId, req.user.id);
  if (!conversation) {
    return res.status(403).json({ success: false, message: 'You do not have access to this module conversation' });
  }
  // The latest 300 messages, oldest first.
  const [rows] = await pool.query(
    `SELECT * FROM (
       SELECT id, sender_id, body, attachment_url, read_at, created_at
       FROM messages WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 300
     ) latest ORDER BY created_at ASC, id ASC`,
    [conversation.id]
  );
  res.json({ success: true, data: rows });
}

// Messages inbox: every conversation grouped as incoming, ongoing or completed.
async function getInbox(req, res) {
  const moduleId = req.query.moduleId && /^\d+$/.test(String(req.query.moduleId)) ? req.query.moduleId : null;
  const items = await loadInbox(req.user.id, { moduleId });
  res.json({ success: true, data: { summary: summarize(items), conversations: items } });
}

module.exports = { getMessageNotifications, getModuleConversations, getMessages, markConversationRead, getInbox };
