const { pool } = require('../config/db');
const { offeredOrInUseSql } = require('./programPhases');

// Learner pipeline analytics (project-advisor recommendation). Every
// learner-topic application is in exactly one status:
//   incoming  - the learner applied; waiting for the specialist to accept
//   ongoing   - the specialist accepted; the learner is doing the topic
//   completed - the specialist marked the learner as finished (certificate)
const STATUSES = ['incoming', 'ongoing', 'completed'];
const TREND_WEEKS = 8;

async function loadPairs({ specialistId = null, specialistIds = null, beneficiaryId = null } = {}) {
  const params = [];
  let filter = '';
  if (specialistId) {
    filter += ' AND a.specialist_id = ?';
    params.push(specialistId);
  }
  if (specialistIds) {
    if (!specialistIds.length) return [];
    filter += ' AND a.specialist_id IN (?)';
    params.push(specialistIds);
  }
  if (beneficiaryId) {
    filter += ' AND a.beneficiary_id = ?';
    params.push(beneficiaryId);
  }
  // assigned_at here is when the pair started: the application date (or the
  // acceptance date for matches made before applications existed).
  const [rows] = await pool.query(
    `SELECT a.beneficiary_id, a.module_id, a.specialist_id, a.assignment_status,
            COALESCE(a.applied_at, a.assigned_at) AS assigned_at,
            lm.title AS module_title, lm.phase, lm.sort_order,
            specialist.full_name AS specialist_name, learner.full_name AS learner_name,
            cert.issued_at AS completed_at
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id AND lm.is_elevate_program = 1 AND lm.approval_status = 'approved'
     JOIN users specialist ON specialist.id = a.specialist_id
     JOIN users learner ON learner.id = a.beneficiary_id AND learner.status = 'active'
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
     WHERE a.assignment_status IN ('pending', 'assigned') ${filter}`,
    params
  );
  return rows.map((row) => ({
    ...row,
    status: row.completed_at ? 'completed' : row.assignment_status === 'pending' ? 'incoming' : 'ongoing',
  }));
}

function emptyCounts() {
  return { incoming: 0, ongoing: 0, completed: 0 };
}

function countByStatus(pairs) {
  const counts = emptyCounts();
  pairs.forEach((pair) => { counts[pair.status] += 1; });
  return counts;
}

// The last TREND_WEEKS weeks, Monday to Sunday, oldest first.
function weekBuckets(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: TREND_WEEKS }, (_, index) => {
    const start = new Date(monday);
    start.setDate(start.getDate() - (TREND_WEEKS - 1 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  });
}

function toDate(value) {
  return value ? new Date(String(value).replace(' ', 'T')) : null;
}

function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// New matches and completions per week.
function weeklyTrend(pairs, buckets = weekBuckets()) {
  return buckets.map(({ start, end }) => {
    const inWeek = (value) => {
      const date = toDate(value);
      return date && date >= start && date < end;
    };
    return {
      weekStart: isoDay(start),
      newMatches: pairs.filter((pair) => inWeek(pair.assigned_at)).length,
      completed: pairs.filter((pair) => inWeek(pair.completed_at)).length,
    };
  });
}

async function loadTopics() {
  const [rows] = await pool.query(
    `SELECT id, title, phase, sort_order FROM learning_modules
     WHERE is_elevate_program = 1 AND approval_status = 'approved' AND ${offeredOrInUseSql('learning_modules')}
     ORDER BY sort_order, id`
  );
  return rows;
}

function byTopic(topics, pairs) {
  return topics.map((topic) => {
    const forTopic = pairs.filter((pair) => Number(pair.module_id) === Number(topic.id));
    return { moduleId: topic.id, title: topic.title, phase: topic.phase, ...countByStatus(forTopic) };
  });
}

// A specialist's own pipeline: totals, per topic they teach, and weekly trend.
async function specialistAnalytics(specialistId) {
  const pairs = await loadPairs({ specialistId });
  const [taught] = await pool.query(
    `SELECT DISTINCT lm.id, lm.title, lm.phase, lm.sort_order
     FROM user_skills us
     JOIN module_skills ms ON ms.skill_id = us.skill_id AND ms.is_primary = 1
     JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1 AND lm.approval_status = 'approved'
     WHERE us.user_id = ? AND us.relation_type = 'teaches'
     ORDER BY lm.sort_order, lm.id`,
    [specialistId]
  );
  const topicIds = new Set(taught.map((topic) => Number(topic.id)));
  // Keep topics the specialist still has learners in, even if they stopped teaching it.
  const extra = [...new Map(pairs.filter((pair) => !topicIds.has(Number(pair.module_id)))
    .map((pair) => [pair.module_id, { id: pair.module_id, title: pair.module_title, phase: pair.phase, sort_order: pair.sort_order }])).values()];
  return {
    summary: countByStatus(pairs),
    byTopic: byTopic([...taught, ...extra].sort((a, b) => a.sort_order - b.sort_order), pairs),
    trend: weeklyTrend(pairs),
  };
}

// Program-wide: totals, every topic, and every specialist with their trend.
async function programAnalytics() {
  const [pairs, topics] = await Promise.all([loadPairs(), loadTopics()]);
  const [specialists] = await pool.query(
    `SELECT id, full_name FROM users WHERE user_type = 'specialist' AND status = 'active' ORDER BY full_name`
  );
  const buckets = weekBuckets();
  return {
    summary: countByStatus(pairs),
    byTopic: byTopic(topics, pairs),
    trend: weeklyTrend(pairs, buckets),
    specialists: specialists.map((specialist) => {
      const own = pairs.filter((pair) => Number(pair.specialist_id) === Number(specialist.id));
      return {
        id: specialist.id,
        name: specialist.full_name,
        ...countByStatus(own),
        trend: weeklyTrend(own, buckets),
      };
    }),
  };
}

module.exports = { STATUSES, loadPairs, countByStatus, weeklyTrend, specialistAnalytics, programAnalytics };
