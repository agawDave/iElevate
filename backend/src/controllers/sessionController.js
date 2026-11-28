const { pool } = require('../config/db');
const { sessionActions, readSessionInput, announceSessionChange, announceToUsers } = require('../lib/moduleSessions');
const { logActivity } = require('../lib/activityLog');
const { offeredSql } = require('../lib/programPhases');
const { livesAbroad, localSql } = require('../lib/places');
const { circumstancesFromRow, describeSlots, fitsFreeTime } = require('../lib/elevateCircumstances');

// Face-to-face sessions are for beneficiaries in the Philippines.
const ABROAD_MESSAGE = 'You live outside the Philippines, so you learn online only. Face-to-face sessions are for beneficiaries in the Philippines.';

// Sessions come in two kinds:
//   - online sessions: automatic, one each time a beneficiary takes a topic's
//     pre-test or post-test or answers an activity
//     (learning_sessions, recorded in lib/learningSessions.js);
//   - face-to-face sessions: set by the specialist. A session on a topic
//     (is_open = 1) is for the learners they accepted on it, who are notified
//     and can say they'll attend; or one-on-one with one learner, who accepts.
//     Beneficiaries don't book sessions.

// A specialist's sessions on a topic are for the beneficiaries they accepted on
// it who haven't finished it yet.
const LEARNER_OF_SQL = (moduleColumn, specialistColumn) => `EXISTS (SELECT 1 FROM elevate_module_assignments mine
    WHERE mine.module_id = ${moduleColumn} AND mine.specialist_id = ${specialistColumn}
      AND mine.beneficiary_id = ? AND mine.assignment_status = 'assigned')
  AND NOT EXISTS (SELECT 1 FROM module_certificates done WHERE done.module_id = ${moduleColumn} AND done.user_id = ?)`;

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

async function accountOf(userId) {
  const [[user]] = await pool.query("SELECT user_type, country, full_name FROM users WHERE id = ? AND status = 'active'", [userId]);
  return user || null;
}

async function userTypeOf(userId) {
  return (await accountOf(userId))?.user_type || null;
}

// The topics a specialist teaches (or still has learners on).
async function teachingTopics(specialistId) {
  const [rows] = await pool.query(
    `SELECT lm.id, lm.title, lm.phase FROM learning_modules lm
     WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND (
       EXISTS (SELECT 1 FROM module_skills mk JOIN user_skills us ON us.skill_id = mk.skill_id AND us.relation_type = 'teaches' AND us.user_id = ?
               WHERE mk.module_id = lm.id AND mk.is_primary = 1 AND ${offeredSql('lm')})
       OR EXISTS (SELECT 1 FROM elevate_module_assignments a WHERE a.module_id = lm.id AND a.specialist_id = ? AND a.assignment_status = 'assigned'))
     ORDER BY lm.sort_order, lm.id`,
    [specialistId, specialistId]
  );
  return rows;
}

// The specialist's name and free times from My Teaching Plan ("wed-morning", ...).
async function freeTimesOf(specialistId) {
  const [[row]] = await pool.query(
    `SELECT u.full_name, c.availability FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id WHERE u.id = ?`,
    [specialistId]
  );
  return { name: row?.full_name || 'The specialist', slots: circumstancesFromRow(row).availability };
}

// Face-to-face sessions are held in the specialist's free times. Returns the refusal, or null.
async function freeTimeError(specialistId, userId, startsAt, endsAt) {
  const { name, slots } = await freeTimesOf(specialistId);
  const mine = Number(specialistId) === Number(userId);
  if (!slots.length) {
    return mine ? 'Set your free times in My Teaching Plan first.' : `${name} hasn't set their free times yet, so a session can't be booked.`;
  }
  if (fitsFreeTime(slots, startsAt, endsAt)) return null;
  return `Choose a time when ${mine ? 'you are' : `${name} is`} free: ${describeSlots(slots)}.`;
}

// Who a one-on-one session on this module is between when this user books it:
// on ELEVATE topics, a specialist with a learner matched to them (learnerId).
// Beneficiaries don't book; their specialist sets the sessions. Returns { module, specialistId,
// beneficiaryId }, or { status, message } when they can't book it.
async function bookingPair(moduleId, userId, learnerId) {
  const [modules] = await pool.query(
    "SELECT id, title, owner_id, is_elevate_program FROM learning_modules WHERE id = ? AND approval_status = 'approved'",
    [moduleId]
  );
  const module = modules[0];
  if (!module) return { status: 404, message: 'Approved specialist module not found' };
  if (module.is_elevate_program) {
    const userType = await userTypeOf(userId);
    if (userType === 'beneficiary') {
      return { status: 403, message: 'Your specialist sets the face-to-face sessions. You get a notification when they do.' };
    }
    if (userType === 'specialist') {
      const [assignments] = await pool.query(
        `SELECT beneficiary_id FROM elevate_module_assignments
         WHERE module_id = ? AND beneficiary_id = ? AND specialist_id = ? AND assignment_status = 'assigned'`,
        [module.id, learnerId, userId]
      );
      if (!assignments[0]) return { status: 403, message: 'You can only propose sessions to learners matched to you on this topic' };
      return { module, specialistId: userId, beneficiaryId: assignments[0].beneficiary_id };
    }
    return { status: 403, message: 'Only a matched learner or specialist can propose a session' };
  }
  if (!module.owner_id) return { status: 404, message: 'Approved specialist module not found' };
  if (module.owner_id === userId) return { status: 400, message: 'A specialist cannot book a beneficiary session from their own module' };
  const [connections] = await pool.query(
    'SELECT beneficiary_id FROM module_connections WHERE module_id = ? AND beneficiary_id = ?',
    [module.id, userId]
  );
  if (!connections[0]) return { status: 403, message: 'Connect to this module before booking a session' };
  return { module, specialistId: module.owner_id, beneficiaryId: userId };
}

// The specialist's free times for the one-on-one booking form.
async function getBookingFreeTimes(req, res) {
  const pair = await bookingPair(req.params.moduleId, req.user.id, req.query.beneficiaryId);
  if (pair.status) return res.status(pair.status).json({ success: false, message: pair.message });
  const { name, slots } = await freeTimesOf(pair.specialistId);
  res.json({ success: true, data: { specialistName: name, isMe: Number(pair.specialistId) === Number(req.user.id), slots } });
}

// A learner requests a face-to-face session with their specialist, or a
// specialist with a learner matched to them (body.beneficiaryId). The other
// person accepts it on their Sessions page.
async function createModuleSession(req, res) {
  const pair = await bookingPair(req.params.moduleId, req.user.id, req.body.beneficiaryId);
  if (pair.status) return res.status(pair.status).json({ success: false, message: pair.message });
  const { module, specialistId, beneficiaryId } = pair;
  const input = readSessionInput(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const { startsAt, endsAt, meetingLink } = input.value;
  const learner = await accountOf(beneficiaryId);
  if (livesAbroad(learner?.country)) {
    return res.status(403).json({
      success: false,
      message: Number(beneficiaryId) === Number(req.user.id)
        ? ABROAD_MESSAGE
        : `${learner.full_name} lives outside the Philippines, so they learn online only. Face-to-face sessions are for beneficiaries in the Philippines.`,
    });
  }
  const notFree = await freeTimeError(specialistId, req.user.id, startsAt, endsAt);
  if (notFree) return res.status(400).json({ success: false, message: notFree });

  const [result] = await pool.query(
    `INSERT INTO module_sessions (module_id, beneficiary_id, specialist_id, title, starts_at, ends_at, meeting_link, scheduled_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [module.id, beneficiaryId, specialistId, (typeof req.body.title === 'string' && req.body.title.trim().slice(0, 190)) || `${module.title} face-to-face session`,
      startsAt, endsAt, meetingLink, req.user.id]
  );
  await announceSessionChange(req.app, {
    id: result.insertId, module_id: module.id, beneficiary_id: beneficiaryId, specialist_id: specialistId, starts_at: startsAt,
  }, req.user.id, 'proposed');
  await logActivity({
    userId: req.user.id, action: 'session_booked', moduleId: module.id,
    targetUserId: Number(req.user.id) === Number(beneficiaryId) ? specialistId : beneficiaryId,
  });
  res.status(201).json({ success: true, message: 'Session requested. It is booked once they accept it.', data: { sessionId: result.insertId } });
}

// A specialist sets a face-to-face session on a topic they teach. The learners
// they accepted on it are notified and can say they'll attend.
async function createOpenSession(req, res) {
  const me = req.user.id;
  if (await userTypeOf(me) !== 'specialist') return res.status(403).json({ success: false, message: 'Only specialists can set a face-to-face session.' });
  const topic = (await teachingTopics(me)).find((row) => Number(row.id) === Number(req.body.moduleId));
  if (!topic) return res.status(403).json({ success: false, message: 'Choose one of the topics you teach.' });
  const input = readSessionInput(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const { startsAt, endsAt, meetingLink, seats } = input.value;
  const notFree = await freeTimeError(me, me, startsAt, endsAt);
  if (notFree) return res.status(400).json({ success: false, message: notFree });
  const [result] = await pool.query(
    `INSERT INTO module_sessions (module_id, beneficiary_id, specialist_id, is_open, title, starts_at, ends_at, meeting_link, seats, status, scheduled_by)
     VALUES (?, NULL, ?, 1, ?, ?, ?, ?, ?, 'confirmed', ?)`,
    [topic.id, me, `${topic.title} face-to-face session`, startsAt, endsAt, meetingLink, seats, me]
  );
  const [interested] = await pool.query(
    `SELECT DISTINCT a.beneficiary_id AS id FROM elevate_module_assignments a
     JOIN users u ON u.id = a.beneficiary_id AND u.status = 'active' AND ${localSql('u')}
     WHERE a.module_id = ? AND a.specialist_id = ? AND a.assignment_status = 'assigned'
       AND NOT EXISTS (SELECT 1 FROM module_certificates mc WHERE mc.module_id = a.module_id AND mc.user_id = a.beneficiary_id)`,
    [topic.id, me]
  );
  await announceToUsers(req.app, interested.map((row) => row.id), { moduleId: topic.id, actorId: me, kind: 'posted', text: 'set a face-to-face session', startsAt });
  await logActivity({ userId: me, action: 'session_posted', moduleId: topic.id });
  res.status(201).json({
    success: true,
    message: interested.length
      ? `Session set. ${plural(interested.length, 'learner')} on this topic got a notification.`
      : 'Session set. Learners you accept on this topic will see it.',
    data: { sessionId: result.insertId },
  });
}

// Beneficiaries: their specialists' upcoming sessions they haven't said they'll attend.
// Specialists: the topics they can set one for.
async function listOpenSessions(req, res) {
  const me = req.user.id;
  const account = await accountOf(me);
  const userType = account?.user_type || null;
  if (userType === 'beneficiary' && livesAbroad(account.country)) {
    return res.json({ success: true, data: { sessions: [], topics: [], onlineOnly: true } });
  }
  if (userType === 'specialist') {
    const topics = await teachingTopics(me);
    return res.json({ success: true, data: { sessions: [], topics: topics.map((row) => ({ id: row.id, title: row.title, phase: row.phase })) } });
  }
  if (userType !== 'beneficiary') return res.json({ success: true, data: { sessions: [], topics: [] } });
  const [rows] = await pool.query(
    `SELECT ms.id, ms.module_id, ms.starts_at, ms.ends_at, ms.meeting_link, ms.seats, lm.title AS module_title, s.full_name AS specialist_name,
            (SELECT COUNT(*) FROM module_session_attendees sa WHERE sa.session_id = ms.id) AS joined_count
     FROM module_sessions ms
     JOIN learning_modules lm ON lm.id = ms.module_id
     JOIN users s ON s.id = ms.specialist_id
     WHERE ms.is_open = 1 AND ms.status = 'confirmed' AND ms.starts_at > NOW()
       AND NOT EXISTS (SELECT 1 FROM module_session_attendees mine WHERE mine.session_id = ms.id AND mine.beneficiary_id = ?)
       AND ${LEARNER_OF_SQL('ms.module_id', 'ms.specialist_id')}
     ORDER BY ms.starts_at`,
    [me, me, me]
  );
  res.json({ success: true, data: { topics: [], onlineOnly: false, sessions: rows.map((row) => {
    const seats = row.seats === null ? null : Number(row.seats);
    const joinedCount = Number(row.joined_count);
    return {
      moduleSessionId: row.id, moduleId: row.module_id, moduleTitle: row.module_title, specialistName: row.specialist_name,
      startsAt: row.starts_at, endsAt: row.ends_at, place: row.meeting_link, seats, joinedCount, full: seats !== null && joinedCount >= seats,
    };
  }) } });
}

async function findOpenSession(sessionId) {
  const [[session]] = await pool.query(
    `SELECT ms.*, (SELECT COUNT(*) FROM module_session_attendees sa WHERE sa.session_id = ms.id) AS joined_count
     FROM module_sessions ms WHERE ms.id = ? AND ms.is_open = 1`,
    [sessionId]
  );
  return session || null;
}

async function joinOpenSession(req, res) {
  const me = req.user.id;
  const session = await findOpenSession(req.params.sessionId);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.status !== 'confirmed' || new Date(session.starts_at) <= new Date()) {
    return res.status(409).json({ success: false, message: 'This session has already started or was cancelled.' });
  }
  const account = await accountOf(me);
  if (account?.user_type !== 'beneficiary') return res.status(403).json({ success: false, message: 'Only beneficiaries can join a session.' });
  if (livesAbroad(account.country)) return res.status(403).json({ success: false, message: ABROAD_MESSAGE });
  const [[mine]] = await pool.query(`SELECT ${LEARNER_OF_SQL('?', '?')} AS ok`, [session.module_id, session.specialist_id, me, session.module_id, me]);
  if (!Number(mine.ok)) return res.status(403).json({ success: false, message: 'This session is for the learners this specialist accepted on the topic.' });
  if (session.seats !== null && Number(session.joined_count) >= Number(session.seats)) {
    return res.status(409).json({ success: false, message: 'This session is full.' });
  }
  const [result] = await pool.query('INSERT IGNORE INTO module_session_attendees (session_id, beneficiary_id) VALUES (?, ?)', [session.id, me]);
  if (result.affectedRows) {
    await logActivity({ userId: me, action: 'session_joined', moduleId: session.module_id, targetUserId: session.specialist_id });
    await announceToUsers(req.app, [session.specialist_id], { moduleId: session.module_id, actorId: me, kind: 'joined', text: 'joined your face-to-face session', startsAt: session.starts_at });
  }
  res.json({ success: true, message: 'You joined. It is on your list of upcoming sessions.' });
}

async function leaveOpenSession(req, res) {
  const me = req.user.id;
  const session = await findOpenSession(req.params.sessionId);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
  if (session.status !== 'confirmed' || new Date(session.starts_at) <= new Date()) {
    return res.status(409).json({ success: false, message: 'This session has already started, so you can no longer leave it.' });
  }
  const [result] = await pool.query('DELETE FROM module_session_attendees WHERE session_id = ? AND beneficiary_id = ?', [session.id, me]);
  if (result.affectedRows) await logActivity({ userId: me, action: 'session_left', moduleId: session.module_id, targetUserId: session.specialist_id });
  res.json({ success: true, message: 'You left the session.' });
}

// Face-to-face sessions this person is part of: one-on-one, open ones they
// posted (with who joined), and open ones they joined.
async function listMyModuleSessions(req, res) {
  const me = Number(req.user.id);
  const [rows] = await pool.query(
    `SELECT ms.id, ms.module_id, ms.beneficiary_id, ms.specialist_id, ms.is_open, ms.seats, ms.title, ms.starts_at, ms.ends_at,
            ms.meeting_link, ms.status, ms.scheduled_by, lm.title AS module_title,
            s.full_name AS specialist_name, b.full_name AS beneficiary_name,
            (SELECT COUNT(*) FROM module_session_attendees sa WHERE sa.session_id = ms.id) AS joined_count,
            EXISTS (SELECT 1 FROM module_session_attendees sa WHERE sa.session_id = ms.id AND sa.beneficiary_id = ?) AS joined_by_me,
            (SELECT c.id FROM conversations c
             WHERE c.module_id = ms.module_id
               AND c.user_a_id = LEAST(ms.beneficiary_id, ms.specialist_id)
               AND c.user_b_id = GREATEST(ms.beneficiary_id, ms.specialist_id)) AS conversation_id
     FROM module_sessions ms
     JOIN learning_modules lm ON lm.id = ms.module_id
     JOIN users s ON s.id = ms.specialist_id
     LEFT JOIN users b ON b.id = ms.beneficiary_id
     WHERE ms.beneficiary_id = ? OR ms.specialist_id = ?
        OR EXISTS (SELECT 1 FROM module_session_attendees sa WHERE sa.session_id = ms.id AND sa.beneficiary_id = ?)
     ORDER BY ms.starts_at ASC`,
    [me, me, me, me]
  );
  const [attendeeRows] = await pool.query(
    `SELECT sa.session_id, sa.beneficiary_id, sa.attended, u.full_name
     FROM module_session_attendees sa
     JOIN module_sessions ms ON ms.id = sa.session_id AND ms.specialist_id = ? AND ms.is_open = 1
     JOIN users u ON u.id = sa.beneficiary_id
     ORDER BY sa.joined_at`,
    [me]
  );
  const attendeesBy = new Map();
  attendeeRows.forEach((row) => {
    const list = attendeesBy.get(Number(row.session_id)) || [];
    list.push({ id: Number(row.beneficiary_id), name: row.full_name, attended: row.attended === null ? null : Boolean(Number(row.attended)) });
    attendeesBy.set(Number(row.session_id), list);
  });
  const now = new Date();
  res.json({ success: true, data: rows.map((row) => {
    const isSpecialist = Number(row.specialist_id) === me;
    const isOpen = Boolean(Number(row.is_open));
    const joinedByMe = Boolean(Number(row.joined_by_me));
    return {
      id: `module-${row.id}`, moduleSessionId: row.id, moduleId: row.module_id, title: row.title,
      moduleTitle: row.module_title, startsAt: row.starts_at, endsAt: row.ends_at, meetingLink: row.meeting_link,
      status: row.status, scheduledByMe: Number(row.scheduled_by) === me,
      otherUserId: isSpecialist ? row.beneficiary_id : row.specialist_id,
      otherUserName: isSpecialist ? row.beneficiary_name : row.specialist_name,
      isSpecialist,
      isOpen,
      seats: row.seats === null ? null : Number(row.seats),
      joinedCount: Number(row.joined_count),
      joinedByMe,
      attendees: isSpecialist && isOpen ? attendeesBy.get(Number(row.id)) || [] : undefined,
      conversationId: row.conversation_id || null,
      ...sessionActions(row, me),
      canLeave: isOpen && !isSpecialist && joinedByMe && row.status === 'confirmed' && new Date(row.starts_at) > now,
    };
  }) });
}

const STATUS_RULES = {
  confirmed: { allowed: 'canConfirm', refusal: 'Only the other person can accept this session, while it is still waiting.', message: 'Session accepted. It is booked.' },
  cancelled: { allowed: 'canCancel', refusal: 'This session can no longer be cancelled.', message: 'Session cancelled.' },
  completed: { allowed: 'canComplete', refusal: 'Only the specialist can mark a booked session as done, once it has started.', message: 'Session marked as done.' },
  no_show: { allowed: 'canComplete', refusal: 'Only the specialist can mark a booked session as missed, once it has started.', message: 'Session marked as missed.' },
};

async function updateModuleSessionStatus(req, res) {
  const { sessionId } = req.params;
  const { status } = req.body;
  const rule = STATUS_RULES[status];
  if (!rule) return res.status(400).json({ success: false, message: 'Invalid status' });
  const [rows] = await pool.query(
    'SELECT * FROM module_sessions WHERE id = ? AND (beneficiary_id = ? OR specialist_id = ?)',
    [sessionId, req.user.id, req.user.id]
  );
  const session = rows[0];
  if (!session) return res.status(403).json({ success: false, message: 'You are not part of this session' });
  if (!sessionActions(session, req.user.id)[rule.allowed]) return res.status(409).json({ success: false, message: rule.refusal });
  await pool.query('UPDATE module_sessions SET status = ? WHERE id = ?', [status, session.id]);

  if (!Number(session.is_open)) {
    await announceSessionChange(req.app, session, req.user.id, status);
    await logActivity({
      userId: req.user.id, action: `session_${status}`, moduleId: session.module_id,
      targetUserId: Number(req.user.id) === Number(session.beneficiary_id) ? session.specialist_id : session.beneficiary_id,
    });
    return res.json({ success: true, message: rule.message });
  }

  // Open session: who came (everyone who joined unless the specialist unticks
  // them), or tell those who joined that it was cancelled.
  let message = rule.message;
  if (status === 'completed') {
    const attended = Array.isArray(req.body.attended) ? req.body.attended.map(Number).filter(Number.isInteger) : null;
    if (attended) {
      await pool.query('UPDATE module_session_attendees SET attended = 0 WHERE session_id = ?', [session.id]);
      if (attended.length) await pool.query('UPDATE module_session_attendees SET attended = 1 WHERE session_id = ? AND beneficiary_id IN (?)', [session.id, attended]);
    } else {
      await pool.query('UPDATE module_session_attendees SET attended = 1 WHERE session_id = ?', [session.id]);
    }
    const [[came]] = await pool.query('SELECT COUNT(*) AS n FROM module_session_attendees WHERE session_id = ? AND attended = 1', [session.id]);
    message = `Session marked as done: ${plural(Number(came.n), 'beneficiary', 'beneficiaries')} came.`;
  } else if (status === 'no_show') {
    await pool.query('UPDATE module_session_attendees SET attended = 0 WHERE session_id = ?', [session.id]);
  } else if (status === 'cancelled') {
    const [joined] = await pool.query('SELECT beneficiary_id FROM module_session_attendees WHERE session_id = ?', [session.id]);
    await announceToUsers(req.app, joined.map((row) => row.beneficiary_id), {
      moduleId: session.module_id, actorId: req.user.id, kind: 'cancelled', text: 'cancelled the face-to-face session you joined', startsAt: session.starts_at,
    });
  }
  await logActivity({ userId: req.user.id, action: `session_${status}`, moduleId: session.module_id });
  res.json({ success: true, message });
}

// The online sessions (each test taken or activity answered) this person was part of.
async function listMyLearningSessions(req, res) {
  const [rows] = await pool.query(
    `SELECT ls.id, ls.module_id, ls.kind, ls.held_at, ls.specialist_id,
            lm.title AS module_title, b.full_name AS beneficiary_name, s.full_name AS specialist_name
     FROM learning_sessions ls
     JOIN learning_modules lm ON lm.id = ls.module_id
     JOIN users b ON b.id = ls.beneficiary_id
     JOIN users s ON s.id = ls.specialist_id
     WHERE ls.beneficiary_id = ? OR ls.specialist_id = ?
     ORDER BY ls.held_at DESC, ls.id DESC
     LIMIT 500`,
    [req.user.id, req.user.id]
  );
  res.json({ success: true, data: rows.map((row) => {
    const isSpecialist = Number(row.specialist_id) === Number(req.user.id);
    return {
      id: row.id, moduleId: row.module_id, moduleTitle: row.module_title, kind: row.kind, heldAt: row.held_at, isSpecialist,
      otherUserName: isSpecialist ? row.beneficiary_name : row.specialist_name,
    };
  }) });
}

module.exports = {
  getBookingFreeTimes,
  listMyLearningSessions,
  createModuleSession,
  createOpenSession,
  listOpenSessions,
  joinOpenSession,
  leaveOpenSession,
  listMyModuleSessions,
  updateModuleSessionStatus,
};
