const { pool } = require('../config/db');
const { loadPairs, countByStatus, weeklyTrend } = require('../lib/elevateAnalytics');
const { offeredOrInUseSql } = require('../lib/programPhases');

// Admin directories: searchable, filterable, server-side paginated lists of
// beneficiaries, specialists, specialist-submitted modules and user accounts,
// so the admin can find one record among thousands without scrolling.

const MAX_PAGE_SIZE = 100;
const USER_STATUSES = ['active', 'suspended', 'banned', 'deleted'];

function paging(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function searchTerm(query) {
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  return q ? `%${q.replace(/[\\%_]/g, (match) => `\\${match}`)}%` : '';
}

function pageResponse(res, rows, total, { page, pageSize }, extra = {}) {
  res.json({
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    ...extra,
  });
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// One row of counts (for the tabs at the top of each directory), as numbers.
// The counts follow every filter except the tab itself.
async function countRow(sql, params = []) {
  const [[row]] = await pool.query(sql, params);
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0]));
}

async function elevateTopics() {
  const [rows] = await pool.query(
    `SELECT id, title, phase FROM learning_modules
     WHERE is_elevate_program = 1 AND approval_status = 'approved' AND ${offeredOrInUseSql('learning_modules')}
     ORDER BY sort_order, id`
  );
  return rows;
}

// ---------------------------------------------------------------- beneficiaries

const BENEFICIARY_SORTS = {
  newest: 'u.created_at DESC, u.id DESC',
  name: 'u.full_name ASC, u.id ASC',
  last_login: 'u.last_login_at IS NULL, u.last_login_at DESC, u.id DESC',
};

// Messages this person sent in their chat with the admin (?) that the admin hasn't read.
const UNREAD_FROM_PERSON = `(SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
  WHERE c.module_id IS NULL AND m.sender_id = u.id AND m.read_at IS NULL AND ? IN (c.user_a_id, c.user_b_id)) AS unread_messages`;

// This person has written in their chat with the admin (?): the Messages tab.
// With unread, only replies the admin hasn't read yet (the tab's dot).
const repliedToAdmin = (unread = false) => `EXISTS (SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
  WHERE c.module_id IS NULL AND m.sender_id = u.id AND ? IN (c.user_a_id, c.user_b_id)${unread ? ' AND m.read_at IS NULL' : ''})`;

async function listBeneficiaries(req, res) {
  const pageInfo = paging(req.query);
  const where = ["u.user_type = 'beneficiary'", "u.role <> 'admin'"];
  const params = [];
  const like = searchTerm(req.query);
  if (like) {
    where.push(`(u.full_name LIKE ? OR u.email LIKE ? OR u.city LIKE ? OR u.province LIKE ? OR c.barangay LIKE ?)`);
    params.push(like, like, like, like, like);
  }
  if (USER_STATUSES.includes(req.query.status)) {
    where.push('u.status = ?');
    params.push(req.query.status);
  }
  if (['female', 'male', 'prefer_not_to_say'].includes(req.query.sex)) {
    where.push('u.sex = ?');
    params.push(req.query.sex);
  }
  if (/^\d+$/.test(String(req.query.topicId || ''))) {
    where.push('EXISTS (SELECT 1 FROM elevate_module_assignments t WHERE t.beneficiary_id = u.id AND t.module_id = ?)');
    params.push(Number(req.query.topicId));
  }
  const tabWhere = where.join(' AND ');
  const tabParams = [...params];
  if (req.query.match === 'waiting') {
    where.push("EXISTS (SELECT 1 FROM elevate_module_assignments t WHERE t.beneficiary_id = u.id AND t.assignment_status = 'waiting')");
  } else if (req.query.match === 'none') {
    where.push('NOT EXISTS (SELECT 1 FROM elevate_module_assignments t WHERE t.beneficiary_id = u.id)');
  } else if (req.query.match === 'messages') {
    where.push(repliedToAdmin());
    params.push(req.user.id);
  }
  const whereSql = where.join(' AND ');
  const order = BENEFICIARY_SORTS[req.query.sort] || BENEFICIARY_SORTS.newest;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     WHERE ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.avatar_url, u.status, u.sex, u.age,
            u.city, u.province, c.barangay, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM elevate_module_assignments a
             WHERE a.beneficiary_id = u.id AND a.assignment_status = 'assigned') AS topics_matched,
            (SELECT COUNT(*) FROM elevate_module_assignments a
             WHERE a.beneficiary_id = u.id AND a.assignment_status = 'waiting') AS topics_waiting,
            (SELECT COUNT(*) FROM elevate_module_assignments a
             WHERE a.beneficiary_id = u.id AND a.assignment_status = 'queued') AS topics_next_up,
            (SELECT COUNT(*) FROM module_certificates mc WHERE mc.user_id = u.id) AS topics_completed,
            ${UNREAD_FROM_PERSON}
     FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     WHERE ${whereSql}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    [req.user.id, ...params, pageInfo.pageSize, pageInfo.offset]
  );
  pageResponse(res, rows.map((row) => ({
    ...row,
    topics_matched: Number(row.topics_matched),
    topics_waiting: Number(row.topics_waiting),
    topics_next_up: Number(row.topics_next_up),
    topics_completed: Number(row.topics_completed),
    unread_messages: Number(row.unread_messages),
  })), Number(total), pageInfo, {
    filters: { topics: await elevateTopics() },
    counts: await countRow(
      `SELECT COUNT(*) AS everyone,
              SUM(EXISTS (SELECT 1 FROM elevate_module_assignments t WHERE t.beneficiary_id = u.id AND t.assignment_status = 'waiting')) AS waiting,
              SUM(NOT EXISTS (SELECT 1 FROM elevate_module_assignments t WHERE t.beneficiary_id = u.id)) AS none,
              SUM(${repliedToAdmin()}) AS messages, SUM(${repliedToAdmin(true)}) AS unread
       FROM users u
       LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
       WHERE ${tabWhere}`,
      [req.user.id, req.user.id, ...tabParams]
    ),
  });
}

async function getBeneficiary(req, res) {
  const [users] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.avatar_url, u.status, u.sex, u.age, DATE_FORMAT(u.birthdate, '%Y-%m-%d') AS birthdate,
            u.civil_status, u.work_status, u.mobile_number, u.school_or_org,
            u.country, u.region_code, u.state_region, u.province, u.city, c.barangay,
            c.learning_modes, c.availability, c.device_access, c.internet_access,
            COALESCE(p.goal_other, g.label) AS goal_label, p.used_computer, p.completed_at AS skill_check_at,
            u.created_at, u.last_login_at
     FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     LEFT JOIN elevate_learner_profiles p ON p.user_id = u.id
     LEFT JOIN program_goals g ON g.value = p.goal_track
     WHERE u.id = ? AND u.user_type = 'beneficiary'`,
    [req.params.id]
  );
  const user = users[0];
  if (!user) return res.status(404).json({ success: false, message: 'Beneficiary not found' });
  const [topics] = await pool.query(
    `SELECT a.module_id, lm.title, lm.phase, a.assignment_status, a.waiting_reason,
            IF(a.assignment_status IN ('pending', 'assigned'), s.full_name, NULL) AS specialist_name, cert.issued_at AS completed_at,
            cert.id AS certificate_id, cert.file_storage_name IS NOT NULL AS certificate_has_file
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     LEFT JOIN users s ON s.id = a.specialist_id
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
     WHERE a.beneficiary_id = ?
     ORDER BY lm.sort_order, lm.id`,
    [user.id]
  );
  const pairStatus = new Map((await loadPairs({ beneficiaryId: user.id })).map((pair) => [Number(pair.module_id), pair.status]));
  res.json({
    success: true,
    data: {
      ...user,
      learning_modes: parseJsonList(user.learning_modes),
      availability: parseJsonList(user.availability),
      topics: topics.map((topic) => ({
        ...topic,
        certificate_has_file: Boolean(topic.certificate_has_file),
        progress: pairStatus.get(Number(topic.module_id)) || null,
      })),
    },
  });
}

// ------------------------------------------------------------------ specialists

const SPECIALIST_SORTS = {
  name: 'u.full_name ASC, u.id ASC',
  newest: 'u.created_at DESC, u.id DESC',
  learners: 'learners DESC, u.full_name ASC',
};

async function listSpecialists(req, res) {
  const pageInfo = paging(req.query);
  const where = ["u.user_type = 'specialist'", "u.role <> 'admin'"];
  const params = [];
  const like = searchTerm(req.query);
  if (like) {
    where.push(`(u.full_name LIKE ? OR u.email LIKE ? OR u.city LIKE ? OR EXISTS (
      SELECT 1 FROM user_skills qs
      JOIN module_skills qms ON qms.skill_id = qs.skill_id AND qms.is_primary = 1
      JOIN learning_modules qlm ON qlm.id = qms.module_id
      WHERE qs.user_id = u.id AND qs.relation_type = 'teaches' AND qlm.title LIKE ?))`);
    params.push(like, like, like, like);
  }
  if (USER_STATUSES.includes(req.query.status)) {
    where.push('u.status = ?');
    params.push(req.query.status);
  }
  if (/^\d+$/.test(String(req.query.topicId || ''))) {
    where.push(`EXISTS (SELECT 1 FROM user_skills ts
      JOIN module_skills tms ON tms.skill_id = ts.skill_id AND tms.is_primary = 1
      WHERE ts.user_id = u.id AND ts.relation_type = 'teaches' AND tms.module_id = ?)`);
    params.push(Number(req.query.topicId));
  }
  const tabWhere = where.join(' AND ');
  const tabParams = [...params];
  if (req.query.topics === 'none') {
    where.push("NOT EXISTS (SELECT 1 FROM user_skills ns WHERE ns.user_id = u.id AND ns.relation_type = 'teaches')");
  } else if (req.query.topics === 'messages') {
    where.push(repliedToAdmin());
    params.push(req.user.id);
  }
  const whereSql = where.join(' AND ');
  const order = SPECIALIST_SORTS[req.query.sort] || SPECIALIST_SORTS.name;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u WHERE ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.avatar_url, u.status, u.city, u.province, u.created_at, u.last_login_at,
            (SELECT GROUP_CONCAT(lm.title ORDER BY lm.sort_order SEPARATOR ', ')
             FROM user_skills us
             JOIN module_skills ms ON ms.skill_id = us.skill_id AND ms.is_primary = 1
             JOIN learning_modules lm ON lm.id = ms.module_id
               AND lm.is_elevate_program = 1 AND lm.approval_status = 'approved'
             WHERE us.user_id = u.id AND us.relation_type = 'teaches') AS topics_taught,
            (SELECT COUNT(*) FROM elevate_module_assignments a
             WHERE a.specialist_id = u.id AND a.assignment_status = 'assigned') AS learners,
            ${UNREAD_FROM_PERSON}
     FROM users u
     WHERE ${whereSql}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    [req.user.id, ...params, pageInfo.pageSize, pageInfo.offset]
  );
  // Incoming / ongoing / completed, only for the specialists on this page.
  const pairs = await loadPairs({ specialistIds: rows.map((row) => row.id) });
  pageResponse(res, rows.map((row) => ({
    ...row,
    learners: Number(row.learners),
    unread_messages: Number(row.unread_messages),
    ...countByStatus(pairs.filter((pair) => Number(pair.specialist_id) === Number(row.id))),
  })), Number(total), pageInfo, {
    filters: { topics: await elevateTopics() },
    counts: await countRow(
      `SELECT COUNT(*) AS everyone,
              SUM(NOT EXISTS (SELECT 1 FROM user_skills ns WHERE ns.user_id = u.id AND ns.relation_type = 'teaches')) AS none,
              SUM(${repliedToAdmin()}) AS messages, SUM(${repliedToAdmin(true)}) AS unread
       FROM users u WHERE ${tabWhere}`,
      [req.user.id, req.user.id, ...tabParams]
    ),
  });
}

async function getSpecialist(req, res) {
  const [users] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.avatar_url, u.status, u.sex, u.mobile_number, u.school_or_org,
            u.country, u.province, u.city, c.barangay, c.learning_modes, c.availability,
            u.created_at, u.last_login_at
     FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     WHERE u.id = ? AND u.user_type = 'specialist'`,
    [req.params.id]
  );
  const user = users[0];
  if (!user) return res.status(404).json({ success: false, message: 'Specialist not found' });
  const [topics] = await pool.query(
    `SELECT lm.id AS module_id, lm.title, lm.phase, us.proficiency, us.max_learners, us.learner_levels
     FROM user_skills us
     JOIN module_skills ms ON ms.skill_id = us.skill_id AND ms.is_primary = 1
     JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1
     WHERE us.user_id = ? AND us.relation_type = 'teaches'
     ORDER BY lm.sort_order, lm.id`,
    [user.id]
  );
  const pairs = await loadPairs({ specialistId: user.id });
  res.json({
    success: true,
    data: {
      ...user,
      learning_modes: parseJsonList(user.learning_modes),
      availability: parseJsonList(user.availability),
      summary: countByStatus(pairs),
      trend: weeklyTrend(pairs),
      topics: topics.map((topic) => ({
        ...topic,
        learner_levels: parseJsonList(topic.learner_levels),
        ...countByStatus(pairs.filter((pair) => Number(pair.module_id) === Number(topic.module_id))),
      })),
      learners: pairs
        .map((pair) => ({ name: pair.learner_name, topic: pair.module_title, status: pair.status, matchedAt: pair.assigned_at }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.topic.localeCompare(b.topic)),
    },
  });
}

// Module approval lives in specialistModuleController (specialists' own modules).

// ------------------------------------------------------------------- users

const USER_SORTS = {
  newest: 'created_at DESC, id DESC',
  name: 'full_name ASC, id ASC',
  last_login: 'last_login_at IS NULL, last_login_at DESC, id DESC',
};

async function listUsers(req, res) {
  const pageInfo = paging(req.query);
  const where = ['1 = 1'];
  const params = [];
  const like = searchTerm(req.query);
  if (like) {
    where.push('(full_name LIKE ? OR email LIKE ?)');
    params.push(like, like);
  }
  if (USER_STATUSES.includes(req.query.status)) {
    where.push('status = ?');
    params.push(req.query.status);
  }
  const tabWhere = where.join(' AND ');
  const tabParams = [...params];
  if (req.query.type === 'admin') {
    where.push("role IN ('admin', 'moderator')");
  } else if (['beneficiary', 'specialist'].includes(req.query.type)) {
    where.push("user_type = ? AND role = 'user'");
    params.push(req.query.type);
  }
  const whereSql = where.join(' AND ');
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT id, full_name, email, avatar_url, role, user_type, status, created_at, last_login_at
     FROM users WHERE ${whereSql}
     ORDER BY ${USER_SORTS[req.query.sort] || USER_SORTS.newest}
     LIMIT ? OFFSET ?`,
    [...params, pageInfo.pageSize, pageInfo.offset]
  );
  pageResponse(res, rows, Number(total), pageInfo, {
    counts: await countRow(
      `SELECT COUNT(*) AS everyone,
              SUM(user_type = 'beneficiary' AND role = 'user') AS beneficiary,
              SUM(user_type = 'specialist' AND role = 'user') AS specialist,
              SUM(role IN ('admin', 'moderator')) AS admin
       FROM users WHERE ${tabWhere}`,
      tabParams
    ),
  });
}

// Unread messages in this admin's (?) chats from beneficiaries or specialists.
const UNREAD_FROM_TYPE = (type) => `(SELECT COUNT(*) FROM messages m
  JOIN conversations c ON c.id = m.conversation_id JOIN users s ON s.id = m.sender_id
  WHERE c.module_id IS NULL AND ? IN (c.user_a_id, c.user_b_id) AND m.read_at IS NULL AND s.user_type = '${type}')`;

// Counts for the admin sidebar badges and directory headings.
async function navCounts(req, res) {
  const [[row]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE user_type = 'beneficiary' AND role = 'user') AS beneficiaries,
       (SELECT COUNT(*) FROM users WHERE user_type = 'specialist' AND role = 'user') AS specialists,
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM specialist_modules WHERE status = 'pending') AS pending_modules,
       (SELECT COUNT(*) FROM learning_modules WHERE is_elevate_program = 1 AND approval_status = 'approved' AND is_hidden = 0) AS design_modules,
       (SELECT COUNT(*) FROM elevate_module_assignments WHERE assignment_status = 'waiting') AS waiting_topics,
       ${UNREAD_FROM_TYPE('beneficiary')} AS unread_beneficiaries,
       ${UNREAD_FROM_TYPE('specialist')} AS unread_specialists`,
    [req.user.id, req.user.id]
  );
  res.json({ success: true, data: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0])) });
}

module.exports = {
  listBeneficiaries,
  getBeneficiary,
  listSpecialists,
  getSpecialist,
  listUsers,
  navCounts,
};
