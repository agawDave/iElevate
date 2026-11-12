const { pool } = require('../config/db');
const { sessionActions, readSessionInput, announceSessionChange } = require('../lib/moduleSessions');
const { logActivity } = require('../lib/activityLog');

async function assertExchangeMember(exchangeId, userId) {
  const [rows] = await pool.query(
    'SELECT id, user_a_id, user_b_id FROM skill_exchanges WHERE id = ?',
    [exchangeId]
  );
  const exchange = rows[0];
  if (!exchange || (exchange.user_a_id !== userId && exchange.user_b_id !== userId)) {
    return null;
  }
  return exchange;
}

async function createSession(req, res) {
  const { exchangeId, title, startsAt, endsAt, meetingLink } = req.body;

  const exchange = await assertExchangeMember(exchangeId, req.user.id);
  if (!exchange) {
    return res.status(403).json({ success: false, message: 'You are not part of this exchange' });
  }

  const [result] = await pool.query(
    `INSERT INTO sessions (exchange_id, scheduled_by, title, starts_at, ends_at, meeting_link)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [exchangeId, req.user.id, title || null, startsAt, endsAt, meetingLink || null]
  );

  await pool.query(
    `UPDATE skill_exchanges SET status = 'scheduled' WHERE id = ? AND status = 'proposed'`,
    [exchangeId]
  );

  res.status(201).json({ success: true, data: { sessionId: result.insertId } });
}

async function listMySessions(req, res) {
  const [rows] = await pool.query(
    `SELECT s.id, s.exchange_id, s.title, s.starts_at, s.ends_at, s.meeting_link, s.status,
            s.scheduled_by,
            e.user_a_id, e.user_b_id, e.skill_a_id, e.skill_b_id,
            other.id AS other_user_id, other.full_name AS other_user_name,
            skill_a.name AS skill_a_name, skill_b.name AS skill_b_name
     FROM sessions s
     JOIN skill_exchanges e ON e.id = s.exchange_id
     JOIN users other ON other.id = IF(e.user_a_id = ?, e.user_b_id, e.user_a_id)
     JOIN skills skill_a ON skill_a.id = e.skill_a_id
     JOIN skills skill_b ON skill_b.id = e.skill_b_id
     WHERE e.user_a_id = ? OR e.user_b_id = ?
     ORDER BY s.starts_at ASC`,
    [req.user.id, req.user.id, req.user.id]
  );

  const data = rows.map((r) => ({
    id: r.id,
    exchangeId: r.exchange_id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    meetingLink: r.meeting_link,
    status: r.status,
    scheduledByMe: r.scheduled_by === req.user.id,
    otherUserId: r.other_user_id,
    otherUserName: r.other_user_name,
    // Skill I teach them vs. skill they teach me, from my perspective
    iTeach: r.user_a_id === req.user.id ? r.skill_a_name : r.skill_b_name,
    theyTeach: r.user_a_id === req.user.id ? r.skill_b_name : r.skill_a_name,
  }));

  res.json({ success: true, data });
}

async function updateSessionStatus(req, res) {
  const { sessionId } = req.params;
  const { status } = req.body;
  const allowed = ['confirmed', 'cancelled', 'completed', 'no_show'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const [rows] = await pool.query(
    `SELECT s.id, e.user_a_id, e.user_b_id FROM sessions s
     JOIN skill_exchanges e ON e.id = s.exchange_id WHERE s.id = ?`,
    [sessionId]
  );
  const session = rows[0];
  if (!session || (session.user_a_id !== req.user.id && session.user_b_id !== req.user.id)) {
    return res.status(403).json({ success: false, message: 'You are not part of this session' });
  }

  await pool.query('UPDATE sessions SET status = ? WHERE id = ?', [status, sessionId]);
  res.json({ success: true, message: `Session ${status}` });
}

// A learner requests a session with their specialist, or (ELEVATE topics) a
// specialist requests one with a learner matched to them (body.beneficiaryId).
// The other person accepts it on their Sessions page.
async function createModuleSession(req, res) {
  const { moduleId } = req.params;
  const { title } = req.body;
  const [modules] = await pool.query(
    "SELECT id, title, owner_id, is_elevate_program FROM learning_modules WHERE id = ? AND approval_status = 'approved'",
    [moduleId]
  );
  const module = modules[0];
  if (!module) return res.status(404).json({ success: false, message: 'Approved specialist module not found' });
  const input = readSessionInput(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const { startsAt, endsAt, meetingLink } = input.value;
  let specialistId = module.owner_id;
  let beneficiaryId = req.user.id;
  if (module.is_elevate_program) {
    const [users] = await pool.query('SELECT user_type FROM users WHERE id = ? AND status = \'active\'', [req.user.id]);
    const userType = users[0]?.user_type;
    if (userType === 'beneficiary') {
      const [assignments] = await pool.query(
        `SELECT specialist_id FROM elevate_module_assignments
         WHERE module_id = ? AND beneficiary_id = ? AND assignment_status = 'assigned'`,
        [module.id, req.user.id]
      );
      if (!assignments[0]?.specialist_id) {
        return res.status(409).json({ success: false, message: 'This topic is waiting for a matching specialist' });
      }
      specialistId = assignments[0].specialist_id;
    } else if (userType === 'specialist') {
      const [assignments] = await pool.query(
        `SELECT beneficiary_id FROM elevate_module_assignments
         WHERE module_id = ? AND beneficiary_id = ? AND specialist_id = ? AND assignment_status = 'assigned'`,
        [module.id, req.body.beneficiaryId, req.user.id]
      );
      if (!assignments[0]) {
        return res.status(403).json({ success: false, message: 'You can only propose sessions to learners matched to you on this topic' });
      }
      specialistId = req.user.id;
      beneficiaryId = assignments[0].beneficiary_id;
    } else {
      return res.status(403).json({ success: false, message: 'Only a matched learner or specialist can propose a session' });
    }
  } else {
    if (!module.owner_id) return res.status(404).json({ success: false, message: 'Approved specialist module not found' });
    if (module.owner_id === req.user.id) return res.status(400).json({ success: false, message: 'A specialist cannot book a beneficiary session from their own module' });
    const [connections] = await pool.query(
      'SELECT beneficiary_id FROM module_connections WHERE module_id = ? AND beneficiary_id = ?',
      [module.id, req.user.id]
    );
    if (!connections[0]) return res.status(403).json({ success: false, message: 'Connect to this module before booking a session' });
  }

  const [result] = await pool.query(
    `INSERT INTO module_sessions (module_id, beneficiary_id, specialist_id, title, starts_at, ends_at, meeting_link, scheduled_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [module.id, beneficiaryId, specialistId, (typeof title === 'string' && title.trim().slice(0, 190)) || `${module.title} learning session`,
      startsAt, endsAt, meetingLink, req.user.id]
  );
  await announceSessionChange(req.app, {
    id: result.insertId, module_id: module.id, beneficiary_id: beneficiaryId, specialist_id: specialistId,
  }, req.user.id, 'proposed');
  await logActivity({
    userId: req.user.id, action: 'session_booked', moduleId: module.id,
    targetUserId: Number(req.user.id) === Number(beneficiaryId) ? specialistId : beneficiaryId,
  });
  res.status(201).json({ success: true, message: 'Session requested. It is booked once they accept it.', data: { sessionId: result.insertId } });
}

async function listMyModuleSessions(req, res) {
  const [rows] = await pool.query(
    `SELECT ms.id, ms.module_id, ms.beneficiary_id, ms.title, ms.starts_at, ms.ends_at, ms.meeting_link, ms.status,
            ms.scheduled_by, lm.title AS module_title, u.id AS specialist_id, u.full_name AS specialist_name,
            beneficiary.id AS beneficiary_id, beneficiary.full_name AS beneficiary_name,
            IF(ms.beneficiary_id = ?, u.id, beneficiary.id) AS other_user_id,
            IF(ms.beneficiary_id = ?, u.full_name, beneficiary.full_name) AS other_user_name,
            (SELECT c.id FROM conversations c
             WHERE c.module_id = ms.module_id
               AND c.user_a_id = LEAST(ms.beneficiary_id, ms.specialist_id)
               AND c.user_b_id = GREATEST(ms.beneficiary_id, ms.specialist_id)) AS conversation_id
     FROM module_sessions ms
     JOIN learning_modules lm ON lm.id = ms.module_id
     JOIN users u ON u.id = ms.specialist_id
     JOIN users beneficiary ON beneficiary.id = ms.beneficiary_id
     WHERE ms.beneficiary_id = ? OR ms.specialist_id = ? ORDER BY ms.starts_at ASC`,
    [req.user.id, req.user.id, req.user.id, req.user.id]
  );
  res.json({ success: true, data: rows.map((row) => ({
    id: `module-${row.id}`, moduleSessionId: row.id, moduleId: row.module_id, title: row.title,
    moduleTitle: row.module_title, startsAt: row.starts_at, endsAt: row.ends_at, meetingLink: row.meeting_link,
    status: row.status, scheduledByMe: Number(row.scheduled_by) === Number(req.user.id), otherUserId: row.other_user_id,
    otherUserName: row.other_user_name, iTeach: row.module_title, theyTeach: 'Module guidance',
    isSpecialist: Number(row.specialist_id) === Number(req.user.id),
    conversationId: row.conversation_id || null,
    ...sessionActions(row, req.user.id),
  })) });
}

const STATUS_RULES = {
  confirmed: { allowed: 'canConfirm', refusal: 'Only the other person can accept this session, while it is still waiting.', message: 'Session accepted. It is booked.' },
  cancelled: { allowed: 'canCancel', refusal: 'This session can no longer be cancelled.', message: 'Session cancelled.' },
  completed: { allowed: 'canComplete', refusal: 'Only the specialist can mark a booked session as done, once it has started.', message: 'Session marked as done.' },
  no_show: { allowed: 'canComplete', refusal: 'Only the specialist can mark a booked session as missed, once it has started.', message: 'Session marked as missed.' },
};

async function updateModuleSessionStatus(req, res) {
  const { sessionId } = req.params;
  const rule = STATUS_RULES[req.body.status];
  if (!rule) return res.status(400).json({ success: false, message: 'Invalid status' });
  const [rows] = await pool.query(
    'SELECT * FROM module_sessions WHERE id = ? AND (beneficiary_id = ? OR specialist_id = ?)',
    [sessionId, req.user.id, req.user.id]
  );
  const session = rows[0];
  if (!session) return res.status(403).json({ success: false, message: 'You are not part of this session' });
  if (!sessionActions(session, req.user.id)[rule.allowed]) return res.status(409).json({ success: false, message: rule.refusal });
  await pool.query('UPDATE module_sessions SET status = ? WHERE id = ?', [req.body.status, sessionId]);
  await announceSessionChange(req.app, session, req.user.id, req.body.status);
  await logActivity({
    userId: req.user.id, action: `session_${req.body.status}`, moduleId: session.module_id,
    targetUserId: Number(req.user.id) === Number(session.beneficiary_id) ? session.specialist_id : session.beneficiary_id,
  });
  res.json({ success: true, message: rule.message });
}

module.exports = {
  createSession,
  listMySessions,
  updateSessionStatus,
  createModuleSession,
  listMyModuleSessions,
  updateModuleSessionStatus,
};
