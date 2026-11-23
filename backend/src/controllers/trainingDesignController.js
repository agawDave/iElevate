const { pool } = require('../config/db');
const { logActivity } = require('../lib/activityLog');
const { phaseLabel, phaseNumber, parseGoals, loadPhases } = require('../lib/programPhases');
const { GOAL_VALUES } = require('../lib/elevateSkillCheck');
const { recomputeAssignmentsForSpecialist } = require('../services/elevateAssignmentService');

// The admin (project leader) manages the ELEVATE training design by phase:
// each phase has a name and the year it was created, and holds the modules made
// for it. Every visible module of every phase is offered to beneficiaries (the
// pre-assessment asks its task) and can be picked by specialists, who then make
// their own module for it.

const MAX = { title: 190, description: 500, task: 200, note: 255, name: 120 };

// Everything that ties a module (lm) to people besides learners: a specialist made a
// module, activities, materials or test questions for it, a certificate was issued,
// or beneficiaries were assessed on it. Deleting the module would delete all of that.
const OTHER_USE_SQL = `(
  (SELECT COUNT(*) FROM specialist_modules sm WHERE sm.topic_id = lm.id)
  + (SELECT COUNT(*) FROM module_certificates mc WHERE mc.module_id = lm.id)
  + (SELECT COUNT(*) FROM module_activities ma WHERE ma.module_id = lm.id)
  + (SELECT COUNT(*) FROM module_resources mr WHERE mr.module_id = lm.id AND mr.uploaded_by IS NOT NULL)
  + (SELECT COUNT(*) FROM module_test_questions mq WHERE mq.module_id = lm.id)
  + (SELECT COUNT(*) FROM elevate_skill_assessments sa JOIN module_skills used_ms ON used_ms.skill_id = sa.skill_id AND used_ms.module_id = lm.id)
)`;
const LEARNERS_SQL = `(SELECT COUNT(DISTINCT a.beneficiary_id) FROM elevate_module_assignments a
  WHERE a.module_id = lm.id AND a.assignment_status IN ('pending', 'assigned'))`;
// The training design's modules (not the old per-phase placeholder rows).
const DESIGN_MODULE = "lm.is_elevate_program = 1 AND lm.approval_status = 'approved'";

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

// What's offered changed: bring every beneficiary's matches up to date
// afterwards, without making the admin wait.
function rematchEveryone() {
  recomputeAssignmentsForSpecialist().catch((error) => console.error('Re-matching after a training design change failed:', error.message));
}

function slugify(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 150) || 'module';
}

function readYear(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: 'Enter a year from 2000 to 2100, or leave it empty.' };
  return { value: year };
}

// ------------------------------------------------------------------ reading

async function getTrainingDesign(req, res) {
  const phases = await loadPhases();
  const [moduleRows] = await pool.query(
    `SELECT lm.id, lm.slug, lm.title, lm.phase, lm.hours, lm.description, lm.task, lm.goal_tracks, lm.uses_computer,
            lm.recommend_as_foundation, lm.learner_note, lm.is_hidden, ${LEARNERS_SQL} AS learners, ${OTHER_USE_SQL} AS other_use
     FROM learning_modules lm
     WHERE ${DESIGN_MODULE}
     ORDER BY lm.sort_order, lm.id`
  );
  const [needRows] = await pool.query('SELECT module_id, prerequisite_id FROM module_prerequisites');
  const modules = moduleRows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    phase: phaseNumber(row.phase),
    hours: Number(row.hours),
    description: row.description || '',
    task: row.task || '',
    goals: parseGoals(row.goal_tracks),
    needs: needRows.filter((need) => Number(need.module_id) === Number(row.id)).map((need) => Number(need.prerequisite_id)),
    usesComputer: Boolean(row.uses_computer),
    foundation: Boolean(row.recommend_as_foundation),
    note: row.learner_note || '',
    hidden: Boolean(row.is_hidden),
    learners: Number(row.learners),
    inUse: Number(row.learners) > 0 || Number(row.other_use) > 0,
  }));
  res.json({
    success: true,
    data: {
      goals: GOAL_VALUES,
      phases: phases.map((phase) => ({ ...phase, modules: modules.filter((module) => module.phase === phase.number) })),
    },
  });
}

// ------------------------------------------------------------------ phases

async function phaseCategory(connection, number, name) {
  const slug = `elevate-phase-${number}-topics`;
  const [[category]] = await connection.query('SELECT id FROM skill_categories WHERE slug = ?', [slug]);
  if (category) {
    await connection.query('UPDATE skill_categories SET name = ? WHERE id = ?', [`ELEVATE Phase ${number}: ${name}`, category.id]);
    return Number(category.id);
  }
  const [insert] = await connection.query('INSERT INTO skill_categories (name, slug) VALUES (?, ?)', [`ELEVATE Phase ${number}: ${name}`, slug]);
  return insert.insertId;
}

// A new phase gets the next number (Phase 5 after Phase 4).
async function addPhase(req, res) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || name.length > MAX.name) return res.status(400).json({ success: false, message: `Give the phase a name (3 to ${MAX.name} characters).` });
  const year = readYear(req.body?.year);
  if (year.error) return res.status(400).json({ success: false, message: year.error });
  const result = await withTransaction(async (connection) => {
    const [[row]] = await connection.query('SELECT COALESCE(MAX(number), 0) AS last FROM program_phases FOR UPDATE');
    const number = Number(row.last) + 1;
    if (number > 99) return { refuse: 400, message: 'The training design can have up to 99 phases.' };
    await connection.query('INSERT INTO program_phases (number, name, year, created_by) VALUES (?, ?, ?, ?)', [number, name, year.value, req.user.id]);
    await phaseCategory(connection, number, name);
    return { number };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'training_design', details: `Added Phase ${result.number} · ${name}` });
  res.status(201).json({ success: true, message: `Phase ${result.number} · ${name} added. Add its modules next.`, data: { number: result.number } });
}

async function updatePhase(req, res) {
  const number = Number(req.params.number);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || name.length > MAX.name) return res.status(400).json({ success: false, message: `Give the phase a name (3 to ${MAX.name} characters).` });
  const year = readYear(req.body?.year);
  if (year.error) return res.status(400).json({ success: false, message: year.error });
  const result = await withTransaction(async (connection) => {
    const [update] = await connection.query('UPDATE program_phases SET name = ?, year = ? WHERE number = ?', [name, year.value, number]);
    if (!update.affectedRows) return { refuse: 404, message: 'That phase was not found.' };
    await phaseCategory(connection, number, name);
    return { ok: true };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'training_design', details: `Edited Phase ${number} · ${name}${year.value ? ` (${year.value})` : ''}` });
  res.json({ success: true, message: `Phase ${number} saved.` });
}

// Only an empty phase can be deleted.
async function deletePhase(req, res) {
  const number = Number(req.params.number);
  const result = await withTransaction(async (connection) => {
    const [[phase]] = await connection.query('SELECT name FROM program_phases WHERE number = ? FOR UPDATE', [number]);
    if (!phase) return { refuse: 404, message: 'That phase was not found.' };
    const [[used]] = await connection.query(`SELECT COUNT(*) AS n FROM learning_modules lm WHERE ${DESIGN_MODULE} AND lm.phase = ?`, [phaseLabel(number)]);
    if (Number(used.n)) return { refuse: 409, message: `Phase ${number} still has modules. Move or delete them first.` };
    await connection.query('DELETE FROM program_phases WHERE number = ?', [number]);
    await connection.query(
      `DELETE sc FROM skill_categories sc WHERE sc.slug = ? AND NOT EXISTS (SELECT 1 FROM skills s WHERE s.category_id = sc.id)`,
      [`elevate-phase-${number}-topics`]
    );
    return { name: phase.name };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'training_design', details: `Deleted Phase ${number} · ${result.name}` });
  res.json({ success: true, message: `Phase ${number} deleted.` });
}

// ----------------------------------------------------------------- modules

async function readModule(connection, body, moduleId = null) {
  const input = body || {};
  const title = typeof input.title === 'string' ? input.title.trim().replace(/\s+/g, ' ') : '';
  if (title.length < 3 || title.length > MAX.title) return { error: `Give the module a title (3 to ${MAX.title} characters).` };
  const phase = Number(input.phase);
  const [[phaseRow]] = await connection.query('SELECT name FROM program_phases WHERE number = ?', [phase]);
  if (!phaseRow) return { error: 'Choose the phase.' };
  const hours = Number(input.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 200) return { error: 'Hours must be a whole number from 1 to 200.' };
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length > MAX.description) return { error: `Keep the description under ${MAX.description} characters.` };
  const task = typeof input.task === 'string' ? input.task.trim().replace(/\s+/g, ' ') : '';
  if (task.length < 5 || task.length > MAX.task) return { error: 'Write the task beneficiaries rate in the pre-assessment (one plain sentence).' };
  const goals = Array.isArray(input.goals) ? [...new Set(input.goals)] : [];
  if (!goals.length || goals.some((goal) => !GOAL_VALUES.includes(goal))) return { error: 'Pick at least one goal that needs this module.' };
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > MAX.note) return { error: `Keep the note under ${MAX.note} characters.` };

  // Prerequisites: other modules of the training design, without going in a circle.
  const needs = Array.isArray(input.needs) ? [...new Set(input.needs.map(Number))] : [];
  if (needs.some((id) => !Number.isInteger(id) || id === Number(moduleId))) return { error: 'A module can’t need itself.' };
  if (needs.length) {
    const [found] = await connection.query(`SELECT lm.id FROM learning_modules lm WHERE ${DESIGN_MODULE} AND lm.id IN (?)`, [needs]);
    if (found.length !== needs.length) return { error: 'Choose prerequisites from the training design’s modules.' };
    if (moduleId) {
      const [edges] = await connection.query('SELECT module_id, prerequisite_id FROM module_prerequisites');
      const requires = new Map();
      edges.filter((edge) => Number(edge.module_id) !== Number(moduleId))
        .forEach((edge) => requires.set(Number(edge.module_id), [...(requires.get(Number(edge.module_id)) || []), Number(edge.prerequisite_id)]));
      const reaches = (from, seen = new Set()) => {
        if (from === Number(moduleId)) return true;
        if (seen.has(from)) return false;
        seen.add(from);
        return (requires.get(from) || []).some((next) => reaches(next, seen));
      };
      if (needs.some((id) => reaches(id))) return { error: 'Those prerequisites would go in a circle: one of them already needs this module.' };
    }
  }
  return {
    value: {
      title, phase, phaseName: phaseRow.name, hours, description, task, goals, needs, note: note || null,
      usesComputer: Boolean(input.usesComputer), foundation: Boolean(input.foundation),
    },
  };
}

async function uniqueSlug(connection, title) {
  const base = `elevate-${slugify(title)}`;
  for (let n = 1; n < 100; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const [[moduleTaken]] = await connection.query('SELECT 1 AS taken FROM learning_modules WHERE slug = ?', [slug]);
    const [[skillTaken]] = await connection.query('SELECT 1 AS taken FROM skills WHERE slug = ?', [slug]);
    if (!moduleTaken && !skillTaken) return slug;
  }
  throw new Error('Could not find a free slug for the module.');
}

// The next place at the end of a phase (Phase 2 -> 201, 202, …).
async function endOfPhase(connection, phase) {
  const [[row]] = await connection.query(
    `SELECT COALESCE(MAX(lm.sort_order), ?) AS last FROM learning_modules lm
     WHERE ${DESIGN_MODULE} AND lm.phase = ? AND lm.sort_order BETWEEN ? AND ?`,
    [phase * 100, phaseLabel(phase), phase * 100, phase * 100 + 99]
  );
  return Number(row.last) + 1;
}

async function setPrerequisites(connection, moduleId, needs) {
  await connection.query('DELETE FROM module_prerequisites WHERE module_id = ?', [moduleId]);
  for (const prerequisiteId of needs) {
    await connection.query('INSERT INTO module_prerequisites (module_id, prerequisite_id) VALUES (?, ?)', [moduleId, prerequisiteId]);
  }
}

async function addModule(req, res) {
  const result = await withTransaction(async (connection) => {
    const input = await readModule(connection, req.body);
    if (input.error) return { refuse: 400, message: input.error };
    const m = input.value;
    const slug = await uniqueSlug(connection, m.title);
    const categoryId = await phaseCategory(connection, m.phase, m.phaseName);
    const [skill] = await connection.query('INSERT INTO skills (category_id, name, slug, is_approved) VALUES (?, ?, ?, 1)', [categoryId, m.title.slice(0, 150), slug]);
    const [module] = await connection.query(
      `INSERT INTO learning_modules (slug, phase, title, description, task, goal_tracks, uses_computer, recommend_as_foundation,
         learner_note, hours, sort_order, approval_status, is_elevate_program)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1)`,
      [slug, phaseLabel(m.phase), m.title, m.description, m.task, JSON.stringify(m.goals), m.usesComputer ? 1 : 0,
        m.foundation ? 1 : 0, m.note, m.hours, await endOfPhase(connection, m.phase)]
    );
    await connection.query('INSERT INTO module_skills (module_id, skill_id, is_primary) VALUES (?, ?, 1)', [module.insertId, skill.insertId]);
    await setPrerequisites(connection, module.insertId, m.needs);
    return { id: module.insertId, title: m.title, phase: m.phase };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'training_design', moduleId: result.id, details: `Added “${result.title}” to Phase ${result.phase}` });
  res.status(201).json({ success: true, message: `“${result.title}” added to Phase ${result.phase}. Specialists can now pick it and make their module for it.`, data: { id: result.id } });
}

async function updateModule(req, res) {
  const moduleId = Number(req.params.moduleId);
  const result = await withTransaction(async (connection) => {
    const [[current]] = await connection.query(`SELECT lm.phase FROM learning_modules lm WHERE lm.id = ? AND ${DESIGN_MODULE} FOR UPDATE`, [moduleId]);
    if (!current) return { refuse: 404, message: 'That module was not found.' };
    const input = await readModule(connection, req.body, moduleId);
    if (input.error) return { refuse: 400, message: input.error };
    const m = input.value;
    const moved = phaseNumber(current.phase) !== m.phase;
    await connection.query(
      `UPDATE learning_modules SET title = ?, phase = ?, description = ?, task = ?, goal_tracks = ?, uses_computer = ?,
         recommend_as_foundation = ?, learner_note = ?, hours = ?${moved ? ', sort_order = ?' : ''} WHERE id = ?`,
      [m.title, phaseLabel(m.phase), m.description, m.task, JSON.stringify(m.goals), m.usesComputer ? 1 : 0,
        m.foundation ? 1 : 0, m.note, m.hours, ...(moved ? [await endOfPhase(connection, m.phase)] : []), moduleId]
    );
    // The skill behind it keeps the same name and phase (its slug stays, so links don't break).
    const categoryId = await phaseCategory(connection, m.phase, m.phaseName);
    await connection.query(
      'UPDATE skills s JOIN module_skills ms ON ms.skill_id = s.id AND ms.module_id = ? AND ms.is_primary = 1 SET s.name = ?, s.category_id = ?',
      [moduleId, m.title.slice(0, 150), categoryId]
    );
    await setPrerequisites(connection, moduleId, m.needs);
    return { title: m.title };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'training_design', moduleId, details: `Edited “${result.title}”` });
  res.json({ success: true, message: `“${result.title}” saved.` });
}

// Swap a module with its neighbour in the same phase (direction -1 up, 1 down).
async function moveModule(req, res) {
  const moduleId = Number(req.params.moduleId);
  const direction = Number(req.body?.direction) < 0 ? -1 : 1;
  const result = await withTransaction(async (connection) => {
    const [[me]] = await connection.query(`SELECT lm.phase FROM learning_modules lm WHERE lm.id = ? AND ${DESIGN_MODULE}`, [moduleId]);
    if (!me) return { refuse: 404, message: 'That module was not found.' };
    const [rows] = await connection.query(
      `SELECT lm.id FROM learning_modules lm WHERE ${DESIGN_MODULE} AND lm.phase = ? ORDER BY lm.sort_order, lm.id FOR UPDATE`,
      [me.phase]
    );
    const order = rows.map((row) => Number(row.id));
    const i = order.indexOf(moduleId);
    if (order[i + direction] === undefined) return { moved: false };
    [order[i], order[i + direction]] = [order[i + direction], order[i]];
    // Renumber the phase so every place is distinct (Phase 2 -> 201, 202, …).
    const base = (phaseNumber(me.phase) || 99) * 100;
    for (const [index, id] of order.entries()) {
      await connection.query('UPDATE learning_modules SET sort_order = ? WHERE id = ?', [base + index + 1, id]);
    }
    return { moved: true };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  res.json({ success: true, data: result });
}

// Hide a module (people learning it keep their progress), or show it again.
async function setModuleHidden(req, res) {
  const moduleId = Number(req.params.moduleId);
  const hidden = Boolean(req.body?.hidden);
  const [[module]] = await pool.query(`SELECT lm.title FROM learning_modules lm WHERE lm.id = ? AND ${DESIGN_MODULE}`, [moduleId]);
  if (!module) return res.status(404).json({ success: false, message: 'That module was not found.' });
  await pool.query('UPDATE learning_modules SET is_hidden = ? WHERE id = ?', [hidden ? 1 : 0, moduleId]);
  await logActivity({ userId: req.user.id, action: 'training_design', moduleId, details: `${hidden ? 'Hid' : 'Showed'} “${module.title}”` });
  rematchEveryone();
  res.json({ success: true, message: hidden ? `“${module.title}” is hidden. People learning it keep their progress.` : `“${module.title}” is shown again.` });
}

// Delete a module no one has used. One that people are learning, or that a
// specialist made a module for, can only be hidden.
async function removeModule(req, res) {
  const moduleId = Number(req.params.moduleId);
  const result = await withTransaction(async (connection) => {
    const [[module]] = await connection.query(
      `SELECT lm.title, ${LEARNERS_SQL} AS learners, ${OTHER_USE_SQL} AS other_use
       FROM learning_modules lm WHERE lm.id = ? AND ${DESIGN_MODULE} FOR UPDATE`,
      [moduleId]
    );
    if (!module) return { refuse: 404, message: 'That module was not found.' };
    if (Number(module.learners) || Number(module.other_use)) {
      return { refuse: 409, message: `“${module.title}” is in use (beneficiaries, a specialist’s work or past pre-assessments), so it can’t be deleted. Hide it instead.` };
    }
    const [skills] = await connection.query('SELECT skill_id FROM module_skills WHERE module_id = ?', [moduleId]);
    await connection.query('DELETE FROM learning_modules WHERE id = ?', [moduleId]);
    // Its skill too, unless another module still uses it.
    for (const { skill_id: skillId } of skills) {
      const [[used]] = await connection.query('SELECT COUNT(*) AS n FROM module_skills WHERE skill_id = ?', [skillId]);
      if (!Number(used.n)) await connection.query('DELETE FROM skills WHERE id = ?', [skillId]);
    }
    return { title: module.title };
  });
  if (result.refuse) return res.status(result.refuse).json({ success: false, message: result.message });
  await logActivity({ userId: req.user.id, action: 'training_design', details: `Deleted “${result.title}”` });
  rematchEveryone();
  res.json({ success: true, message: `“${result.title}” deleted.` });
}

module.exports = { getTrainingDesign, addPhase, updatePhase, deletePhase, addModule, updateModule, moveModule, setModuleHidden, removeModule };
