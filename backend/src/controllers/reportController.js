const { pool } = require('../config/db');
const { offeredOrInUseSql } = require('../lib/programPhases');
const { loadFaceToFace } = require('../lib/moduleTests');

// Tracking and reporting for the admin: the activity log, and reports on
// participation, progress and completed engagements.

const ACTIONS = [
  'login', 'registered', 'skill_check',
  'applied', 'application_cancelled', 'accepted', 'declined',
  'message_sent',
  'session_booked', 'session_confirmed', 'session_cancelled', 'session_completed', 'session_no_show',
  'session_posted', 'session_joined', 'session_left',
  'activity_created', 'activity_answered', 'answer_reviewed', 'module_test',
  'certificate_issued', 'topic_reopened', 'portfolio_added', 'recommendation_requested', 'recommendation_written',
  'module_submitted', 'module_approved', 'module_changes_requested',
  'training_design',
];
const DAY = 24 * 60 * 60 * 1000;
const MAX_SPAN_DAYS = 3 * 366;
// Face-to-face attendance, one row per beneficiary who came: a one-on-one
// session held, or an open session the specialist marked them as attending.
const FACE_TO_FACE_SQL = `(
  SELECT ms.id AS session_id, ms.module_id, ms.specialist_id, ms.starts_at, ms.beneficiary_id
  FROM module_sessions ms WHERE ms.status = 'completed' AND ms.is_open = 0
  UNION ALL
  SELECT ms.id, ms.module_id, ms.specialist_id, ms.starts_at, sa.beneficiary_id
  FROM module_sessions ms JOIN module_session_attendees sa ON sa.session_id = ms.id AND sa.attended = 1
  WHERE ms.status = 'completed' AND ms.is_open = 1)`;

function like(value) {
  return `%${String(value).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// from..to (inclusive days). Default: the last 30 days.
function readRange(query) {
  const to = parseDay(query.to) || today();
  const from = parseDay(query.from) || addDays(to, -29);
  if (from > to) return { error: 'The start date must be on or before the end date.' };
  if ((to - from) / DAY > MAX_SPAN_DAYS) return { error: 'Choose a range of up to 3 years.' };
  return { from, to, toExclusive: addDays(to, 1) };
}

// ---------------------------------------------------------------- activity log

// Who did it: the Everyone / Beneficiaries / Specialists / Admins tabs.
const WHO = {
  beneficiary: "u.user_type = 'beneficiary' AND u.role NOT IN ('admin', 'moderator')",
  specialist: "u.user_type = 'specialist' AND u.role NOT IN ('admin', 'moderator')",
  admin: "u.role IN ('admin', 'moderator')",
};
const ACTIVITY_FROM = `FROM user_activity_log l
     JOIN users u ON u.id = l.user_id
     LEFT JOIN users t ON t.id = l.target_user_id
     LEFT JOIN learning_modules lm ON lm.id = l.module_id`;

async function listActivity(req, res) {
  // all=1 returns every matching row (up to 10,000) for a CSV download.
  const all = req.query.all === '1';
  const page = all ? 1 : Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = all ? 10000 : Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize, 10) || 25));
  const where = ['1 = 1'];
  const params = [];
  if (req.query.q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR t.full_name LIKE ? OR lm.title LIKE ?)');
    const term = like(String(req.query.q).trim().slice(0, 100));
    params.push(term, term, term, term);
  }
  if (ACTIONS.includes(req.query.action)) {
    where.push('l.action = ?');
    params.push(req.query.action);
  } else if (req.query.logins !== '1') {
    // Logins would bury everything else; they show with logins=1 or the "Logged in" filter.
    where.push("l.action <> 'login'");
  }
  const from = parseDay(req.query.from);
  const to = parseDay(req.query.to);
  if (from) { where.push('l.created_at >= ?'); params.push(from); }
  if (to) { where.push('l.created_at < ?'); params.push(addDays(to, 1)); }
  // The tab counts follow every filter except the tab itself.
  const tabWhere = where.join(' AND ');
  const tabParams = [...params];
  if (WHO[req.query.userType]) where.push(WHO[req.query.userType]);
  const base = `${ACTIVITY_FROM}
     WHERE ${where.join(' AND ')}`;
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${base}`, params);
  const [rows] = await pool.query(
    `SELECT l.id, l.action, l.details, l.created_at, u.id AS user_id, u.full_name AS user_name, u.avatar_url AS user_avatar, u.user_type, u.role AS user_role,
            t.full_name AS target_name, t.user_type AS target_type, lm.title AS module_title
     ${base}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  const [[counts]] = all ? [[{}]] : await pool.query(
    `SELECT COUNT(*) AS everyone, SUM(${WHO.beneficiary}) AS beneficiary, SUM(${WHO.specialist}) AS specialist, SUM(${WHO.admin}) AS admin
     ${ACTIVITY_FROM}
     WHERE ${tabWhere}`,
    tabParams
  );
  res.json({
    success: true,
    data: rows,
    pagination: { page, pageSize, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)) },
    filters: { actions: ACTIONS },
    counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value) || 0])),
  });
}

// --------------------------------------------------------------------- reports

function readFilters(query) {
  return {
    phase: typeof query.phase === 'string' && query.phase.trim() ? query.phase.trim().slice(0, 100) : '',
    moduleId: Number.parseInt(query.moduleId, 10) || null,
  };
}

// Which beneficiaries the report covers (b = a users row).
const LEARNERS = "b.user_type = 'beneficiary' AND b.role NOT IN ('admin', 'moderator')";

// Which topics the report covers (alias = a learning_modules row).
function topicSql(alias, filters) {
  const parts = [`${alias}.is_elevate_program = 1`, offeredOrInUseSql(alias)];
  const params = [];
  if (filters.phase) { parts.push(`${alias}.phase = ?`); params.push(filters.phase); }
  if (filters.moduleId) { parts.push(`${alias}.id = ?`); params.push(filters.moduleId); }
  return { sql: parts.join(' AND '), params };
}

// Day buckets for short ranges, Monday-to-Sunday weeks for longer ones.
function makeBuckets(from, to) {
  const days = Math.round((to - from) / DAY) + 1;
  const unit = days <= 45 ? 'day' : 'week';
  const buckets = [];
  let start = new Date(from);
  if (unit === 'week') start = addDays(start, -((start.getDay() + 6) % 7));
  while (start <= to) {
    buckets.push(isoDay(start));
    start = addDays(start, unit === 'day' ? 1 : 7);
  }
  const indexOf = (day) => {
    if (unit === 'day') return buckets.indexOf(day);
    let index = -1;
    for (let i = 0; i < buckets.length && buckets[i] <= day; i += 1) index = i;
    return index;
  };
  return { unit, buckets, indexOf };
}

function toSeries(range, seriesByKey) {
  const { unit, buckets, indexOf } = makeBuckets(range.from, range.to);
  const rows = buckets.map((start) => ({ weekStart: start }));
  Object.entries(seriesByKey).forEach(([key, perDay]) => {
    rows.forEach((row) => { row[key] = 0; });
    perDay.forEach((row) => {
      const index = indexOf(row.day);
      if (index >= 0) rows[index][key] += Number(row.n);
    });
  });
  return { unit, rows };
}

function ageOf(row) {
  if (row.birthdate) {
    const born = new Date(`${row.birthdate}T00:00:00`);
    if (!Number.isNaN(born.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - born.getFullYear();
      if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
      return age;
    }
  }
  return row.age ?? null;
}

function ageGroup(age) {
  if (age === null || age === undefined) return 'Not given';
  if (age < 25) return '24 and under';
  if (age < 35) return '25–34';
  if (age < 45) return '35–44';
  return '45 and over';
}

function parseList(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function countBy(items, keyOf) {
  const counts = new Map();
  items.forEach((item) => {
    [].concat(keyOf(item)).forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  });
  return Object.fromEntries(counts);
}

const average = (values) => (values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null);

async function getReport(req, res) {
  const range = readRange(req.query);
  if (range.error) return res.status(400).json({ success: false, message: range.error });
  const filters = readFilters(req.query);
  const T = topicSql('lm', filters);
  const topicFiltered = Boolean(filters.phase || filters.moduleId);
  const inRange = (column) => `${column} >= ? AND ${column} < ?`;
  const R = [range.from, range.toExclusive];
  const q = async (sql, params) => (await pool.query(sql, params))[0];

  // Log events in range by the filtered beneficiaries (as the doer or the other person).
  const logEvents = (action, who = 'l.user_id', withTopic = true) => q(
    `SELECT DATE_FORMAT(l.created_at, '%Y-%m-%d') AS day, COUNT(*) AS n
     FROM user_activity_log l
     JOIN users b ON b.id = ${who} AND ${LEARNERS}
     ${withTopic ? `JOIN learning_modules lm ON lm.id = l.module_id AND ${T.sql}` : ''}
     WHERE l.action = ? AND ${inRange('l.created_at')}
     GROUP BY day`,
    [...(withTopic ? T.params : []), action, ...R]
  );

  const [
    loginsDaily, messagesDaily, answersDaily, faceToFaceDaily, attendanceDaily, sessionsDaily, appliedDaily, acceptedDaily, certificatesDaily,
    [newLearners], [activeSpecialists],
  ] = await Promise.all([
    logEvents('login', 'l.user_id', false),
    q(`SELECT DATE_FORMAT(m.created_at, '%Y-%m-%d') AS day, COUNT(*) AS n
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN learning_modules lm ON lm.id = c.module_id AND ${T.sql}
       JOIN users b ON (b.id = c.user_a_id OR b.id = c.user_b_id) AND ${LEARNERS}
       WHERE ${inRange('m.created_at')}
       GROUP BY day`, [...T.params, ...R]),
    logEvents('activity_answered'),
    // Face-to-face sessions held (that a filtered beneficiary came to), and how many came.
    q(`SELECT DATE_FORMAT(f.starts_at, '%Y-%m-%d') AS day, COUNT(DISTINCT f.session_id) AS n
       FROM ${FACE_TO_FACE_SQL} f
       JOIN learning_modules lm ON lm.id = f.module_id AND ${T.sql}
       JOIN users b ON b.id = f.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('f.starts_at')} GROUP BY day`, [...T.params, ...R]),
    q(`SELECT DATE_FORMAT(f.starts_at, '%Y-%m-%d') AS day, COUNT(*) AS n
       FROM ${FACE_TO_FACE_SQL} f
       JOIN learning_modules lm ON lm.id = f.module_id AND ${T.sql}
       JOIN users b ON b.id = f.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('f.starts_at')} GROUP BY day`, [...T.params, ...R]),
    // Online sessions: each topic test taken and activity answered.
    q(`SELECT DATE_FORMAT(ls.held_at, '%Y-%m-%d') AS day, COUNT(*) AS n
       FROM learning_sessions ls
       JOIN learning_modules lm ON lm.id = ls.module_id AND ${T.sql}
       JOIN users b ON b.id = ls.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('ls.held_at')} GROUP BY day`, [...T.params, ...R]),
    logEvents('applied'),
    logEvents('accepted', 'l.target_user_id'),
    q(`SELECT DATE_FORMAT(mc.issued_at, '%Y-%m-%d') AS day, COUNT(*) AS n
       FROM module_certificates mc
       JOIN learning_modules lm ON lm.id = mc.module_id AND ${T.sql}
       JOIN users b ON b.id = mc.user_id AND ${LEARNERS}
       WHERE ${inRange('mc.issued_at')} GROUP BY day`, [...T.params, ...R]),
    q(`SELECT COUNT(*) AS n FROM users b WHERE ${LEARNERS} AND ${inRange('b.created_at')}`, R),
    // Specialists who did something (signing up alone doesn't count).
    q(`SELECT COUNT(DISTINCT l.user_id) AS n FROM user_activity_log l
       JOIN users s ON s.id = l.user_id AND s.user_type = 'specialist' AND s.role NOT IN ('admin', 'moderator')
       ${topicFiltered ? `JOIN learning_modules lm ON lm.id = l.module_id AND ${T.sql}` : ''}
       WHERE l.action <> 'registered' AND ${inRange('l.created_at')}`, [...(topicFiltered ? T.params : []), ...R]),
  ]);
  const total = (rows) => rows.reduce((sum, row) => sum + Number(row.n), 0);

  // ---- participation, per beneficiary
  const perUser = (rows) => new Map(rows.map((row) => [Number(row.id), Number(row.n)]));
  const [learners, loginsBy, messagesBy, answersBy, heldBy, faceBy, appliedBy, certificatesBy, lastActive] = await Promise.all([
    q(`SELECT b.id, b.full_name, b.email, b.sex, b.age, DATE_FORMAT(b.birthdate, '%Y-%m-%d') AS birthdate,
              b.city, b.sector_tags, b.status, c.barangay, b.created_at
       FROM users b LEFT JOIN user_learning_circumstances c ON c.user_id = b.id
       WHERE ${LEARNERS} AND b.status <> 'deleted'
       ORDER BY b.full_name LIMIT 5000`, []),
    q(`SELECT l.user_id AS id, COUNT(*) AS n FROM user_activity_log l
       WHERE l.action = 'login' AND ${inRange('l.created_at')} GROUP BY l.user_id`, R),
    q(`SELECT m.sender_id AS id, COUNT(*) AS n FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN learning_modules lm ON lm.id = c.module_id AND ${T.sql}
       WHERE ${inRange('m.created_at')} GROUP BY m.sender_id`, [...T.params, ...R]),
    q(`SELECT l.user_id AS id, COUNT(*) AS n FROM user_activity_log l
       JOIN learning_modules lm ON lm.id = l.module_id AND ${T.sql}
       WHERE l.action = 'activity_answered' AND ${inRange('l.created_at')} GROUP BY l.user_id`, [...T.params, ...R]),
    q(`SELECT ls.beneficiary_id AS id, COUNT(*) AS n FROM learning_sessions ls
       JOIN learning_modules lm ON lm.id = ls.module_id AND ${T.sql}
       WHERE ${inRange('ls.held_at')} GROUP BY ls.beneficiary_id`, [...T.params, ...R]),
    q(`SELECT f.beneficiary_id AS id, COUNT(*) AS n FROM ${FACE_TO_FACE_SQL} f
       JOIN learning_modules lm ON lm.id = f.module_id AND ${T.sql}
       WHERE ${inRange('f.starts_at')} GROUP BY f.beneficiary_id`, [...T.params, ...R]),
    q(`SELECT l.user_id AS id, COUNT(*) AS n FROM user_activity_log l
       JOIN learning_modules lm ON lm.id = l.module_id AND ${T.sql}
       WHERE l.action = 'applied' AND ${inRange('l.created_at')} GROUP BY l.user_id`, [...T.params, ...R]),
    q(`SELECT mc.user_id AS id, COUNT(*) AS n FROM module_certificates mc
       JOIN learning_modules lm ON lm.id = mc.module_id AND ${T.sql}
       WHERE ${inRange('mc.issued_at')} GROUP BY mc.user_id`, [...T.params, ...R]),
    q('SELECT l.user_id AS id, MAX(l.created_at) AS at FROM user_activity_log l GROUP BY l.user_id', []),
  ]);
  const [logins, sent, answered, held, faceToFace, applied, certified] = [loginsBy, messagesBy, answersBy, heldBy, faceBy, appliedBy, certificatesBy].map(perUser);
  const lastActiveBy = new Map(lastActive.map((row) => [Number(row.id), row.at]));
  const participationRows = learners.map((row) => {
    const id = Number(row.id);
    const metrics = {
      logins: logins.get(id) || 0,
      messages: sent.get(id) || 0,
      activities: answered.get(id) || 0,
      sessions: held.get(id) || 0,
      faceToFace: faceToFace.get(id) || 0,
      applications: applied.get(id) || 0,
      certificates: certified.get(id) || 0,
    };
    return {
      id,
      name: row.full_name,
      email: row.email,
      sex: row.sex,
      age: ageOf(row),
      barangay: row.barangay,
      city: row.city,
      sectors: parseList(row.sector_tags),
      joinedAt: row.created_at,
      lastActiveAt: lastActiveBy.get(id) || null,
      ...metrics,
      // Logins aren't tied to a topic, so they don't make someone active in a topic report.
      active: Object.entries(metrics).some(([key, value]) => value > 0 && !(topicFiltered && key === 'logins')),
    };
  }).sort((a, b) => Number(b.active) - Number(a.active)
    || (b.logins + b.messages + b.activities + b.sessions) - (a.logins + a.messages + a.activities + a.sessions)
    || a.name.localeCompare(b.name));
  const activeRows = participationRows.filter((row) => row.active);
  const demographics = {
    sex: { all: countBy(participationRows, (row) => row.sex || 'not_given'), active: countBy(activeRows, (row) => row.sex || 'not_given') },
    age: { all: countBy(participationRows, (row) => ageGroup(row.age)), active: countBy(activeRows, (row) => ageGroup(row.age)) },
  };

  // ---- progress in the period, per learner and topic
  const [topics, pairs, hoursRows, skills, testAttempts, answersInRange, allTests, sessionsInRange, faceInRange] = await Promise.all([
    q(`SELECT lm.id, lm.title, lm.phase FROM learning_modules lm
       WHERE ${T.sql} AND lm.approval_status = 'approved' ORDER BY lm.sort_order, lm.id`, T.params),
    q(`SELECT a.beneficiary_id, a.module_id, a.assignment_status, a.applied_at, a.assigned_at,
              b.full_name AS learner_name, s.full_name AS specialist_name, s.id AS specialist_id, cert.issued_at AS completed_at
       FROM elevate_module_assignments a
       JOIN learning_modules lm ON lm.id = a.module_id AND ${T.sql}
       JOIN users b ON b.id = a.beneficiary_id AND ${LEARNERS}
       LEFT JOIN users s ON s.id = a.specialist_id
       LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
       WHERE a.assignment_status IN ('pending', 'assigned')
       ORDER BY lm.sort_order, b.full_name`, [...T.params]),
    loadFaceToFace({}),
    q(`SELECT sa.user_id, ms.module_id, sa.attempt, sa.test_kind, sa.level, sa.band
       FROM elevate_skill_assessments sa
       JOIN module_skills ms ON ms.skill_id = sa.skill_id AND ms.is_primary = 1
       JOIN learning_modules lm ON lm.id = ms.module_id AND ${T.sql}
       JOIN users b ON b.id = sa.user_id AND ${LEARNERS}
       ORDER BY sa.user_id, ms.module_id, sa.attempt`, [...T.params]),
    // Module pre-test / post-test, with the learner's current specialist.
    q(`SELECT t.module_id, t.beneficiary_id, t.test_kind, t.score, t.total
       FROM module_test_attempts t
       JOIN elevate_module_assignments a ON a.beneficiary_id = t.beneficiary_id AND a.module_id = t.module_id
        AND a.specialist_id = t.specialist_id AND a.assignment_status = 'assigned'`, []),
    // Module answers sent in the period, per learner and topic: every submission
    // (tries again included), the same count as Participation's.
    q(`SELECT l.module_id, l.user_id AS beneficiary_id, COUNT(*) AS n
       FROM user_activity_log l
       JOIN learning_modules lm ON lm.id = l.module_id AND ${T.sql}
       JOIN users b ON b.id = l.user_id AND ${LEARNERS}
       WHERE l.action = 'activity_answered' AND ${inRange('l.created_at')}
       GROUP BY l.module_id, l.user_id`, [...T.params, ...R]),
    // Every topic pre-test / post-test (a post-test's pre-test may be older than the period).
    q(`SELECT t.module_id, t.beneficiary_id, t.test_kind, t.score, t.total, t.taken_at, b.full_name AS learner, lm.title AS topic
       FROM module_test_attempts t
       JOIN learning_modules lm ON lm.id = t.module_id AND ${T.sql}
       JOIN users b ON b.id = t.beneficiary_id AND ${LEARNERS}
       ORDER BY t.taken_at, t.id`, [...T.params]),
    // Online sessions in the period, per learner and topic.
    q(`SELECT ls.module_id, ls.beneficiary_id, COUNT(*) AS n FROM learning_sessions ls
       JOIN learning_modules lm ON lm.id = ls.module_id AND ${T.sql}
       JOIN users b ON b.id = ls.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('ls.held_at')}
       GROUP BY ls.module_id, ls.beneficiary_id`, [...T.params, ...R]),
    // Face-to-face sessions they came to in the period, per learner and topic.
    q(`SELECT f.module_id, f.beneficiary_id, COUNT(*) AS n FROM ${FACE_TO_FACE_SQL} f
       JOIN learning_modules lm ON lm.id = f.module_id AND ${T.sql}
       JOIN users b ON b.id = f.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('f.starts_at')}
       GROUP BY f.module_id, f.beneficiary_id`, [...T.params, ...R]),
  ]);
  const faceToFaceByPair = new Map(hoursRows.map((item) => [`${item.moduleId}:${item.beneficiaryId}`, item]));
  const testByPair = new Map();
  testAttempts.forEach((row) => {
    const key = `${row.module_id}:${row.beneficiary_id}`;
    const entry = testByPair.get(key) || { pre: null, post: null };
    entry[row.test_kind] = { score: Number(row.score), total: Number(row.total) };
    testByPair.set(key, entry);
  });
  const skillByPair = new Map();
  skills.forEach((row) => {
    const key = `${row.module_id}:${row.user_id}`;
    const entry = skillByPair.get(key) || { pre: null, post: null };
    // The first pre-test, and the latest post-test (rows come in attempt order).
    if (row.test_kind === 'pre') { if (!entry.pre) entry.pre = { level: Number(row.level), band: row.band }; }
    else entry.post = { level: Number(row.level), band: row.band };
    skillByPair.set(key, entry);
  });
  const topicById = new Map(topics.map((topic) => [Number(topic.id), topic]));
  // What happened in the period, per learner and topic.
  const inPeriod = (date) => Boolean(date) && new Date(date) >= range.from && new Date(date) < range.toExclusive;
  const pairKey = (moduleId, learnerId) => `${Number(moduleId)}:${Number(learnerId)}`;
  const answersInPeriod = new Map(answersInRange.map((row) => [pairKey(row.module_id, row.beneficiary_id), Number(row.n)]));
  const sessionsInPeriod = new Map(sessionsInRange.map((row) => [pairKey(row.module_id, row.beneficiary_id), Number(row.n)]));
  const faceInPeriod = new Map(faceInRange.map((row) => [pairKey(row.module_id, row.beneficiary_id), Number(row.n)]));
  const testsInPeriod = new Map();
  allTests.filter((row) => inPeriod(row.taken_at)).forEach((row) => {
    const key = pairKey(row.module_id, row.beneficiary_id);
    testsInPeriod.set(key, [...new Set([...(testsInPeriod.get(key) || []), row.test_kind])]);
  });
  const progressRows = pairs.filter((pair) => topicById.has(Number(pair.module_id))).map((pair) => {
    const key = `${pair.module_id}:${pair.beneficiary_id}`;
    const hours = faceToFaceByPair.get(key);
    const skill = skillByPair.get(key) || { pre: null, post: null };
    const test = testByPair.get(key) || { pre: null, post: null };
    return {
      learnerId: pair.beneficiary_id,
      learner: pair.learner_name,
      moduleId: pair.module_id,
      topic: topicById.get(Number(pair.module_id)).title,
      phase: topicById.get(Number(pair.module_id)).phase,
      specialist: pair.specialist_name,
      stage: pair.completed_at ? 'completed' : pair.assignment_status === 'pending' ? 'incoming' : 'ongoing',
      // Face-to-face hours so far, of the module's training hours (accepted topics).
      faceToFaceHours: hours ? hours.hoursDone : null,
      hoursNeeded: hours ? hours.hours : null,
      preBand: skill.pre?.band || null,
      preLevel: skill.pre?.level ?? null,
      postBand: skill.post?.band || null,
      postLevel: skill.post?.level ?? null,
      preTest: test.pre,
      postTest: test.post,
      appliedAt: pair.applied_at,
      acceptedAt: pair.assigned_at,
      completedAt: pair.completed_at,
      period: {
        applied: inPeriod(pair.applied_at),
        accepted: inPeriod(pair.assigned_at),
        completed: inPeriod(pair.completed_at),
        answers: answersInPeriod.get(pairKey(pair.module_id, pair.beneficiary_id)) || 0,
        sessions: sessionsInPeriod.get(pairKey(pair.module_id, pair.beneficiary_id)) || 0,
        faceToFace: faceInPeriod.get(pairKey(pair.module_id, pair.beneficiary_id)) || 0,
        tests: testsInPeriod.get(pairKey(pair.module_id, pair.beneficiary_id)) || [],
      },
    };
  // Only learners and topics where something happened in the period.
  }).filter(({ period }) => period.applied || period.accepted || period.completed || period.answers || period.sessions || period.faceToFace || period.tests.length);
  // Per topic, what happened in the period (the Progress chart).
  const progressByTopic = topics.map((topic) => {
    const rows = progressRows.filter((row) => Number(row.moduleId) === Number(topic.id));
    return {
      moduleId: topic.id,
      title: topic.title,
      phase: topic.phase,
      applied: rows.filter((row) => row.period.applied).length,
      accepted: rows.filter((row) => row.period.accepted).length,
      completed: rows.filter((row) => row.period.completed).length,
      preTests: rows.filter((row) => row.period.tests.includes('pre')).length,
      postTests: rows.filter((row) => row.period.tests.includes('post')).length,
    };
  });

  // ---- topic pre-test / post-test taken in the period, as % correct
  const percentOf = (attempt) => (Number(attempt.total) ? Math.round((Number(attempt.score) / Number(attempt.total)) * 100) : 0);
  const averagePercent = (attempts) => (attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + percentOf(attempt), 0) / attempts.length) : null);
  const testsTaken = allTests.filter((row) => inPeriod(row.taken_at) && topicById.has(Number(row.module_id)));
  // Each learner's latest pre-test per topic (any time), to compare with a post-test.
  const preTestOf = new Map();
  allTests.filter((row) => row.test_kind === 'pre').forEach((row) => preTestOf.set(pairKey(row.module_id, row.beneficiary_id), row));
  const summarizeTests = (rows) => {
    const pre = rows.filter((row) => row.test_kind === 'pre');
    const post = rows.filter((row) => row.test_kind === 'post');
    const both = post.map((row) => ({ post: row, pre: preTestOf.get(pairKey(row.module_id, row.beneficiary_id)) })).filter((item) => item.pre);
    return {
      preTaken: pre.length,
      postTaken: post.length,
      preAverage: averagePercent(pre),
      postAverage: averagePercent(post),
      both: both.length,
      bothPreAverage: averagePercent(both.map((item) => item.pre)),
      bothPostAverage: averagePercent(both.map((item) => item.post)),
      improved: both.filter((item) => percentOf(item.post) > percentOf(item.pre)).length,
    };
  };
  const testsByTopic = topics
    .map((topic) => ({ moduleId: topic.id, title: topic.title, phase: topic.phase, ...summarizeTests(testsTaken.filter((row) => Number(row.module_id) === Number(topic.id))) }))
    .filter((row) => row.preTaken || row.postTaken);
  const testAttemptRows = testsTaken.map((row) => ({
    takenAt: row.taken_at, learner: row.learner, topic: row.topic, kind: row.test_kind,
    score: Number(row.score), total: Number(row.total), percent: percentOf(row),
  }));

  // ---- completed engagements, in range
  const [certificateRows, sessionsByTopic, acceptedBySpecialist, sessionsBySpecialist, faceByTopic, faceBySpecialist] = await Promise.all([
    q(`SELECT mc.issued_at, mc.module_id, lm.title AS topic, b.full_name AS learner, b.id AS learner_id,
              issuer.full_name AS specialist, issuer.id AS specialist_id, a.assigned_at
       FROM module_certificates mc
       JOIN learning_modules lm ON lm.id = mc.module_id AND ${T.sql}
       JOIN users b ON b.id = mc.user_id AND ${LEARNERS}
       LEFT JOIN users issuer ON issuer.id = mc.issued_by
       LEFT JOIN elevate_module_assignments a ON a.beneficiary_id = mc.user_id AND a.module_id = mc.module_id
       WHERE ${inRange('mc.issued_at')}
       ORDER BY mc.issued_at DESC`, [...T.params, ...R]),
    q(`SELECT ls.module_id, COUNT(*) AS n FROM learning_sessions ls
       JOIN learning_modules lm ON lm.id = ls.module_id AND ${T.sql}
       JOIN users b ON b.id = ls.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('ls.held_at')} GROUP BY ls.module_id`, [...T.params, ...R]),
    q(`SELECT l.user_id AS id, s.full_name AS name, COUNT(*) AS n FROM user_activity_log l
       JOIN users s ON s.id = l.user_id
       JOIN users b ON b.id = l.target_user_id AND ${LEARNERS}
       JOIN learning_modules lm ON lm.id = l.module_id AND ${T.sql}
       WHERE l.action = 'accepted' AND ${inRange('l.created_at')} GROUP BY l.user_id, s.full_name`, [...T.params, ...R]),
    q(`SELECT ls.specialist_id AS id, s.full_name AS name, COUNT(*) AS n FROM learning_sessions ls
       JOIN users s ON s.id = ls.specialist_id
       JOIN learning_modules lm ON lm.id = ls.module_id AND ${T.sql}
       JOIN users b ON b.id = ls.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('ls.held_at')} GROUP BY ls.specialist_id, s.full_name`, [...T.params, ...R]),
    q(`SELECT f.module_id, COUNT(DISTINCT f.session_id) AS n FROM ${FACE_TO_FACE_SQL} f
       JOIN learning_modules lm ON lm.id = f.module_id AND ${T.sql}
       JOIN users b ON b.id = f.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('f.starts_at')} GROUP BY f.module_id`, [...T.params, ...R]),
    q(`SELECT f.specialist_id AS id, s.full_name AS name, COUNT(DISTINCT f.session_id) AS n FROM ${FACE_TO_FACE_SQL} f
       JOIN users s ON s.id = f.specialist_id
       JOIN learning_modules lm ON lm.id = f.module_id AND ${T.sql}
       JOIN users b ON b.id = f.beneficiary_id AND ${LEARNERS}
       WHERE ${inRange('f.starts_at')} GROUP BY f.specialist_id, s.full_name`, [...T.params, ...R]),
  ]);
  const daysToComplete = (row) => (row.assigned_at ? Math.max(0, Math.round((new Date(row.issued_at) - new Date(row.assigned_at)) / DAY)) : null);
  const certificates = certificateRows.map((row) => ({
    issuedAt: row.issued_at, moduleId: row.module_id, topic: row.topic, learner: row.learner, specialist: row.specialist,
    specialistId: row.specialist_id, daysToComplete: daysToComplete(row),
  }));
  const sessionsHeldByTopic = new Map(sessionsByTopic.map((row) => [Number(row.module_id), Number(row.n)]));
  const faceHeldByTopic = new Map(faceByTopic.map((row) => [Number(row.module_id), Number(row.n)]));
  // Module answers sent in the period, per topic.
  const answersByTopic = new Map();
  answersInRange.forEach((row) => answersByTopic.set(Number(row.module_id), (answersByTopic.get(Number(row.module_id)) || 0) + Number(row.n)));
  const completedByTopic = topics.map((topic) => {
    const rows = certificates.filter((row) => Number(row.moduleId) === Number(topic.id));
    return {
      moduleId: topic.id,
      title: topic.title,
      phase: topic.phase,
      certificates: rows.length,
      answers: answersByTopic.get(Number(topic.id)) || 0,
      sessions: sessionsHeldByTopic.get(Number(topic.id)) || 0,
      faceToFace: faceHeldByTopic.get(Number(topic.id)) || 0,
      averageDays: average(rows.map((row) => row.daysToComplete).filter((value) => value !== null)),
    };
  }).filter((row) => row.certificates || row.sessions || row.faceToFace || row.answers);
  const specialists = new Map();
  const specialistRow = (id, name) => {
    if (!specialists.has(id)) specialists.set(id, { id, name, accepted: 0, certificates: 0, sessions: 0, faceToFace: 0, days: [] });
    return specialists.get(id);
  };
  acceptedBySpecialist.forEach((row) => { specialistRow(Number(row.id), row.name).accepted = Number(row.n); });
  sessionsBySpecialist.forEach((row) => { specialistRow(Number(row.id), row.name).sessions = Number(row.n); });
  faceBySpecialist.forEach((row) => { specialistRow(Number(row.id), row.name).faceToFace = Number(row.n); });
  certificates.forEach((row) => {
    if (!row.specialistId) return;
    const entry = specialistRow(Number(row.specialistId), row.specialist);
    entry.certificates += 1;
    if (row.daysToComplete !== null) entry.days.push(row.daysToComplete);
  });
  const completedBySpecialist = [...specialists.values()]
    .map(({ days, ...row }) => ({ ...row, averageDays: average(days) }))
    .sort((a, b) => b.certificates - a.certificates || b.sessions - a.sessions || a.name.localeCompare(b.name));

  // ---- filter choices
  const phaseRows = await q(`SELECT lm.id, lm.title, lm.phase FROM learning_modules lm
     WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND ${offeredOrInUseSql('lm')} ORDER BY lm.sort_order, lm.id`, []);

  res.json({
    success: true,
    data: {
      range: { from: isoDay(range.from), to: isoDay(range.to) },
      filters,
      options: {
        phases: [...new Set(phaseRows.map((row) => row.phase))],
        topics: phaseRows.map((row) => ({ id: row.id, title: row.title, phase: row.phase })),
      },
      summary: {
        // Same definition as the table and the "who took part" breakdown.
        activeLearners: activeRows.length,
        activeSpecialists: Number(activeSpecialists.n),
        newLearners: Number(newLearners.n),
        logins: total(loginsDaily),
        messages: total(messagesDaily),
        activitiesAnswered: total(answersDaily),
        applications: total(appliedDaily),
        accepted: total(acceptedDaily),
        certificates: total(certificatesDaily),
        onlineSessions: total(sessionsDaily),
        faceToFaceHeld: total(faceToFaceDaily),
        faceToFaceAttendance: total(attendanceDaily),
      },
      participation: {
        trend: toSeries(range, {
          logins: loginsDaily, messages: messagesDaily, activities: answersDaily,
          sessions: sessionsDaily, faceToFace: attendanceDaily, certificates: certificatesDaily,
        }),
        learners: participationRows,
        demographics,
      },
      progress: {
        byTopic: progressByTopic,
        learners: progressRows,
        tests: { ...summarizeTests(testsTaken), byTopic: testsByTopic, attempts: testAttemptRows },
      },
      completed: {
        trend: toSeries(range, { certificates: certificatesDaily, sessions: sessionsDaily, faceToFace: faceToFaceDaily, applications: appliedDaily, accepted: acceptedDaily }),
        byTopic: completedByTopic,
        bySpecialist: completedBySpecialist,
        certificates,
      },
    },
  });
}

module.exports = { listActivity, getReport, ACTIONS };
