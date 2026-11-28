const { pool } = require('../config/db');
const { loadInbox } = require('../lib/conversationInbox');
const { offeredSql } = require('../lib/programPhases');
const { livesAbroad } = require('../lib/places');
const { loadFaceToFace, KIND_COUNTS_SQL, kindCounts } = require('../lib/moduleTests');

// The beneficiary's dashboard: their numbers, their topics with progress,
// and upcoming sessions.

async function learnerDashboard(req, res) {
  const me = req.user.id;
  const [[user]] = await pool.query('SELECT user_type, role, country FROM users WHERE id = ?', [me]);
  if (!user || ['admin', 'moderator'].includes(user.role)) {
    return res.status(403).json({ success: false, message: 'Admins use the admin overview.' });
  }
  if (user.user_type === 'specialist') return specialistDashboard(req, res);
  if (user.user_type !== 'beneficiary') return res.status(403).json({ success: false, message: 'No dashboard for this account.' });

  const q = async (sql, params) => (await pool.query(sql, params))[0];
  const [assignments, faceToFace, questionCounts, attempts, sessions] = await Promise.all([
    // Topics they applied to (pending) or were accepted for (assigned), and topics they can apply to.
    q(`SELECT a.module_id, a.assignment_status, a.applied_at, a.assigned_at, a.specialist_id,
              lm.slug, lm.title, lm.phase, lm.hours, lm.sort_order, s.full_name AS specialist_name,
              cert.id AS certificate_id, cert.issued_at
       FROM elevate_module_assignments a
       JOIN learning_modules lm ON lm.id = a.module_id
       LEFT JOIN users s ON s.id = a.specialist_id
       LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
       WHERE a.beneficiary_id = ?
       ORDER BY lm.sort_order, lm.id`, [me]),
    loadFaceToFace({ beneficiaryId: me }),
    q(`SELECT a.module_id, ${KIND_COUNTS_SQL('tq')}
       FROM elevate_module_assignments a
       JOIN module_test_questions tq ON tq.module_id = a.module_id AND tq.specialist_id = a.specialist_id
       WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'
       GROUP BY a.module_id`, [me]),
    q(`SELECT t.module_id, t.test_kind, t.score, t.total
       FROM module_test_attempts t
       JOIN elevate_module_assignments a ON a.beneficiary_id = t.beneficiary_id AND a.module_id = t.module_id
        AND a.specialist_id = t.specialist_id AND a.assignment_status = 'assigned'
       WHERE t.beneficiary_id = ?`, [me]),
    q(`SELECT ms.id, ms.module_id, ms.starts_at, ms.ends_at, ms.status, ms.scheduled_by, ms.meeting_link,
              lm.title AS topic, s.full_name AS specialist
       FROM module_sessions ms
       JOIN learning_modules lm ON lm.id = ms.module_id
       JOIN users s ON s.id = ms.specialist_id
       WHERE (ms.beneficiary_id = ? OR EXISTS (SELECT 1 FROM module_session_attendees sa WHERE sa.session_id = ms.id AND sa.beneficiary_id = ?))
         AND ms.status IN ('pending', 'confirmed') AND ms.ends_at > NOW()
       ORDER BY ms.starts_at
       LIMIT 3`, [me, me]),
  ]);

  const faceToFaceBy = new Map(faceToFace.map((item) => [item.moduleId, item]));
  const questionsBy = kindCounts(questionCounts);
  const attemptOf = (moduleId, kind) => {
    const row = attempts.find((item) => Number(item.module_id) === moduleId && item.test_kind === kind);
    return row ? { score: Number(row.score), total: Number(row.total) } : null;
  };

  const topics = assignments
    .filter((row) => ['pending', 'assigned'].includes(row.assignment_status))
    .map((row) => {
      const moduleId = Number(row.module_id);
      const completed = Boolean(row.certificate_id);
      const hours = faceToFaceBy.get(moduleId) || null;
      const counts = questionsBy.get(moduleId) || { pre: 0, post: 0 };
      const pre = attemptOf(moduleId, 'pre');
      const post = attemptOf(moduleId, 'post');
      const accepted = row.assignment_status === 'assigned';
      return {
        moduleId,
        slug: row.slug,
        title: row.title,
        phase: row.phase,
        hours: row.hours === null ? null : Number(row.hours),
        specialist: row.specialist_name || null,
        stage: !accepted ? 'applied' : completed ? 'completed' : 'learning',
        appliedAt: row.applied_at,
        acceptedAt: accepted ? row.assigned_at : null,
        completedAt: row.issued_at || null,
        faceToFace: hours,
        test: counts.pre || counts.post || pre || post ? {
          pre,
          post,
          preOpen: accepted && !completed && counts.pre > 0 && !pre,
          postOpen: accepted && !completed && counts.post > 0 && Boolean(pre) && !post && Boolean(hours?.postTestOpened),
        } : null,
      };
    });
  const canApply = assignments.filter((row) => row.assignment_status === 'suggested').length;

  const upcoming = sessions.map((row) => ({
    id: row.id,
    moduleId: Number(row.module_id),
    topic: row.topic,
    specialist: row.specialist,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    meetingLink: row.meeting_link || null,
    needsMyAnswer: row.status === 'pending' && Number(row.scheduled_by) !== Number(me),
  }));

  const learning = topics.filter((topic) => topic.stage === 'learning');
  const completed = topics.filter((topic) => topic.stage === 'completed');
  res.json({
    success: true,
    data: {
      summary: {
        learning: learning.length,
        completed: completed.length,
        certificates: completed.length,
        hoursCompleted: completed.reduce((sum, topic) => sum + (topic.hours || 0), 0),
        applied: topics.filter((topic) => topic.stage === 'applied').length,
        canApply,
        // Outside the Philippines: online only, so no face-to-face booking.
        onlineOnly: livesAbroad(user.country),
      },
      topics,
      sessions: upcoming,
    },
  });
}

// The specialist's dashboard: their numbers, their learners' progress,
// upcoming sessions, and the topics they teach.
async function specialistDashboard(req, res) {
  const me = req.user.id;
  const q = async (sql, params) => (await pool.query(sql, params))[0];
  const [inbox, applications, faceToFace, questionCounts, attempts, sessions, heldRows, certificateRows, topicRows] = await Promise.all([
    loadInbox(me),
    // Applications waiting for them to accept.
    q("SELECT module_id FROM elevate_module_assignments WHERE specialist_id = ? AND assignment_status = 'pending'", [me]),
    loadFaceToFace({ specialistId: me }),
    q(`SELECT module_id, ${KIND_COUNTS_SQL('q')} FROM module_test_questions q WHERE specialist_id = ? GROUP BY module_id`, [me]),
    q('SELECT module_id, beneficiary_id, test_kind, score, total FROM module_test_attempts WHERE specialist_id = ?', [me]),
    q(`SELECT ms.id, ms.module_id, ms.starts_at, ms.ends_at, ms.status, ms.scheduled_by, lm.title AS topic,
              COALESCE(b.full_name, CONCAT('Open session · ', (SELECT COUNT(*) FROM module_session_attendees sa WHERE sa.session_id = ms.id), ' joined')) AS learner
       FROM module_sessions ms
       JOIN learning_modules lm ON lm.id = ms.module_id
       LEFT JOIN users b ON b.id = ms.beneficiary_id
       WHERE ms.specialist_id = ? AND ms.status IN ('pending', 'confirmed') AND ms.ends_at > NOW()
       ORDER BY ms.starts_at
       LIMIT 3`, [me]),
    q(`SELECT (SELECT COUNT(*) FROM learning_sessions WHERE specialist_id = ?) AS online,
              (SELECT COUNT(*) FROM module_sessions WHERE specialist_id = ? AND status = 'completed') AS face_to_face`, [me, me]),
    q('SELECT COUNT(*) AS n FROM module_certificates WHERE issued_by = ?', [me]),
    // The topics they teach (and any topic where they still have learners).
    q(`SELECT DISTINCT lm.id, lm.slug, lm.title, lm.phase, lm.sort_order,
              (SELECT sm.status FROM specialist_modules sm WHERE sm.topic_id = lm.id AND sm.specialist_id = ?) AS module_status,
              (SELECT sm.title FROM specialist_modules sm WHERE sm.topic_id = lm.id AND sm.specialist_id = ?) AS module_title
       FROM learning_modules lm
       WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND (
         EXISTS (SELECT 1 FROM module_skills ms JOIN user_skills us ON us.skill_id = ms.skill_id AND us.relation_type = 'teaches' AND us.user_id = ?
                 WHERE ms.module_id = lm.id AND ms.is_primary = 1 AND ${offeredSql('lm')})
         OR EXISTS (SELECT 1 FROM elevate_module_assignments a WHERE a.module_id = lm.id AND a.specialist_id = ? AND a.assignment_status = 'assigned'))
       ORDER BY lm.sort_order, lm.id`, [me, me, me, me]),
  ]);

  const key = (moduleId, beneficiaryId) => `${Number(moduleId)}:${Number(beneficiaryId)}`;
  const faceToFaceBy = new Map(faceToFace.map((item) => [key(item.moduleId, item.beneficiaryId), item]));
  const questionsBy = kindCounts(questionCounts);
  const attemptOf = (moduleId, beneficiaryId, kind) => {
    const row = attempts.find((item) => key(item.module_id, item.beneficiary_id) === key(moduleId, beneficiaryId) && item.test_kind === kind);
    return row ? { score: Number(row.score), total: Number(row.total) } : null;
  };

  const learners = inbox.filter((conversation) => Number(conversation.specialistId) === Number(me)).map((conversation) => {
    const k = key(conversation.moduleId, conversation.beneficiaryId);
    const hours = faceToFaceBy.get(k) || null;
    const counts = questionsBy.get(Number(conversation.moduleId)) || { pre: 0, post: 0 };
    const hasTest = counts.pre + counts.post > 0;
    const pre = attemptOf(conversation.moduleId, conversation.beneficiaryId, 'pre');
    const post = attemptOf(conversation.moduleId, conversation.beneficiaryId, 'post');
    const completed = conversation.status === 'completed';
    return {
      beneficiaryId: Number(conversation.beneficiaryId),
      name: conversation.otherUserName,
      avatar: conversation.otherUserAvatar || null,
      moduleId: Number(conversation.moduleId),
      topic: conversation.moduleTitle,
      conversationId: conversation.id,
      completed,
      faceToFace: hours,
      test: hasTest || pre || post ? { pre, post } : null,
      awaitingReply: !completed && Boolean(conversation.awaitingSpecialist),
      unread: conversation.unreadCount,
      lastMessageAt: conversation.lastMessageAt,
      // Took the pre-test: the specialist opens the post-test when they're ready.
      canOpenPostTest: !completed && counts.post > 0 && Boolean(pre) && !post && !hours?.postTestOpened,
      // Took the post-test: the specialist can mark them completed.
      readyToComplete: !completed && Boolean(post),
    };
  });
  const current = learners.filter((learner) => !learner.completed);
  const urgency = (learner) => (learner.awaitingReply ? 4 : 0) + (learner.canOpenPostTest ? 2 : 0) + (learner.readyToComplete ? 1 : 0);

  const upcoming = sessions.map((row) => ({
    id: row.id,
    moduleId: Number(row.module_id),
    topic: row.topic,
    person: row.learner,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    needsMyAnswer: row.status === 'pending' && Number(row.scheduled_by) !== Number(me),
  }));
  const topics = topicRows.map((row) => ({
    moduleId: Number(row.id),
    slug: row.slug,
    title: row.title,
    phase: row.phase,
    testQuestions: questionsBy.get(Number(row.id)) || { pre: 0, post: 0 },
    // Their own module for the topic: null (not created), draft, pending, approved, changes_requested.
    moduleStatus: row.module_status || null,
    moduleTitle: row.module_title || null,
    learners: current.filter((learner) => learner.moduleId === Number(row.id)).length,
    applications: applications.filter((item) => Number(item.module_id) === Number(row.id)).length,
  }));

  res.json({
    success: true,
    data: {
      role: 'specialist',
      summary: {
        learners: current.length,
        applications: applications.length,
        postTestsToOpen: current.filter((learner) => learner.canOpenPostTest).length,
        certificates: Number(certificateRows[0].n) || 0,
        onlineSessions: Number(heldRows[0].online) || 0,
        faceToFaceHeld: Number(heldRows[0].face_to_face) || 0,
      },
      // Most urgent first: waiting for a reply, answers to read, ready to complete.
      learners: current
        .sort((a, b) => urgency(b) - urgency(a) || a.name.localeCompare(b.name))
        .slice(0, 8),
      sessions: upcoming,
      topics,
    },
  });
}

module.exports = { learnerDashboard };
