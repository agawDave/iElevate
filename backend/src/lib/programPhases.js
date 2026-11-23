// The ELEVATE training design by phase (table program_phases). Each phase has a
// number, a name and the year it was created, and holds the modules made for
// it (learning_modules.phase = "ELEVATE Phase N"). Every visible module of
// every phase is offered: the pre-assessment asks about it, beneficiaries are
// matched for it and specialists can pick it. The admin hides a module to retire it.
const { pool } = require('../config/db');

const phaseLabel = (number) => `ELEVATE Phase ${number}`;
const phaseNumber = (phase) => Number(String(phase || '').match(/\d+/)?.[0]) || null;

// SQL condition: the learning_modules row `alias` is offered (not hidden).
function offeredSql(alias) {
  return `${alias}.is_hidden = 0`;
}

// Offered, or still in use (someone applied, is learning or finished it), so
// lists and reports keep topics people are part of.
function offeredOrInUseSql(alias) {
  return `(${alias}.is_hidden = 0 OR EXISTS (SELECT 1 FROM elevate_module_assignments in_use WHERE in_use.module_id = ${alias}.id))`;
}

function parseGoals(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((goal) => typeof goal === 'string') : [];
  } catch {
    return [];
  }
}

async function loadPhases(connection = pool) {
  const [rows] = await connection.query('SELECT number, name, year FROM program_phases ORDER BY number');
  return rows.map((row) => ({ number: Number(row.number), name: row.name, year: row.year === null ? null : Number(row.year) }));
}

// The offered modules as the pre-assessment uses them, in the training design's order:
// { code, moduleId, slug, title, phase, skillId, task, goals, needs, computerBased, foundation, note }.
async function loadProgramTopics(connection = pool) {
  const [rows] = await connection.query(
    `SELECT lm.id, lm.slug, lm.title, lm.phase, lm.task, lm.goal_tracks, lm.uses_computer,
            lm.recommend_as_foundation, lm.learner_note, s.id AS skill_id
     FROM learning_modules lm
     JOIN module_skills ms ON ms.module_id = lm.id AND ms.is_primary = 1
     JOIN skills s ON s.id = ms.skill_id AND s.is_approved = 1
     WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND lm.is_hidden = 0
       AND lm.task IS NOT NULL AND lm.task <> ''
     ORDER BY lm.sort_order, lm.id`
  );
  const ids = rows.map((row) => row.id);
  const [needRows] = ids.length
    ? await connection.query('SELECT module_id, prerequisite_id FROM module_prerequisites WHERE module_id IN (?)', [ids])
    : [[]];
  const slugById = new Map(rows.map((row) => [Number(row.id), row.slug]));
  return rows.map((row, index) => ({
    code: `T${index + 1}`,
    moduleId: Number(row.id),
    slug: row.slug,
    title: row.title,
    phase: row.phase,
    skillId: Number(row.skill_id),
    task: row.task,
    goals: parseGoals(row.goal_tracks),
    // Prerequisites that are hidden don't hold anything back.
    needs: needRows.filter((need) => Number(need.module_id) === Number(row.id))
      .map((need) => slugById.get(Number(need.prerequisite_id))).filter(Boolean),
    computerBased: Boolean(row.uses_computer),
    foundation: Boolean(row.recommend_as_foundation),
    note: row.learner_note || null,
  }));
}

// Every module's prerequisites by slug, for starting next-up topics.
async function loadPrerequisiteSlugs(connection = pool) {
  const [rows] = await connection.query(
    `SELECT m.slug AS module_slug, p.slug AS prerequisite_slug
     FROM module_prerequisites mp
     JOIN learning_modules m ON m.id = mp.module_id
     JOIN learning_modules p ON p.id = mp.prerequisite_id`
  );
  const bySlug = new Map();
  rows.forEach((row) => bySlug.set(row.module_slug, [...(bySlug.get(row.module_slug) || []), row.prerequisite_slug]));
  return bySlug;
}

module.exports = { phaseLabel, phaseNumber, offeredSql, offeredOrInUseSql, parseGoals, loadPhases, loadProgramTopics, loadPrerequisiteSlugs };
