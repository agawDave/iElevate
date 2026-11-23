const { pool } = require('../config/db');

// The admin's overview: the program's numbers, how far beneficiaries got,
// the pre/post-test gains and the latest activity.

const PEOPLE = "role NOT IN ('admin', 'moderator')";
// Activity worth showing on the overview (logins and messages are too many).
const QUIET_ACTIONS = ['login', 'message_sent'];

async function adminOverview(req, res) {
  const q = async (sql, params = []) => (await pool.query(sql, params))[0];
  const [[counts], [gains], recent] = await Promise.all([
    q(`SELECT
         (SELECT COUNT(*) FROM users WHERE user_type = 'beneficiary' AND ${PEOPLE}) AS beneficiaries,
         (SELECT COUNT(*) FROM users WHERE user_type = 'specialist' AND ${PEOPLE}) AS specialists,
         (SELECT COUNT(*) FROM users u WHERE u.user_type = 'beneficiary' AND u.${PEOPLE}
            AND EXISTS (SELECT 1 FROM elevate_skill_assessments sa WHERE sa.user_id = u.id)) AS skill_checked,
         (SELECT COUNT(DISTINCT a.beneficiary_id) FROM elevate_module_assignments a JOIN users u ON u.id = a.beneficiary_id AND u.${PEOPLE}
            WHERE a.assignment_status IN ('pending', 'assigned')) AS applied,
         (SELECT COUNT(DISTINCT a.beneficiary_id) FROM elevate_module_assignments a JOIN users u ON u.id = a.beneficiary_id AND u.${PEOPLE}
            WHERE a.assignment_status = 'assigned') AS accepted,
         (SELECT COUNT(DISTINCT c.user_id) FROM module_certificates c JOIN users u ON u.id = c.user_id AND u.${PEOPLE}) AS completed_people,
         (SELECT COUNT(*) FROM module_certificates c JOIN users u ON u.id = c.user_id AND u.${PEOPLE}) AS certificates,
         (SELECT COALESCE(SUM(lm.hours), 0) FROM module_certificates c JOIN users u ON u.id = c.user_id AND u.${PEOPLE}
            JOIN learning_modules lm ON lm.id = c.module_id) AS hours_completed,
         (SELECT COUNT(*) FROM elevate_module_assignments a JOIN users u ON u.id = a.beneficiary_id AND u.${PEOPLE}
            LEFT JOIN module_certificates c ON c.user_id = a.beneficiary_id AND c.module_id = a.module_id
            WHERE a.assignment_status = 'assigned' AND c.id IS NULL) AS in_progress`),
    // Pre-test vs post-test, for every topic where a learner took both.
    q(`SELECT COUNT(*) AS topics, COUNT(DISTINCT pre.beneficiary_id) AS learners,
              AVG(pre.score / pre.total) AS pre, AVG(post.score / post.total) AS post
       FROM module_test_attempts pre
       JOIN module_test_attempts post ON post.beneficiary_id = pre.beneficiary_id AND post.module_id = pre.module_id
        AND post.specialist_id = pre.specialist_id AND post.test_kind = 'post' AND post.total > 0
       JOIN users u ON u.id = pre.beneficiary_id AND u.${PEOPLE}
       WHERE pre.test_kind = 'pre' AND pre.total > 0`),
    q(`SELECT l.id, l.action, l.details, l.created_at, u.full_name AS user_name, u.user_type,
              t.full_name AS target_name, lm.title AS module_title
       FROM user_activity_log l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN users t ON t.id = l.target_user_id
       LEFT JOIN learning_modules lm ON lm.id = l.module_id
       WHERE l.action NOT IN (?)
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT 6`, [QUIET_ACTIONS]),
  ]);
  const n = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value) || 0]));
  const gainTopics = Number(gains?.topics) || 0;

  res.json({
    success: true,
    data: {
      summary: {
        beneficiaries: n.beneficiaries,
        specialists: n.specialists,
        inProgress: n.in_progress,
        certificates: n.certificates,
        hoursCompleted: n.hours_completed,
      },
      // How far beneficiaries got (each one counted once, at every step they reached).
      funnel: [
        { key: 'joined', label: 'Signed up', value: n.beneficiaries },
        { key: 'skillCheck', label: 'Took the pre-assessment', value: n.skill_checked },
        { key: 'applied', label: 'Applied to a topic', value: n.applied },
        { key: 'accepted', label: 'Accepted by a specialist', value: n.accepted },
        { key: 'completed', label: 'Completed a topic', value: n.completed_people },
      ],
      gains: gainTopics ? {
        topics: gainTopics,
        learners: Number(gains.learners) || 0,
        pre: Math.round(Number(gains.pre) * 100),
        post: Math.round(Number(gains.post) * 100),
      } : null,
      recent: recent.map((row) => ({
        id: row.id,
        action: row.action,
        details: row.details,
        at: row.created_at,
        who: row.user_name,
        whoType: row.user_type,
        with: row.target_name,
        topic: row.module_title,
      })),
    },
  });
}

module.exports = { adminOverview };
