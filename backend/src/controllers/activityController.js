const { pool } = require('../config/db');
const { removeActivityFile } = require('../middleware/activityFileUpload');
const { loadTestState, loadFaceToFace, attemptDto, attemptReview, KIND_COUNTS_SQL, kindCounts } = require('../lib/moduleTests');

// A learner's module page and progress on their topics, and the specialist's
// view of their learners: pre-test and post-test scores and face-to-face hours.
// A module is the materials, the pre-test, face-to-face sessions and the post-test.

async function notify(app, userId, payload) {
  const io = app.get('io');
  if (io && userId) io.to(`user:${userId}`).emit('notification:new', { type: 'module_activity', ...payload });
}

// Runs a handler that may receive an uploaded file. The file is deleted
// afterwards unless the handler saved it (req.keepUpload = true).
function withUpload(handler) {
  return async (req, res) => {
    req.keepUpload = false;
    try {
      await handler(req, res);
    } finally {
      if (req.file && !req.keepUpload) await removeActivityFile(req.file.filename);
    }
  };
}

// The specialist teaches the topic, or still has accepted learners in it.
async function canAuthor(specialistId, moduleId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM module_skills ms
     JOIN user_skills us ON us.skill_id = ms.skill_id AND us.relation_type = 'teaches' AND us.user_id = ?
     JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1
     WHERE ms.module_id = ? AND ms.is_primary = 1
     UNION
     SELECT 1 FROM elevate_module_assignments
     WHERE specialist_id = ? AND module_id = ? AND assignment_status = 'assigned'
     LIMIT 1`,
    [specialistId, moduleId, specialistId, moduleId]
  );
  return rows.length > 0;
}

// The specialist's learners on each topic (test scores, face-to-face hours, a
// recommendation they asked for), and how many test questions each topic has.
async function specialistSummary(req, res) {
  const [questionCounts] = await pool.query(
    `SELECT module_id, ${KIND_COUNTS_SQL('q')} FROM module_test_questions q WHERE specialist_id = ? GROUP BY module_id`,
    [req.user.id]
  );
  const [attempts] = await pool.query(
    'SELECT module_id, beneficiary_id, test_kind, score, total, taken_at FROM module_test_attempts WHERE specialist_id = ?',
    [req.user.id]
  );
  const attemptOf = (item, kind) => attemptDto(attempts.find((attempt) => Number(attempt.module_id) === item.moduleId
    && Number(attempt.beneficiary_id) === item.beneficiaryId && attempt.test_kind === kind));
  const [recommendations] = await pool.query(
    'SELECT id, module_id, beneficiary_id, status, note, body, requested_at, written_at FROM career_recommendations WHERE specialist_id = ?',
    [req.user.id]
  );
  const recommendationOf = (item) => {
    const found = recommendations.find((row) => Number(row.module_id) === item.moduleId && Number(row.beneficiary_id) === item.beneficiaryId);
    return found ? { id: found.id, status: found.status, note: found.note || '', body: found.body || '', requestedAt: found.requested_at, writtenAt: found.written_at } : null;
  };
  const learners = await loadFaceToFace({ specialistId: req.user.id });
  res.json({
    success: true,
    data: {
      learners: learners.map((item) => ({
        moduleId: item.moduleId,
        beneficiaryId: item.beneficiaryId,
        faceToFace: item,
        preTest: attemptOf(item, 'pre'),
        postTest: attemptOf(item, 'post'),
        recommendation: recommendationOf(item),
      })),
      // moduleId → { pre, post }: how many questions each test has.
      testQuestionCounts: Object.fromEntries(kindCounts(questionCounts)),
    },
  });
}

// ---------------------------------------------------------------- learners

async function learnerAssignment(beneficiaryId, moduleId) {
  const [rows] = await pool.query(
    `SELECT a.specialist_id, specialist.full_name AS specialist_name, specialist.avatar_url AS specialist_avatar,
            lm.id, lm.slug, lm.title, lm.phase, lm.description, lm.hours,
            sm.title AS module_title, sm.overview AS module_overview, sm.hours AS module_hours,
            cert.id AS certificate_id, cert.issued_at AS certificate_issued_at,
            cert.file_storage_name IS NOT NULL AS certificate_has_file, issuer.full_name AS certificate_issuer,
            (SELECT c.id FROM conversations c WHERE c.module_id = a.module_id
               AND c.user_a_id = LEAST(a.beneficiary_id, a.specialist_id)
               AND c.user_b_id = GREATEST(a.beneficiary_id, a.specialist_id)) AS conversation_id
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     JOIN users specialist ON specialist.id = a.specialist_id
     LEFT JOIN specialist_modules sm ON sm.topic_id = a.module_id AND sm.specialist_id = a.specialist_id
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
     LEFT JOIN users issuer ON issuer.id = cert.issued_by
     WHERE a.beneficiary_id = ? AND a.module_id = ? AND a.assignment_status = 'assigned'`,
    [beneficiaryId, moduleId]
  );
  return rows[0] || null;
}

// What the module page shows about the pre-test and post-test. The questions
// (without the correct choices) are sent only when a test can be taken now;
// the correct answers only after the post-test. null when there's no test.
async function learnerTestView(beneficiaryId, assignment, faceToFace, completed) {
  const state = await loadTestState(beneficiaryId, assignment.id, assignment.specialist_id);
  const counts = { pre: state.questions.pre.length, post: state.questions.post.length };
  if (!counts.pre && !counts.post && !state.pre && !state.post) return null;
  const preOpen = !completed && !state.pre && counts.pre > 0;
  const postOpen = !completed && Boolean(state.pre) && !state.post && counts.post > 0 && Boolean(faceToFace?.postTestOpened);
  const open = preOpen ? 'pre' : postOpen ? 'post' : null;
  return {
    counts,
    pre: attemptDto(state.pre),
    post: attemptDto(state.post),
    preOpen,
    postOpen,
    // The questions of the test that can be taken now.
    questions: open ? state.questions[open].map(({ id, prompt, options }) => ({ id, prompt, options })) : [],
    review: state.post ? attemptReview(state.post) : null,
  };
}

// After a topic is completed: the one topic to go to next. A topic in progress
// comes first, then one they can apply to, one waiting to be accepted, then
// the rest of their plan, each in curriculum order. null when nothing is left.
const NEXT_ORDER = ['assigned', 'suggested', 'pending', 'queued', 'waiting'];
async function nextTopicFor(beneficiaryId, finishedModuleId) {
  const [rows] = await pool.query(
    `SELECT a.module_id, a.assignment_status, lm.title, s.full_name AS specialist_name
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     LEFT JOIN users s ON s.id = a.specialist_id
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
     WHERE a.beneficiary_id = ? AND a.module_id <> ? AND cert.id IS NULL
       AND a.assignment_status IN (?)
     ORDER BY FIELD(a.assignment_status, ?), lm.sort_order, lm.id
     LIMIT 1`,
    [beneficiaryId, finishedModuleId, NEXT_ORDER, NEXT_ORDER]
  );
  const row = rows[0];
  return row ? { id: row.module_id, title: row.title, status: row.assignment_status, specialist: row.specialist_name || null } : null;
}

// The specialist's upcoming face-to-face sessions on the topic, and whether
// this learner said they'll attend (joined).
async function upcomingTopicSessions(beneficiaryId, moduleId, specialistId) {
  const [rows] = await pool.query(
    `SELECT ms.id, ms.starts_at, ms.ends_at, ms.meeting_link, ms.seats,
            (SELECT COUNT(*) FROM module_session_attendees sa WHERE sa.session_id = ms.id) AS joined_count,
            EXISTS (SELECT 1 FROM module_session_attendees mine WHERE mine.session_id = ms.id AND mine.beneficiary_id = ?) AS joined
     FROM module_sessions ms
     WHERE ms.module_id = ? AND ms.specialist_id = ? AND ms.is_open = 1 AND ms.status = 'confirmed' AND ms.starts_at > NOW()
     ORDER BY ms.starts_at`,
    [beneficiaryId, moduleId, specialistId]
  );
  return rows.map((row) => {
    const seats = row.seats === null ? null : Number(row.seats);
    const joinedCount = Number(row.joined_count);
    return {
      moduleSessionId: row.id, startsAt: row.starts_at, endsAt: row.ends_at, place: row.meeting_link,
      seats, joinedCount, joined: Boolean(Number(row.joined)), full: seats !== null && joinedCount >= seats,
    };
  });
}

// The module page: the topic, the learner's tests, and the specialist's
// upcoming face-to-face sessions (none once completed, or for online-only learners).
async function learnerModule(req, res) {
  const assignment = await learnerAssignment(req.user.id, Number(req.params.moduleId));
  if (!assignment) return res.status(403).json({ success: false, message: 'This module opens once a specialist accepts your application.' });
  const completed = Boolean(assignment.certificate_id);
  const [faceToFace = null] = await loadFaceToFace({ beneficiaryId: req.user.id, moduleId: assignment.id });
  const sessions = completed || faceToFace?.onlineOnly ? [] : await upcomingTopicSessions(req.user.id, assignment.id, assignment.specialist_id);
  res.json({
    success: true,
    data: {
      // The specialist's own module for the topic (title, overview, hours), with
      // the training-design topic as the fallback.
      module: {
        id: assignment.id,
        slug: assignment.slug,
        title: assignment.module_title || assignment.title,
        topic: assignment.title,
        phase: assignment.phase,
        description: assignment.module_overview || assignment.description,
        hours: assignment.module_hours || assignment.hours,
      },
      specialist: { id: assignment.specialist_id, name: assignment.specialist_name, avatar: assignment.specialist_avatar || null },
      conversationId: assignment.conversation_id,
      completed,
      certificate: completed ? {
        id: assignment.certificate_id,
        issuedAt: assignment.certificate_issued_at,
        issuedBy: assignment.certificate_issuer || assignment.specialist_name,
        hasFile: Boolean(Number(assignment.certificate_has_file)),
      } : null,
      nextTopic: completed ? await nextTopicFor(req.user.id, assignment.id) : null,
      test: await learnerTestView(req.user.id, assignment, faceToFace, completed),
      faceToFace,
      sessions,
    },
  });
}

// Each accepted topic, for the learner's module cards: face-to-face hours, and
// whether a test is waiting so the card's main button can say so.
async function learnerProgress(req, res) {
  const [questionRows] = await pool.query(
    `SELECT a.module_id, ${KIND_COUNTS_SQL('tq')} FROM elevate_module_assignments a
     JOIN module_test_questions tq ON tq.module_id = a.module_id AND tq.specialist_id = a.specialist_id
     WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'
     GROUP BY a.module_id`,
    [req.user.id]
  );
  const [attemptRows] = await pool.query(
    `SELECT t.module_id, t.test_kind FROM module_test_attempts t
     JOIN elevate_module_assignments a ON a.beneficiary_id = t.beneficiary_id AND a.module_id = t.module_id
      AND a.specialist_id = t.specialist_id AND a.assignment_status = 'assigned'
     WHERE t.beneficiary_id = ?`,
    [req.user.id]
  );
  const countsBy = kindCounts(questionRows);
  const took = (moduleId, kind) => attemptRows.some((row) => Number(row.module_id) === moduleId && row.test_kind === kind);
  const topics = await loadFaceToFace({ beneficiaryId: req.user.id });
  res.json({
    success: true,
    data: Object.fromEntries(topics.map((item) => {
      const counts = countsBy.get(item.moduleId) || { pre: 0, post: 0 };
      return [item.moduleId, {
        faceToFace: item,
        preTestOpen: counts.pre > 0 && !took(item.moduleId, 'pre'),
        postTestOpen: counts.post > 0 && took(item.moduleId, 'pre') && !took(item.moduleId, 'post') && item.postTestOpened,
      }];
    })),
  });
}

module.exports = {
  withUpload,
  canAuthor,
  learnerAssignment,
  notify,
  specialistSummary,
  learnerModule,
  learnerProgress,
};
