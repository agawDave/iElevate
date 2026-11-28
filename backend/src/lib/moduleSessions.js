const { pool } = require('../config/db');

// Face-to-face sessions for a topic, booked on the Sessions page: one-on-one
// (a learner and their specialist), or open (is_open = 1: posted by a specialist,
// any beneficiary who needs the topic can join; module_session_attendees).
//   pending   - requested, waiting for the other person to accept
//   confirmed - accepted
//   completed / no_show - the specialist marked it after it started
//   cancelled - declined or cancelled before it ended
const MIN_MINUTES = 15;
const MAX_MINUTES = 240;
const MAX_PLACE_LENGTH = 255;
const MAX_SEATS = 500;

// What this viewer may do with the session right now.
function sessionActions(row, userId, now = Date.now()) {
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();
  const requestedByViewer = Number(row.scheduled_by) === Number(userId);
  const viewerIsSpecialist = Number(row.specialist_id) === Number(userId);
  if (Number(row.is_open)) {
    // Open sessions are posted already booked; only the specialist changes them.
    return {
      canConfirm: false,
      canCancel: row.status === 'confirmed' && viewerIsSpecialist && ends > now,
      canComplete: row.status === 'confirmed' && viewerIsSpecialist && starts <= now,
    };
  }
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
  // Booked sessions are face to face (online learning happens in the module itself).
  const place = typeof body.meetingLink === 'string' ? body.meetingLink.trim() : '';
  if (!place) return { error: 'Add the place where you will meet, like the barangay hall.' };
  if (/^https?:\/\//i.test(place) || /^(www\.|meet\.google|zoom\.us)/i.test(place)) {
    return { error: 'Booked sessions are face to face, so add a place instead of a link.' };
  }
  if (place.length > MAX_PLACE_LENGTH) return { error: `Keep the place under ${MAX_PLACE_LENGTH} characters.` };
  let seats = null;
  if (body.seats !== undefined && body.seats !== null && body.seats !== '') {
    seats = Number(body.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) return { error: `Seats must be a whole number from 1 to ${MAX_SEATS}, or left empty.` };
  }
  return { value: { startsAt, endsAt, meetingLink: place, seats } };
}

const NOTICE = {
  proposed: 'requested a face-to-face session',
  confirmed: 'accepted your face-to-face session',
  cancelled: 'cancelled a face-to-face session',
  completed: 'marked your face-to-face session as done',
  no_show: 'marked a face-to-face session as missed',
};

// "Wed, Nov 25, 9:00 AM" in Philippine time.
function whenText(startsAt) {
  return new Date(startsAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// A pop-up for whoever is online now (open sessions: posted, joined, cancelled).
async function announceToUsers(app, userIds, { moduleId, actorId, kind, text, startsAt }) {
  const ids = [...new Set(userIds.map(Number))];
  if (!ids.length) return;
  const [[details]] = await pool.query(
    'SELECT actor.full_name AS actor_name, lm.title AS module_title FROM users actor JOIN learning_modules lm ON lm.id = ? WHERE actor.id = ?',
    [moduleId, actorId]
  );
  const name = details?.actor_name || 'Someone';
  // "Naomi A. Bajao accepted your face-to-face session · Google Sheets · Wed, Nov 25, 9:00 AM"
  const body = [`${name} ${text}`, details?.module_title, startsAt && whenText(startsAt)].filter(Boolean).join(' · ').slice(0, 500);
  const link = kind === 'post_test_opened' ? `/modules/${moduleId}` : '/sessions';
  const io = app.get('io');
  if (!io) return;
  ids.forEach((userId) => io.to(`user:${userId}`).emit('notification:new', {
    type: 'module_session',
    kind,
    moduleId,
    moduleTitle: details?.module_title || '',
    senderName: name,
    body,
    link,
  }));
}

// One-on-one sessions: tell the other person.
async function announceSessionChange(app, session, actorId, kind) {
  if (!session.beneficiary_id) return;
  const recipientId = Number(actorId) === Number(session.beneficiary_id) ? session.specialist_id : session.beneficiary_id;
  await announceToUsers(app, [recipientId], {
    moduleId: session.module_id, actorId, kind, text: NOTICE[kind] || 'updated a session', startsAt: session.starts_at,
  });
}

module.exports = { sessionActions, readSessionInput, announceSessionChange, announceToUsers };
