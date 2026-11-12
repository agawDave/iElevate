const { pool } = require('../config/db');

// Learning sessions for one topic between a learner and their specialist,
// booked on the Sessions page.
//   pending   - requested, waiting for the other person to accept
//   confirmed - accepted
//   completed / no_show - the specialist marked it after it started
//   cancelled - declined or cancelled before it ended
const MIN_MINUTES = 15;
const MAX_MINUTES = 240;
const MAX_PLACE_LENGTH = 255;

// What this viewer may do with the session right now.
function sessionActions(row, userId, now = Date.now()) {
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();
  const requestedByViewer = Number(row.scheduled_by) === Number(userId);
  const viewerIsSpecialist = Number(row.specialist_id) === Number(userId);
  return {
    canConfirm: row.status === 'pending' && !requestedByViewer && ends > now,
    canCancel: ['pending', 'confirmed'].includes(row.status) && ends > now,
    canComplete: row.status === 'confirmed' && viewerIsSpecialist && starts <= now,
  };
}

// Checks a requested time and place. Returns { value } or { error }.
function readSessionInput(body = {}) {
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { error: 'Choose a date and time for the session.' };
  const minutes = (endsAt - startsAt) / 60000;
  if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) return { error: 'A session can last from 15 minutes to 4 hours.' };
  if (startsAt.getTime() < Date.now() - 5 * 60000) return { error: 'Choose a time that has not passed yet.' };
  const place = typeof body.meetingLink === 'string' ? body.meetingLink.trim() : '';
  if (place.length > MAX_PLACE_LENGTH) return { error: `Keep the place or link under ${MAX_PLACE_LENGTH} characters.` };
  return { value: { startsAt, endsAt, meetingLink: place || null } };
}

const NOTICE = {
  proposed: 'requested a learning session',
  confirmed: 'accepted your learning session',
  cancelled: 'cancelled a learning session',
  completed: 'marked your learning session as done',
  no_show: 'marked a learning session as missed',
};

// A pop-up for the other person (the sidebar also refreshes its badges).
async function announceSessionChange(app, session, actorId, kind) {
  const io = app.get('io');
  if (!io) return;
  const recipientId = Number(actorId) === Number(session.beneficiary_id) ? session.specialist_id : session.beneficiary_id;
  const [[details]] = await pool.query(
    `SELECT actor.full_name AS actor_name, lm.title AS module_title
     FROM users actor JOIN learning_modules lm ON lm.id = ? WHERE actor.id = ?`,
    [session.module_id, actorId]
  );
  io.to(`user:${recipientId}`).emit('notification:new', {
    type: 'module_session',
    kind,
    moduleId: session.module_id,
    moduleTitle: details?.module_title || '',
    senderName: details?.actor_name || 'Your partner',
    body: `${details?.actor_name || 'Someone'} ${NOTICE[kind] || 'updated a session'}`,
  });
}

module.exports = { sessionActions, readSessionInput, announceSessionChange };
