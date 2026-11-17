const { pool } = require('../config/db');
const { loadInbox } = require('../lib/conversationInbox');

// The beneficiary's dashboard: their numbers, their topics with progress,
// upcoming sessions and the latest replies from specialists.

async function learnerDashboard(req, res) {
  const me = req.user.id;
  const [[user]] = await pool.query('SELECT user_type, role FROM users WHERE id = ?', [me]);
  if (!user || ['admin', 'moderator'].includes(user.role)) {
    return res.status(403).json({ success: false, message: 'Admins use the admin overview.' });
  }
  if (user.user_type === 'specialist') return specialistDashboard(req, res);
  if (user.user_type !== 'beneficiary') return res.status(403).json({ success: false, message: 'No dashboard for this account.' });

  const q = async (sql, params) => (await pool.query(sql, params))[0];
  const [assignments, activityCounts, questionCounts, attempts, feedback, sessions] = await Promise.all([
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
    q(`SELECT a.module_id, COUNT(act.id) AS total,
              SUM(CASE WHEN (act.activity_type = 'multiple_choice' AND ans.is_correct = 1)
                         OR (act.activity_type <> 'multiple_choice' AND ans.id IS NOT NULL) THEN 1 ELSE 0 END) AS done
       FROM elevate_module_assignments a
       JOIN module_activities act ON act.module_id = a.module_id AND act.specialist_id = a.specialist_id
       LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = a.beneficiary_id
       WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'
       GROUP BY a.module_id`, [me]),
    q(`SELECT a.module_id, COUNT(tq.id) AS n
       FROM elevate_module_assignments a
       JOIN module_test_questions tq ON tq.module_id = a.module_id AND tq.specialist_id = a.specialist_id
       WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'
       GROUP BY a.module_id`, [me]),
    q(`SELECT t.module_id, t.test_kind, t.score, t.total
       FROM module_test_attempts t
       JOIN elevate_module_assignments a ON a.beneficiary_id = t.beneficiary_id AND a.module_id = t.module_id
        AND a.specialist_id = t.specialist_id AND a.assignment_status = 'assigned'
       WHERE t.beneficiary_id = ?`, [me]),
    // The latest replies from specialists on their written and file answers.
    q(`SELECT ans.id, ans.feedback, ans.reviewed_at, ans.rubric_content, ans.rubric_completeness, ans.rubric_effort,
              act.module_id, act.prompt, lm.title AS topic, s.full_name AS specialist
       FROM module_activity_answers ans
       JOIN module_activities act ON act.id = ans.activity_id AND act.activity_type <> 'multiple_choice'
       JOIN learning_modules lm ON lm.id = act.module_id
       JOIN users s ON s.id = act.specialist_id
       WHERE ans.beneficiary_id = ? AND ans.reviewed_at IS NOT NULL
         AND (ans.feedback IS NOT NULL OR ans.rubric_content IS NOT NULL)
       ORDER BY ans.reviewed_at DESC
       LIMIT 3`, [me]),
    q(`SELECT ms.id, ms.module_id, ms.starts_at, ms.ends_at, ms.status, ms.scheduled_by, ms.meeting_link,
              lm.title AS topic, s.full_name AS specialist
       FROM module_sessions ms
       JOIN learning_modules lm ON lm.id = ms.module_id
       JOIN users s ON s.id = ms.specialist_id
       WHERE ms.beneficiary_id = ? AND ms.status IN ('pending', 'confirmed') AND ms.ends_at > NOW()
       ORDER BY ms.starts_at
       LIMIT 3`, [me]),
  ]);

  const activityBy = new Map(activityCounts.map((row) => [Number(row.module_id), { done: Number(row.done) || 0, total: Number(row.total) || 0 }]));
  const questionsBy = new Map(questionCounts.map((row) => [Number(row.module_id), Number(row.n)]));
  const attemptOf = (moduleId, kind) => {
    const row = attempts.find((item) => Number(item.module_id) === moduleId && item.test_kind === kind);
    return row ? { score: Number(row.score), total: Number(row.total) } : null;
  };

  const topics = assignments
    .filter((row) => ['pending', 'assigned'].includes(row.assignment_status))
    .map((row) => {
      const moduleId = Number(row.module_id);
      const completed = Boolean(row.certificate_id);
      const activities = activityBy.get(moduleId) || { done: 0, total: 0 };
      const questionCount = questionsBy.get(moduleId) || 0;
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
        activities,
        test: questionCount || pre || post ? {
          pre,
          post,
          preOpen: accepted && !completed && questionCount > 0 && !pre,
          postOpen: accepted && !completed && questionCount > 0 && Boolean(pre) && !post && activities.done >= activities.total,
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
      },
      topics,
      sessions: upcoming,
      feedback: feedback.map((row) => ({
        answerId: row.id,
        moduleId: Number(row.module_id),
        topic: row.topic,
        prompt: row.prompt,
        specialist: row.specialist,
        feedback: row.feedback || '',
        reviewedAt: row.reviewed_at,
        rubricTotal: row.rubric_content === null ? null : Number(row.rubric_content) + Number(row.rubric_completeness) + Number(row.rubric_effort),
      })),
    },
  });
}

// The specialist's dashboard: their numbers, their learners' progress,
// upcoming sessions, and the topics they teach.
async function specialistDashboard(req, res) {
  const me = req.user.id;
  const q = async (sql, params) => (await pool.query(sql, params))[0];
  const [inbox, applications, activityCounts, answersToRead, questionCounts, attempts, sessions, heldRows, certificateRows, topicRows] = await Promise.all([
    loadInbox(me),
    // Applications waiting for them to accept.
    q("SELECT module_id FROM elevate_module_assignments WHERE specialist_id = ? AND assignment_status = 'pending'", [me]),
    q(`SELECT a.module_id, a.beneficiary_id, COUNT(act.id) AS total,
              SUM(CASE WHEN (act.activity_type = 'multiple_choice' AND ans.is_correct = 1)
                         OR (act.activity_type <> 'multiple_choice' AND ans.id IS NOT NULL) THEN 1 ELSE 0 END) AS done
       FROM elevate_module_assignments a
       JOIN module_activities act ON act.module_id = a.module_id AND act.specialist_id = a.specialist_id
       LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = a.beneficiary_id
       WHERE a.specialist_id = ? AND a.assignment_status = 'assigned'
       GROUP BY a.module_id, a.beneficiary_id`, [me]),
    // Written and file answers they haven't read yet (current learners only).
    q(`SELECT act.module_id, ans.beneficiary_id, COUNT(*) AS n
       FROM module_activity_answers ans
       JOIN module_activities act ON act.id = ans.activity_id AND act.activity_type <> 'multiple_choice' AND act.specialist_id = ?
       JOIN elevate_module_assignments a ON a.module_id = act.module_id AND a.beneficiary_id = ans.beneficiary_id
        AND a.specialist_id = act.specialist_id AND a.assignment_status = 'assigned'
       WHERE ans.reviewed_at IS NULL
       GROUP BY act.module_id, ans.beneficiary_id`, [me]),
    q('SELECT module_id, COUNT(*) AS n FROM module_test_questions WHERE specialist_id = ? GROUP BY module_id', [me]),
    q('SELECT module_id, beneficiary_id, test_kind, score, total FROM module_test_attempts WHERE specialist_id = ?', [me]),
    q(`SELECT ms.id, ms.module_id, ms.starts_at, ms.ends_at, ms.status, ms.scheduled_by, lm.title AS topic, b.full_name AS learner
       FROM module_sessions ms
       JOIN learning_modules lm ON lm.id = ms.module_id
       JOIN users b ON b.id = ms.beneficiary_id
       WHERE ms.specialist_id = ? AND ms.status IN ('pending', 'confirmed') AND ms.ends_at > NOW()
       ORDER BY ms.starts_at
       LIMIT 3`, [me]),
    q("SELECT COUNT(*) AS n FROM module_sessions WHERE specialist_id = ? AND status = 'completed'", [me]),
    q('SELECT COUNT(*) AS n FROM module_certificates WHERE issued_by = ?', [me]),
    // The topics they teach (and any topic where they still have learners).
    q(`SELECT DISTINCT lm.id, lm.slug, lm.title, lm.phase, lm.sort_order,
              (SELECT COUNT(*) FROM module_activities act WHERE act.module_id = lm.id AND act.specialist_id = ?) AS activities,
              (SELECT sm.status FROM specialist_modules sm WHERE sm.topic_id = lm.id AND sm.specialist_id = ?) AS module_status,
              (SELECT sm.title FROM specialist_modules sm WHERE sm.topic_id = lm.id AND sm.specialist_id = ?) AS module_title
       FROM learning_modules lm
       WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND (
         EXISTS (SELECT 1 FROM module_skills ms JOIN user_skills us ON us.skill_id = ms.skill_id AND us.relation_type = 'teaches' AND us.user_id = ?
                 WHERE ms.module_id = lm.id AND ms.is_primary = 1)
         OR EXISTS (SELECT 1 FROM elevate_module_assignments a WHERE a.module_id = lm.id AND a.specialist_id = ? AND a.assignment_status = 'assigned'))
       ORDER BY lm.sort_order, lm.id`, [me, me, me, me, me]),
  ]);

  const key = (moduleId, beneficiaryId) => `${Number(moduleId)}:${Number(beneficiaryId)}`;
  const activityBy = new Map(activityCounts.map((row) => [key(row.module_id, row.beneficiary_id), { done: Number(row.done) || 0, total: Number(row.total) || 0 }]));
  const toReadBy = new Map(answersToRead.map((row) => [key(row.module_id, row.beneficiary_id), Number(row.n)]));
  const questionsBy = new Map(questionCounts.map((row) => [Number(row.module_id), Number(row.n)]));
  const attemptOf = (moduleId, beneficiaryId, kind) => {
    const row = attempts.find((item) => key(item.module_id, item.beneficiary_id) === key(moduleId, beneficiaryId) && item.test_kind === kind);
    return row ? { score: Number(row.score), total: Number(row.total) } : null;
  };

  const learners = inbox.filter((conversation) => Number(conversation.specialistId) === Number(me)).map((conversation) => {
    const k = key(conversation.moduleId, conversation.beneficiaryId);
    const activities = activityBy.get(k) || { done: 0, total: 0 };
    const hasTest = (questionsBy.get(Number(conversation.moduleId)) || 0) > 0;
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
      activities,
      test: hasTest || pre || post ? { pre, post } : null,
      toRead: toReadBy.get(k) || 0,
      awaitingReply: !completed && Boolean(conversation.awaitingSpecialist),
      unread: conversation.unreadCount,
      lastMessageAt: conversation.lastMessageAt,
      // Did everything: all activities, and the post-test if there is one.
      readyToComplete: !completed && activities.total > 0 && activities.done >= activities.total && (!hasTest || Boolean(post)),
    };
  });
  const current = learners.filter((learner) => !learner.completed);
  const urgency = (learner) => (learner.awaitingReply ? 4 : 0) + (learner.toRead ? 2 : 0) + (learner.readyToComplete ? 1 : 0);

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
    activities: Number(row.activities) || 0,
    testQuestions: questionsBy.get(Number(row.id)) || 0,
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
        answersToRead: current.reduce((sum, learner) => sum + learner.toRead, 0),
        certificates: Number(certificateRows[0].n) || 0,
        sessionsHeld: Number(heldRows[0].n) || 0,
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
