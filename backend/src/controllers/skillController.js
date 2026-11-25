const { pool } = require('../config/db');
const {
  recomputeElevateAssignments,
  recomputeAssignmentsForSpecialist,
} = require('../services/elevateAssignmentService');
const { PROFICIENCY_LEVELS, LEARNER_LEVELS, parseList } = require('../lib/elevateTeachingFit');
const { offeredSql, loadPhases } = require('../lib/programPhases');

const MAX_CERTIFICATIONS = 8;
const MAX_CERTIFICATION_LENGTH = 100;

async function searchSkills(req, res) {
  const q = (req.query.q || '').trim();
  const params = [];
  let sql = `SELECT s.id, s.name, s.slug, s.category_id, c.name AS category
             FROM skills s JOIN skill_categories c ON c.id = s.category_id
             WHERE s.is_approved = 1`;
  if (q) {
    sql += ' AND (s.name LIKE ? OR MATCH(s.name) AGAINST (? IN NATURAL LANGUAGE MODE))';
    params.push(`%${q}%`, q);
  }
  sql += ' ORDER BY s.name LIMIT 50';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, data: rows });
}

// ELEVATE training-design topics: one approved module and one skill each.
async function findElevateTopics(connection = pool) {
  const [rows] = await connection.query(
    `SELECT s.id AS skill_id, s.name AS skill_name, lm.id AS module_id, lm.slug, lm.title,
            lm.phase, lm.hours, lm.description
     FROM learning_modules lm
     JOIN module_skills ms ON ms.module_id = lm.id AND ms.is_primary = 1
     JOIN skills s ON s.id = ms.skill_id AND s.is_approved = 1
     WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND ${offeredSql('lm')}
     ORDER BY lm.sort_order, lm.id`
  );
  return rows;
}

function parseSkillIdList(skillIds) {
  if (!Array.isArray(skillIds) || skillIds.length > 50
    || skillIds.some((id) => !['number', 'string'].includes(typeof id)
      || !/^\d+$/.test(String(id)) || !Number.isInteger(Number(id)) || Number(id) < 1)
    || new Set(skillIds.map(Number)).size !== skillIds.length) {
    return null;
  }
  return skillIds.map(Number);
}

async function listElevateTopics(req, res) {
  const [topics, phases] = await Promise.all([findElevateTopics(), loadPhases()]);
  res.json({
    success: true,
    // Every phase, including new ones without modules yet, for the phase dropdown.
    phases,
    data: topics.map((topic) => ({
      skillId: topic.skill_id,
      moduleId: topic.module_id,
      slug: topic.slug,
      title: topic.title,
      phase: topic.phase,
      hours: topic.hours,
      description: topic.description,
    })),
  });
}

async function listMySkills(req, res) {
  const [rows] = await pool.query(
    `SELECT us.id, us.relation_type, us.proficiency, us.years_experience, us.description,
            us.learning_status, us.status_reason, us.learner_levels, us.max_learners,
            us.certifications, us.elevate_phases_taught,
            s.id AS skill_id, s.name AS skill_name, c.name AS category
     FROM user_skills us JOIN skills s ON s.id = us.skill_id
     JOIN skill_categories c ON c.id = s.category_id
     WHERE us.user_id = ?`,
    [req.user.id]
  );
  res.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      learner_levels: parseList(row.learner_levels),
      certifications: parseList(row.certifications),
      elevate_phases_taught: parseList(row.elevate_phases_taught),
    })),
  });
}

function validateTeachingDetail(input) {
  const detail = input || {};
  const skillId = Number(detail.skillId);
  if (!Number.isInteger(skillId) || skillId < 1) return { error: 'Choose a topic you teach.' };

  const proficiency = detail.proficiency || null;
  if (proficiency && !PROFICIENCY_LEVELS.includes(proficiency)) return { error: 'Choose a valid level for each topic.' };

  const rawYears = detail.yearsExperience;
  const years = rawYears === undefined || rawYears === null || rawYears === '' ? null : Number(rawYears);
  if (years !== null && (!Number.isFinite(years) || years < 0 || years > 60)) {
    return { error: 'Years of experience must be from 0 to 60.' };
  }

  const certifications = detail.certifications === undefined ? [] : detail.certifications;
  if (!Array.isArray(certifications) || certifications.length > MAX_CERTIFICATIONS
    || certifications.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > MAX_CERTIFICATION_LENGTH)) {
    return { error: `List up to ${MAX_CERTIFICATIONS} certifications, each up to ${MAX_CERTIFICATION_LENGTH} characters.` };
  }

  const learnerLevels = detail.learnerLevels === undefined ? [] : detail.learnerLevels;
  if (!Array.isArray(learnerLevels) || learnerLevels.some((level) => !LEARNER_LEVELS.includes(level))) {
    return { error: 'Choose beginners, developing learners, or both.' };
  }

  const phases = detail.phasesTaught === undefined ? [] : detail.phasesTaught;
  if (!Array.isArray(phases) || phases.some((phase) => !Number.isInteger(phase) || phase < 1 || phase > 4)) {
    return { error: 'Choose ELEVATE phases from Phase 1 to Phase 4.' };
  }

  const rawLimit = detail.maxLearners;
  const maxLearners = rawLimit === undefined || rawLimit === null || rawLimit === '' ? null : Number(rawLimit);
  if (maxLearners !== null && (!Number.isInteger(maxLearners) || maxLearners < 1 || maxLearners > 500)) {
    return { error: 'The learner limit must be a whole number from 1 to 500.' };
  }

  return {
    value: {
      skillId,
      proficiency,
      years: years === null ? null : Math.round(years * 10) / 10,
      certifications: [...new Set(certifications.map((item) => item.trim()))],
      // Both levels (or none) means the specialist takes any learner.
      learnerLevels: LEARNER_LEVELS.filter((level) => learnerLevels.includes(level)),
      phases: [...new Set(phases)].sort(),
      maxLearners,
    },
  };
}

// Skill-check Part D: per topic a specialist teaches, their level, the learner
// levels they take, a learner limit, certifications and earlier ELEVATE phases.
async function updateTeachingDetails(req, res) {
  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'specialist') {
    return res.status(403).json({ success: false, message: 'Only specialists can describe their teaching topics' });
  }
  const topics = req.body?.topics;
  if (!Array.isArray(topics) || !topics.length || topics.length > 50) {
    return res.status(400).json({ success: false, message: 'Submit the details for your teaching topics' });
  }
  const details = [];
  for (const topic of topics) {
    const { value, error } = validateTeachingDetail(topic);
    if (error) return res.status(400).json({ success: false, message: error });
    details.push(value);
  }
  if (new Set(details.map((detail) => detail.skillId)).size !== details.length) {
    return res.status(400).json({ success: false, message: 'Each topic can be listed once' });
  }

  const [teachingRows] = await pool.query(
    "SELECT skill_id FROM user_skills WHERE user_id = ? AND relation_type = 'teaches'",
    [req.user.id]
  );
  const taught = new Set(teachingRows.map((row) => Number(row.skill_id)));
  if (details.some((detail) => !taught.has(detail.skillId))) {
    return res.status(400).json({ success: false, message: 'Save the topic as one you teach first' });
  }

  for (const detail of details) {
    await pool.query(
      `UPDATE user_skills
       SET proficiency = ?, years_experience = ?, certifications = ?, learner_levels = ?,
           elevate_phases_taught = ?, max_learners = ?
       WHERE user_id = ? AND skill_id = ? AND relation_type = 'teaches'`,
      [
        detail.proficiency,
        detail.years,
        detail.certifications.length ? JSON.stringify(detail.certifications) : null,
        detail.learnerLevels.length === 1 ? JSON.stringify(detail.learnerLevels) : null,
        detail.phases.length ? JSON.stringify(detail.phases) : null,
        detail.maxLearners,
        req.user.id,
        detail.skillId,
      ]
    );
  }
  await recomputeAssignmentsForSpecialist();
  res.json({ success: true, message: 'Teaching details saved' });
}

async function addSkillToProfile(req, res) {
  const { skillId, relationType, proficiency, yearsExperience, description } = req.body;

  if (!['teaches', 'wants_to_learn'].includes(relationType)) {
    return res.status(400).json({ success: false, message: 'Invalid relationType' });
  }
  if (!Number.isInteger(Number(skillId)) || Number(skillId) < 1) {
    return res.status(400).json({ success: false, message: 'Choose a predefined skill' });
  }

  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (!users[0]) return res.status(403).json({ success: false, message: 'Active account required' });
  if (users[0].user_type === 'beneficiary' && relationType !== 'wants_to_learn') {
    return res.status(403).json({ success: false, message: 'Students can only add skills they want to learn' });
  }
  const [approvedSkills] = await pool.query('SELECT id FROM skills WHERE id = ? AND is_approved = 1', [Number(skillId)]);
  if (!approvedSkills[0]) return res.status(400).json({ success: false, message: 'Choose an approved predefined skill' });

  await pool.query(
    `INSERT INTO user_skills (user_id, skill_id, relation_type, proficiency, years_experience, description)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE proficiency = VALUES(proficiency),
       years_experience = VALUES(years_experience), description = VALUES(description)`,
    [req.user.id, skillId, relationType, proficiency || null, yearsExperience || null, description || null]
  );
  if (users[0].user_type === 'specialist' && relationType === 'teaches') {
    await recomputeAssignmentsForSpecialist(req.user.id);
  }

  res.status(201).json({ success: true, message: 'Skill added to profile' });
}

async function replaceLearningGoals(req, res) {
  const normalizedSkillIds = parseSkillIdList(req.body?.skillIds);
  if (!normalizedSkillIds) {
    return res.status(400).json({ success: false, message: 'Submit a valid list of ELEVATE topics' });
  }

  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'beneficiary') {
    return res.status(403).json({ success: false, message: 'Only beneficiaries can submit learning goals' });
  }

  const topicSkillIds = new Set((await findElevateTopics()).map((topic) => Number(topic.skill_id)));
  if (normalizedSkillIds.some((skillId) => !topicSkillIds.has(skillId))) {
    return res.status(400).json({ success: false, message: 'Choose topics from the ELEVATE training design' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "DELETE FROM user_skills WHERE user_id = ? AND relation_type = 'wants_to_learn'",
      [req.user.id]
    );
    for (const skillId of normalizedSkillIds) {
      await connection.query(
        `INSERT INTO user_skills (user_id, skill_id, relation_type)
         VALUES (?, ?, 'wants_to_learn')`,
        [req.user.id, skillId]
      );
    }
    await recomputeElevateAssignments(req.user.id, connection);
    await connection.commit();
    res.json({ success: true, message: 'Learning goals saved', data: { skillIds: normalizedSkillIds } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Specialists register which training-design topics they can teach, like the
// resource persons listed in the ELEVATE training design.
async function replaceTeachingTopics(req, res) {
  const normalizedSkillIds = parseSkillIdList(req.body?.skillIds);
  if (!normalizedSkillIds) {
    return res.status(400).json({ success: false, message: 'Submit a valid list of ELEVATE topics' });
  }

  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'specialist') {
    return res.status(403).json({ success: false, message: 'Only specialists can register teaching topics' });
  }

  const topicSkillIds = [...new Set((await findElevateTopics()).map((topic) => Number(topic.skill_id)))];
  if (normalizedSkillIds.some((skillId) => !topicSkillIds.includes(skillId))) {
    return res.status(400).json({ success: false, message: 'Choose topics from the ELEVATE training design' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const removedSkillIds = topicSkillIds.filter((skillId) => !normalizedSkillIds.includes(skillId));
    if (removedSkillIds.length) {
      await connection.query(
        "DELETE FROM user_skills WHERE user_id = ? AND relation_type = 'teaches' AND skill_id IN (?)",
        [req.user.id, removedSkillIds]
      );
    }
    for (const skillId of normalizedSkillIds) {
      await connection.query(
        `INSERT IGNORE INTO user_skills (user_id, skill_id, relation_type)
         VALUES (?, ?, 'teaches')`,
        [req.user.id, skillId]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  await recomputeAssignmentsForSpecialist(req.user.id);
  res.json({ success: true, message: 'Teaching topics saved', data: { skillIds: normalizedSkillIds } });
}

async function removeSkillFromProfile(req, res) {
  await pool.query('DELETE FROM user_skills WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.user.id,
  ]);
  const [users] = await pool.query('SELECT user_type FROM users WHERE id = ?', [req.user.id]);
  if (users[0]?.user_type === 'specialist') {
    await recomputeAssignmentsForSpecialist(req.user.id);
  } else if (users[0]?.user_type === 'beneficiary') {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await recomputeElevateAssignments(req.user.id, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  res.json({ success: true, message: 'Skill removed' });
}

module.exports = {
  searchSkills,
  listElevateTopics,
  listMySkills,
  addSkillToProfile,
  replaceLearningGoals,
  replaceTeachingTopics,
  updateTeachingDetails,
  removeSkillFromProfile,
};
