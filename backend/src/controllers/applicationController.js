const { pool } = require('../config/db');
const { recomputeElevateAssignments, specialistOptions, lockLearner } = require('../services/elevateAssignmentService');
const { logActivity } = require('../lib/activityLog');

// Apply -> accept (project-advisor flow). A learner picks one of the
// specialists who teach a topic from their skill check and fit them, and
// applies; that specialist accepts or declines.
//   Incoming  = applied, waiting for the specialist (status 'pending')
//   Ongoing   = accepted, learning the topic        ('assigned', no certificate)
//   Completed = certificate issued                  ('assigned' + certificate)

// A pop-up if they're online; link: the page it opens.
async function notify(app, userId, payload) {
  const io = app.get('io');
  if (io && userId) io.to(`user:${userId}`).emit('notification:new', { type: 'module_application', ...payload });
}

async function names(moduleId, ...userIds) {
  const ids = userIds.filter(Boolean);
  const [[topic]] = await pool.query('SELECT title FROM learning_modules WHERE id = ?', [moduleId]);
  const [users] = ids.length ? await pool.query('SELECT id, full_name FROM users WHERE id IN (?)', [ids]) : [[]];
  const nameOf = (id) => users.find((user) => Number(user.id) === Number(id))?.full_name || '';
  return { title: topic?.title || 'this topic', nameOf };
}

async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    if (result?.refuse) {
      await connection.rollback();
      return result;
    }
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Brings the learner's matches up to date (e.g. a specialist's module was just
// approved). A lock conflict with a parallel update of the same learner is retried.
async function bringMatchesUpToDate(learnerId) {
  for (let attempt = 1; ; attempt += 1) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await recomputeElevateAssignments(learnerId, connection);
      await connection.commit();
      return;
    } catch (error) {
      await connection.rollback();
      const lockConflict = error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT';
      if (!lockConflict || attempt >= 3) throw error;
    } finally {
      connection.release();
    }
  }
}

// The specialists the learner can apply to, per topic, best fit first.
// The Modules page loads this at the same time as /modules, so it brings the
// matches up to date itself rather than relying on /modules finishing first
// (otherwise a just-approved module could be missing from the choices).
async function listOptions(req, res) {
  await bringMatchesUpToDate(req.user.id);
  const options = await specialistOptions(req.user.id);
  const ids = [...new Set([...options.values()].flat().map((option) => option.specialistId))];
  const [people] = ids.length
    ? await pool.query('SELECT id, full_name, avatar_url, city FROM users WHERE id IN (?)', [ids])
    : [[]];
  const personById = new Map(people.map((person) => [Number(person.id), person]));
  // Each specialist's own (approved) module for the topic, with what's in it.
  const topicIds = [...options.keys()];
  const [moduleRows] = topicIds.length && ids.length
    ? await pool.query(
      `SELECT sm.topic_id, sm.specialist_id, sm.title, sm.overview, sm.hours,
              (SELECT COUNT(*) FROM module_test_questions q WHERE q.module_id = sm.topic_id AND q.specialist_id = sm.specialist_id) AS test_questions
       FROM specialist_modules sm
       WHERE sm.status = 'approved' AND sm.topic_id IN (?) AND sm.specialist_id IN (?)`,
      [topicIds, ids]
    )
    : [[]];
  const moduleOf = new Map(moduleRows.map((row) => [`${row.topic_id}:${row.specialist_id}`, row]));
  const data = {};
  options.forEach((list, moduleId) => {
    data[moduleId] = list.map((option) => {
      const module = moduleOf.get(`${moduleId}:${option.specialistId}`);
      return {
        specialistId: option.specialistId,
        name: personById.get(option.specialistId)?.full_name || 'Specialist',
        avatar: personById.get(option.specialistId)?.avatar_url || null,
        city: personById.get(option.specialistId)?.city || null,
        best: option.best,
        reasons: option.reasons,
        module: module ? {
          title: module.title,
          overview: module.overview,
          hours: Number(module.hours) || 0,
          testQuestions: Number(module.test_questions),
        } : null,
      };
    });
  });
  res.json({ success: true, data });
}

// The learner applies to the specialist they chose.
async function applyToTopic(req, res) {
  const moduleId = Number(req.params.moduleId);
  const specialistId = Number(req.body?.specialistId);
  if (!specialistId) return res.status(400).json({ success: false, message: 'Choose the specialist you want to apply to.' });
  const result = await withTransaction(async (connection) => {
    await recomputeElevateAssignments(req.user.id, connection);
    const [rows] = await connection.query(
      'SELECT assignment_status FROM elevate_module_assignments WHERE beneficiary_id = ? AND module_id = ? FOR UPDATE',
      [req.user.id, moduleId]
    );
    const status = rows[0]?.assignment_status;
    if (!status) return { refuse: 404, message: 'This topic is not in your learning plan.' };
    if (status === 'queued') return { refuse: 409, message: 'This topic is next up. You can apply once you finish one of your current topics.' };
    if (status === 'pending' || status === 'assigned') return { refuse: 409, message: 'You already applied to this topic.' };
    const choice = (await specialistOptions(req.user.id, connection)).get(moduleId)?.find((option) => option.specialistId === specialistId);
    if (!choice) return { refuse: 400, message: "That specialist can't take you for this topic. Choose one from the list." };
    await connection.query(
      `UPDATE elevate_module_assignments
       SET specialist_id = ?, assignment_status = 'pending', applied_at = NOW(), assigned_at = NULL,
           match_score = ?, match_reasons = ?, waiting_reason = NULL
       WHERE beneficiary_id = ? AND module_id = ?`,
      [specialistId, choice.score, JSON.stringify([`Teaches ${choice.title}`, ...choice.reasons]), req.user.id, moduleId]
    );
    return { ok: true };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'applied', moduleId, targetUserId: specialistId });
  const { title, nameOf } = await names(moduleId, req.user.id, specialistId);
  await notify(req.app, specialistId, {
    kind: 'new', moduleId, moduleTitle: title, senderName: nameOf(req.user.id), link: '/modules?tab=incoming',
    body: `${nameOf(req.user.id)} applied to ${title}`,
  });
  res.json({ success: true, message: `Application sent to ${nameOf(specialistId)}. You'll be told when they accept.` });
}

// The learner takes back an application that hasn't been answered yet.
async function cancelApplication(req, res) {
  const moduleId = Number(req.params.moduleId);
  const result = await withTransaction(async (connection) => {
    await lockLearner(connection, req.user.id);
    const [rows] = await connection.query(
      `SELECT specialist_id FROM elevate_module_assignments
       WHERE beneficiary_id = ? AND module_id = ? AND assignment_status = 'pending' FOR UPDATE`,
      [req.user.id, moduleId]
    );
    if (!rows[0]) return { refuse: 404, message: 'There is no application waiting for this topic.' };
    await connection.query(
      'UPDATE elevate_module_assignments SET applied_at = NULL WHERE beneficiary_id = ? AND module_id = ?',
      [req.user.id, moduleId]
    );
    await recomputeElevateAssignments(req.user.id, connection);
    return { specialistId: rows[0].specialist_id };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'application_cancelled', moduleId, targetUserId: result.specialistId });
  const { title, nameOf } = await names(moduleId, req.user.id);
  await notify(req.app, result.specialistId, {
    kind: 'withdrawn', moduleId, moduleTitle: title, senderName: nameOf(req.user.id), link: '/modules',
    body: `${nameOf(req.user.id)} withdrew their application to ${title}`,
  });
  res.json({ success: true, message: 'Application cancelled. You can apply to another specialist.' });
}

// Pending applications waiting for this specialist, oldest first.
async function listIncoming(req, res) {
  const [rows] = await pool.query(
    `SELECT a.beneficiary_id, a.module_id, a.applied_at, a.match_reasons,
            lm.title AS module_title, lm.phase, learner.full_name AS learner_name, learner.avatar_url,
            learner.city, learner.province,
            (SELECT sa.band FROM elevate_skill_assessments sa
             WHERE sa.user_id = a.beneficiary_id AND sa.skill_id = a.matched_skill_id
             ORDER BY sa.attempt DESC LIMIT 1) AS band
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     JOIN users learner ON learner.id = a.beneficiary_id AND learner.status = 'active'
     WHERE a.specialist_id = ? AND a.assignment_status = 'pending'
     ORDER BY a.applied_at ASC, lm.sort_order ASC`,
    [req.user.id]
  );
  res.json({
    success: true,
    data: rows.map((row) => ({
      beneficiaryId: row.beneficiary_id,
      moduleId: row.module_id,
      moduleTitle: row.module_title,
      phase: row.phase,
      learnerName: row.learner_name,
      learnerAvatar: row.avatar_url,
      place: [row.city, row.province].filter(Boolean).join(', '),
      appliedAt: row.applied_at,
      band: row.band || null,
      reasons: (() => { try { return JSON.parse(row.match_reasons || '[]'); } catch { return []; } })(),
    })),
  });
}

// Locks the learner first (same order as everything else that changes their
// matches), then the application row.
async function findPending(connection, req) {
  await lockLearner(connection, req.params.beneficiaryId);
  const [rows] = await connection.query(
    `SELECT beneficiary_id FROM elevate_module_assignments
     WHERE module_id = ? AND beneficiary_id = ? AND specialist_id = ? AND assignment_status = 'pending'
     FOR UPDATE`,
    [req.params.moduleId, req.params.beneficiaryId, req.user.id]
  );
  return rows[0] || null;
}

// The specialist accepts: the learner is now doing the topic, and the chat opens.
async function acceptApplication(req, res) {
  const moduleId = Number(req.params.moduleId);
  const beneficiaryId = Number(req.params.beneficiaryId);
  const result = await withTransaction(async (connection) => {
    if (!await findPending(connection, req)) return { refuse: 404, message: 'This application is no longer waiting for you.' };
    const [[limit]] = await connection.query(
      `SELECT teaches.max_learners,
              (SELECT COUNT(*) FROM elevate_module_assignments a
               WHERE a.specialist_id = ? AND a.module_id = ? AND a.assignment_status = 'assigned') AS learners
       FROM user_skills teaches
       JOIN module_skills ms ON ms.skill_id = teaches.skill_id AND ms.is_primary = 1 AND ms.module_id = ?
       WHERE teaches.user_id = ? AND teaches.relation_type = 'teaches'`,
      [req.user.id, moduleId, moduleId, req.user.id]
    );
    if (limit?.max_learners && Number(limit.learners) >= Number(limit.max_learners)) {
      return { refuse: 409, message: `You already have ${limit.learners} learners in this topic, your limit. Raise it in your teaching plan or decline.` };
    }
    await connection.query(
      `UPDATE elevate_module_assignments SET assignment_status = 'assigned', assigned_at = NOW()
       WHERE module_id = ? AND beneficiary_id = ?`,
      [moduleId, beneficiaryId]
    );
    await connection.query('INSERT IGNORE INTO module_connections (beneficiary_id, module_id) VALUES (?, ?)', [beneficiaryId, moduleId]);
    const [userAId, userBId] = [beneficiaryId, Number(req.user.id)].sort((a, b) => a - b);
    await connection.query('INSERT IGNORE INTO conversations (module_id, user_a_id, user_b_id) VALUES (?, ?, ?)', [moduleId, userAId, userBId]);
    const [[conversation]] = await connection.query(
      'SELECT id FROM conversations WHERE module_id = ? AND user_a_id = ? AND user_b_id = ?',
      [moduleId, userAId, userBId]
    );
    return { conversationId: conversation.id };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'accepted', moduleId, targetUserId: beneficiaryId });
  const { title, nameOf } = await names(moduleId, req.user.id, beneficiaryId);
  await notify(req.app, beneficiaryId, {
    kind: 'accepted', moduleId, conversationId: result.conversationId, moduleTitle: title, senderName: nameOf(req.user.id),
    link: `/modules?tab=ongoing&chat=${result.conversationId}`,
    body: `${nameOf(req.user.id)} accepted you in ${title}. Say hello!`,
  });
  res.json({ success: true, message: `${nameOf(beneficiaryId)} is now in your ${title} learners.`, data: { conversationId: result.conversationId } });
}

// The specialist declines: they aren't offered to this learner for the topic
// again, and the learner chooses another specialist.
async function declineApplication(req, res) {
  const moduleId = Number(req.params.moduleId);
  const beneficiaryId = Number(req.params.beneficiaryId);
  const result = await withTransaction(async (connection) => {
    if (!await findPending(connection, req)) return { refuse: 404, message: 'This application is no longer waiting for you.' };
    await connection.query(
      'INSERT IGNORE INTO elevate_application_declines (beneficiary_id, module_id, specialist_id) VALUES (?, ?, ?)',
      [beneficiaryId, moduleId, req.user.id]
    );
    await connection.query(
      'UPDATE elevate_module_assignments SET applied_at = NULL WHERE beneficiary_id = ? AND module_id = ?',
      [beneficiaryId, moduleId]
    );
    await recomputeElevateAssignments(beneficiaryId, connection);
    return { ok: true };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'declined', moduleId, targetUserId: beneficiaryId });
  const { title, nameOf } = await names(moduleId, req.user.id, beneficiaryId);
  await notify(req.app, beneficiaryId, {
    kind: 'declined', moduleId, moduleTitle: title, senderName: nameOf(req.user.id), link: '/modules',
    body: `${nameOf(req.user.id)} can't take you in ${title}. Choose another specialist.`,
  });
  res.json({ success: true, message: `Declined. ${nameOf(beneficiaryId)} can choose another specialist for ${title}.` });
}

module.exports = { listOptions, applyToTopic, cancelApplication, listIncoming, acceptApplication, declineApplication };
