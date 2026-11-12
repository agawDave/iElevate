const { pool } = require('../config/db');
const { logActivity } = require('../lib/activityLog');
const { recomputeAssignmentsForSpecialist } = require('../services/elevateAssignmentService');

// Specialists create their own module for each ELEVATE topic they teach; the
// admin approves it before beneficiaries can apply to them for that topic.
//   draft -> pending (sent to the admin) -> approved
//                                        -> changes_requested (with a note) -> pending ...
// The module's materials, activities and pre/post-test are linked by
// (topic, specialist), the same as before modules had an owner.

const LIMITS = { title: 160, overview: 2000, note: 1000, minOverview: 30, maxHours: 200 };
const REVIEW_STATUSES = ['pending', 'approved', 'changes_requested'];

function notify(app, userId, payload) {
  const io = app.get('io');
  if (io && userId) io.to(`user:${userId}`).emit('notification:new', payload);
}

// The specialist has the topic in their teaching plan.
async function teachesTopic(specialistId, topicId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM module_skills ms
     JOIN user_skills us ON us.skill_id = ms.skill_id AND us.relation_type = 'teaches' AND us.user_id = ?
     JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1 AND lm.approval_status = 'approved'
     WHERE ms.module_id = ? AND ms.is_primary = 1
     LIMIT 1`,
    [specialistId, topicId]
  );
  return rows.length > 0;
}

async function loadTopic(topicId) {
  const [[topic]] = await pool.query(
    `SELECT id, slug, title, phase, description, hours FROM learning_modules
     WHERE id = ? AND is_elevate_program = 1 AND approval_status = 'approved'`,
    [topicId]
  );
  return topic || null;
}

// What the specialist has added to the module so far.
async function contentCounts(topicId, specialistId) {
  const [[row]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM module_resources WHERE module_id = ? AND uploaded_by = ?) AS materials,
       (SELECT COUNT(*) FROM module_activities WHERE module_id = ? AND specialist_id = ?) AS activities,
       (SELECT COUNT(*) FROM module_test_questions WHERE module_id = ? AND specialist_id = ?) AS test_questions`,
    [topicId, specialistId, topicId, specialistId, topicId, specialistId]
  );
  return { materials: Number(row.materials), activities: Number(row.activities), testQuestions: Number(row.test_questions) };
}

function moduleDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    topicId: row.topic_id,
    title: row.title,
    overview: row.overview,
    hours: Number(row.hours) || 0,
    status: row.status,
    reviewNote: row.review_note || '',
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
  };
}

async function findModule(topicId, specialistId) {
  const [[row]] = await pool.query(
    'SELECT * FROM specialist_modules WHERE topic_id = ? AND specialist_id = ?',
    [topicId, specialistId]
  );
  return row || null;
}

// What still stops the module from being sent to the admin ([] = ready).
function missingForSubmit(module, counts) {
  const missing = [];
  if (!module?.title?.trim()) missing.push('a title');
  if ((module?.overview || '').trim().length < LIMITS.minOverview) missing.push('an overview of a sentence or more');
  if (!counts.materials) missing.push('at least one material');
  if (!counts.activities) missing.push('at least one activity');
  return missing;
}

function readFields(body = {}) {
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const overview = typeof body.overview === 'string' ? body.overview.trim() : '';
  const hours = Number(body.hours);
  if (!title) return { error: 'Give your module a title.' };
  if (title.length > LIMITS.title) return { error: `Keep the title under ${LIMITS.title} characters.` };
  if (overview.length > LIMITS.overview) return { error: `Keep the overview under ${LIMITS.overview} characters.` };
  if (!Number.isInteger(hours) || hours < 1 || hours > LIMITS.maxHours) return { error: `Hours must be a whole number from 1 to ${LIMITS.maxHours}.` };
  return { value: { title, overview, hours } };
}

async function requireSpecialist(req, res) {
  const [[me]] = await pool.query("SELECT user_type, role FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (!me || me.user_type !== 'specialist' || ['admin', 'moderator'].includes(me.role)) {
    res.status(403).json({ success: false, message: 'Only specialists create modules.' });
    return false;
  }
  return true;
}

// ------------------------------------------------------------- specialists

// The create / edit page: the topic from the training design, the module so
// far, and what has been added to it.
async function getMyModule(req, res) {
  if (!await requireSpecialist(req, res)) return;
  const topicId = Number(req.params.topicId);
  const topic = await loadTopic(topicId);
  if (!topic) return res.status(404).json({ success: false, message: 'That ELEVATE topic was not found.' });
  const [module, teaches, counts] = await Promise.all([
    findModule(topicId, req.user.id),
    teachesTopic(req.user.id, topicId),
    contentCounts(topicId, req.user.id),
  ]);
  if (!module && !teaches) return res.status(403).json({ success: false, message: 'Add this topic to your teaching plan first.' });
  res.json({
    success: true,
    data: {
      topic: { id: topic.id, slug: topic.slug, title: topic.title, phase: topic.phase, description: topic.description, hours: Number(topic.hours) || 0 },
      module: moduleDto(module),
      counts,
      teaches,
      missing: missingForSubmit(module, counts),
    },
  });
}

// Creates the module (as a draft) or saves changes to it. An approved module
// stays approved; one waiting for the admin keeps waiting.
async function saveMyModule(req, res) {
  if (!await requireSpecialist(req, res)) return;
  const topicId = Number(req.params.topicId);
  if (!await loadTopic(topicId)) return res.status(404).json({ success: false, message: 'That ELEVATE topic was not found.' });
  if (!await teachesTopic(req.user.id, topicId)) return res.status(403).json({ success: false, message: 'Add this topic to your teaching plan first.' });
  const fields = readFields(req.body);
  if (fields.error) return res.status(400).json({ success: false, message: fields.error });
  const { title, overview, hours } = fields.value;
  const existing = await findModule(topicId, req.user.id);
  await pool.query(
    `INSERT INTO specialist_modules (topic_id, specialist_id, title, overview, hours)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), overview = VALUES(overview), hours = VALUES(hours)`,
    [topicId, req.user.id, title, overview, hours]
  );
  const module = await findModule(topicId, req.user.id);
  res.json({
    success: true,
    message: existing ? 'Saved.' : 'Module created. Add your materials and activities, then submit it for approval.',
    data: moduleDto(module),
  });
}

// Sends the module to the admin.
async function submitMyModule(req, res) {
  if (!await requireSpecialist(req, res)) return;
  const topicId = Number(req.params.topicId);
  const topic = await loadTopic(topicId);
  if (!topic) return res.status(404).json({ success: false, message: 'That ELEVATE topic was not found.' });
  if (!await teachesTopic(req.user.id, topicId)) return res.status(403).json({ success: false, message: 'Add this topic to your teaching plan first.' });
  const module = await findModule(topicId, req.user.id);
  if (!module) return res.status(400).json({ success: false, message: 'Create your module first.' });
  if (module.status === 'approved') return res.status(409).json({ success: false, message: 'This module is already approved.' });
  if (module.status === 'pending') return res.status(409).json({ success: false, message: 'This module is already waiting for the admin.' });
  const missing = missingForSubmit(module, await contentCounts(topicId, req.user.id));
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Before submitting, add ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`, data: { missing } });
  }
  const [result] = await pool.query(
    `UPDATE specialist_modules SET status = 'pending', submitted_at = NOW()
     WHERE id = ? AND status IN ('draft', 'changes_requested')`,
    [module.id]
  );
  if (!result.affectedRows) return res.status(409).json({ success: false, message: 'This module changed in the meantime. Reload the page.' });
  await logActivity({ userId: req.user.id, action: 'module_submitted', moduleId: topicId, details: module.title });
  const [admins] = await pool.query("SELECT id FROM users WHERE role IN ('admin', 'moderator') AND status = 'active'");
  admins.forEach((admin) => notify(req.app, admin.id, { type: 'module_submitted', moduleId: topicId }));
  res.json({ success: true, message: 'Sent to the admin for approval. You can keep adding activities while you wait.', data: moduleDto(await findModule(topicId, req.user.id)) });
}

// -------------------------------------------------------------------- admin

function searchTerm(query) {
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  return q ? `%${q.replace(/[\\%_]/g, (match) => `\\${match}`)}%` : '';
}

// Specialists' modules by review status (drafts aren't sent yet, so they
// don't show). Counts for the tabs follow the search.
async function listModulesForReview(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
  const where = ["sm.status <> 'draft'"];
  const params = [];
  const like = searchTerm(req.query);
  if (like) {
    where.push('(sm.title LIKE ? OR lm.title LIKE ? OR u.full_name LIKE ?)');
    params.push(like, like, like);
  }
  const tabWhere = where.join(' AND ');
  const tabParams = [...params];
  const status = REVIEW_STATUSES.includes(req.query.status) ? req.query.status : 'pending';
  where.push('sm.status = ?');
  params.push(status);
  const whereSql = where.join(' AND ');
  const from = `FROM specialist_modules sm
     JOIN learning_modules lm ON lm.id = sm.topic_id
     JOIN users u ON u.id = sm.specialist_id`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from} WHERE ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT sm.id, sm.topic_id, sm.title, sm.overview, sm.hours, sm.status, sm.review_note,
            sm.submitted_at, sm.reviewed_at, sm.approved_at,
            lm.title AS topic_title, lm.phase, lm.slug,
            u.id AS specialist_id, u.full_name AS specialist_name, u.avatar_url AS specialist_avatar,
            (SELECT COUNT(*) FROM module_resources r WHERE r.module_id = sm.topic_id AND r.uploaded_by = sm.specialist_id) AS materials,
            (SELECT COUNT(*) FROM module_activities a WHERE a.module_id = sm.topic_id AND a.specialist_id = sm.specialist_id) AS activities,
            (SELECT COUNT(*) FROM module_test_questions q WHERE q.module_id = sm.topic_id AND q.specialist_id = sm.specialist_id) AS test_questions
     ${from}
     WHERE ${whereSql}
     ORDER BY ${status === 'pending' ? 'sm.submitted_at ASC' : 'COALESCE(sm.reviewed_at, sm.submitted_at) DESC'}, sm.id
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  const [[counts]] = await pool.query(
    `SELECT SUM(sm.status = 'pending') AS pending, SUM(sm.status = 'approved') AS approved,
            SUM(sm.status = 'changes_requested') AS changes_requested
     ${from} WHERE ${tabWhere}`,
    tabParams
  );
  res.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      topicId: row.topic_id,
      title: row.title,
      overview: row.overview,
      hours: Number(row.hours) || 0,
      status: row.status,
      reviewNote: row.review_note || '',
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      topicTitle: row.topic_title,
      phase: row.phase,
      slug: row.slug,
      specialist: { id: row.specialist_id, name: row.specialist_name, avatar: row.specialist_avatar || null },
      counts: { materials: Number(row.materials), activities: Number(row.activities), testQuestions: Number(row.test_questions) },
    })),
    pagination: { page, pageSize, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)) },
    counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value) || 0])),
  });
}

// One module with everything the admin reviews: overview, materials,
// activities and the test.
async function getModuleForReview(req, res) {
  const [[row]] = await pool.query(
    `SELECT sm.*, lm.title AS topic_title, lm.phase, lm.slug, lm.hours AS topic_hours,
            u.full_name AS specialist_name, u.avatar_url AS specialist_avatar, u.email AS specialist_email,
            reviewer.full_name AS reviewer_name
     FROM specialist_modules sm
     JOIN learning_modules lm ON lm.id = sm.topic_id
     JOIN users u ON u.id = sm.specialist_id
     LEFT JOIN users reviewer ON reviewer.id = sm.reviewed_by
     WHERE sm.id = ?`,
    [req.params.moduleId]
  );
  if (!row) return res.status(404).json({ success: false, message: 'Module not found.' });
  const [[materials], [activities], [[test]]] = await Promise.all([
    pool.query(
      `SELECT id, resource_type, title, original_filename, external_url FROM module_resources
       WHERE module_id = ? AND uploaded_by = ? ORDER BY sort_order, id`,
      [row.topic_id, row.specialist_id]
    ),
    pool.query(
      `SELECT id, activity_type, prompt FROM module_activities
       WHERE module_id = ? AND specialist_id = ? ORDER BY sort_order, id`,
      [row.topic_id, row.specialist_id]
    ),
    pool.query('SELECT COUNT(*) AS n FROM module_test_questions WHERE module_id = ? AND specialist_id = ?', [row.topic_id, row.specialist_id]),
  ]);
  res.json({
    success: true,
    data: {
      ...moduleDto(row),
      topicTitle: row.topic_title,
      phase: row.phase,
      slug: row.slug,
      topicHours: Number(row.topic_hours) || 0,
      reviewerName: row.reviewer_name || null,
      specialist: { id: row.specialist_id, name: row.specialist_name, avatar: row.specialist_avatar || null, email: row.specialist_email },
      materials: materials.map((item) => ({ id: item.id, type: item.resource_type, title: item.title, fileName: item.original_filename, url: item.external_url })),
      activities: activities.map((item) => ({ id: item.id, type: item.activity_type, prompt: item.prompt })),
      testQuestions: Number(test.n),
    },
  });
}

// The admin approves a module waiting for review, or asks for changes with a
// note the specialist sees.
async function reviewSpecialistModule(req, res) {
  const status = req.body?.status;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!['approved', 'changes_requested'].includes(status)) return res.status(400).json({ success: false, message: 'Approve the module or ask for changes.' });
  if (status === 'changes_requested' && note.length < 5) return res.status(400).json({ success: false, message: 'Write a note telling the specialist what to change.' });
  if (note.length > LIMITS.note) return res.status(400).json({ success: false, message: `Keep the note under ${LIMITS.note} characters.` });
  const [[module]] = await pool.query(
    `SELECT sm.id, sm.topic_id, sm.specialist_id, sm.title, sm.status, lm.title AS topic_title
     FROM specialist_modules sm JOIN learning_modules lm ON lm.id = sm.topic_id WHERE sm.id = ?`,
    [req.params.moduleId]
  );
  if (!module) return res.status(404).json({ success: false, message: 'Module not found.' });
  const [result] = await pool.query(
    `UPDATE specialist_modules
     SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW(),
         approved_at = IF(? = 'approved', NOW(), approved_at)
     WHERE id = ? AND status = 'pending'`,
    [status, note || null, req.user.id, status, module.id]
  );
  if (!result.affectedRows) return res.status(409).json({ success: false, message: 'This module is no longer waiting for review.' });

  const approved = status === 'approved';
  await logActivity({
    userId: req.user.id,
    action: approved ? 'module_approved' : 'module_changes_requested',
    moduleId: module.topic_id,
    targetUserId: module.specialist_id,
    details: module.title,
  });
  notify(req.app, module.specialist_id, {
    type: 'module_review',
    kind: approved ? 'approved' : 'changes',
    moduleId: module.topic_id,
    moduleTitle: module.title,
    senderName: 'Admin',
    body: approved
      ? `Your module “${module.title}” was approved. Beneficiaries can now apply to you for ${module.topic_title}.`
      : `The admin asked for changes to “${module.title}”: ${note}`,
  });
  res.json({ success: true, message: approved ? 'Module approved' : 'Changes requested' });

  // A newly approved module can be the best fit for beneficiaries who were
  // waiting for this topic, so their matches are brought up to date.
  if (approved) {
    recomputeAssignmentsForSpecialist().catch((error) => console.error('Recompute after module approval failed:', error.message));
  }
}

module.exports = {
  getMyModule,
  saveMyModule,
  submitMyModule,
  listModulesForReview,
  getModuleForReview,
  reviewSpecialistModule,
  LIMITS,
};
