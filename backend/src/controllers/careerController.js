const { pool } = require('../config/db');
const { logActivity } = require('../lib/activityLog');
const { checkActivityFile, removeActivityFile } = require('../middleware/activityFileUpload');
const { withUpload, notify, learnerAssignment } = require('./activityController');
const { isBeneficiary } = require('./portfolioController');

// The Career tab of My Portfolio (tables career_profiles, career_entries and career_recommendations): the
// resume, and recommendations the beneficiary asks their specialists for.
const MAX_OBJECTIVE = 1000;
const MAX_OTHER_SKILLS = 500;
const MAX_ENTRIES = 20;
const MAX_NOTE = 500;
const MAX_RECOMMENDATION = 3000;
const RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const NOT_BENEFICIARY = { success: false, message: 'The career portfolio is for beneficiaries.' };

async function loadProfile(userId) {
  const [rows] = await pool.query('SELECT * FROM career_profiles WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

// Objective, other skills, and which resume shows. Only the fields sent change.
async function saveProfile(req, res) {
  if (!await isBeneficiary(req.user.id)) return res.status(403).json(NOT_BENEFICIARY);
  const current = await loadProfile(req.user.id);
  const body = req.body || {};
  const text = (key, fallback) => (typeof body[key] === 'string' ? body[key].trim() : fallback);
  const objective = text('objective', current?.objective || '');
  const otherSkills = text('otherSkills', current?.other_skills || '');
  if (objective.length > MAX_OBJECTIVE) return res.status(400).json({ success: false, message: `Keep your objective under ${MAX_OBJECTIVE} characters.` });
  if (otherSkills.length > MAX_OTHER_SKILLS) return res.status(400).json({ success: false, message: `Keep your other skills under ${MAX_OTHER_SKILLS} characters.` });
  const resumeMode = body.resumeMode === undefined ? (current?.resume_mode || 'built') : body.resumeMode;
  if (!['built', 'uploaded'].includes(resumeMode)) return res.status(400).json({ success: false, message: 'Choose which resume to show.' });
  if (resumeMode === 'uploaded' && !current?.file_storage_name) return res.status(400).json({ success: false, message: 'Upload your resume first.' });
  await pool.query(
    `INSERT INTO career_profiles (user_id, objective, other_skills, resume_mode) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE objective = VALUES(objective), other_skills = VALUES(other_skills), resume_mode = VALUES(resume_mode)`,
    [req.user.id, objective || null, otherSkills || null, resumeMode]
  );
  res.json({ success: true, message: 'Saved.' });
}

// Their own resume file; uploading it also makes it the one that shows.
const uploadResume = withUpload(async (req, res) => {
  if (!await isBeneficiary(req.user.id)) return res.status(403).json(NOT_BENEFICIARY);
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose your resume file.' });
  const file = await checkActivityFile(req.file);
  if (!file || !RESUME_TYPES.includes(file.mimeType)) return res.status(400).json({ success: false, message: 'Upload your resume as a PDF or Word file.' });
  const current = await loadProfile(req.user.id);
  await pool.query(
    `INSERT INTO career_profiles (user_id, resume_mode, file_storage_name, file_original_name, file_mime_type, file_size)
     VALUES (?, 'uploaded', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE resume_mode = 'uploaded', file_storage_name = VALUES(file_storage_name),
       file_original_name = VALUES(file_original_name), file_mime_type = VALUES(file_mime_type), file_size = VALUES(file_size)`,
    [req.user.id, file.storageName, file.originalName, file.mimeType, file.size]
  );
  req.keepUpload = true;
  if (current?.file_storage_name) await removeActivityFile(current.file_storage_name);
  res.json({ success: true, message: 'Resume uploaded.' });
});

async function removeResume(req, res) {
  const current = await loadProfile(req.user.id);
  if (!current?.file_storage_name) return res.status(404).json({ success: false, message: 'No resume to remove.' });
  await pool.query(
    `UPDATE career_profiles SET resume_mode = 'built', file_storage_name = NULL, file_original_name = NULL, file_mime_type = NULL, file_size = NULL
     WHERE user_id = ?`,
    [req.user.id]
  );
  await removeActivityFile(current.file_storage_name);
  res.json({ success: true, message: 'Resume removed.' });
}

function readEntry(body = {}) {
  const text = (key) => (typeof body[key] === 'string' ? body[key].trim() : '');
  const title = text('title');
  const organization = text('organization');
  const period = text('period');
  const description = text('description');
  if (!title) return { error: 'Fill in the job title or school.' };
  if (title.length > 190 || organization.length > 190) return { error: 'Keep each name under 190 characters.' };
  if (period.length > 60) return { error: 'Keep the years under 60 characters.' };
  if (description.length > 1000) return { error: 'Keep the description under 1000 characters.' };
  return { value: { title, organization: organization || null, period: period || null, description: description || null } };
}

async function createEntry(req, res) {
  if (!await isBeneficiary(req.user.id)) return res.status(403).json(NOT_BENEFICIARY);
  const { kind } = req.body || {};
  if (!['work', 'education'].includes(kind)) return res.status(400).json({ success: false, message: 'Choose work experience or education.' });
  const input = readEntry(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM career_entries WHERE user_id = ?', [req.user.id]);
  if (Number(count.total) >= MAX_ENTRIES) return res.status(400).json({ success: false, message: `A resume can have up to ${MAX_ENTRIES} entries.` });
  const { title, organization, period, description } = input.value;
  const [result] = await pool.query(
    'INSERT INTO career_entries (user_id, kind, title, organization, period, description) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, kind, title, organization, period, description]
  );
  res.status(201).json({ success: true, data: { id: result.insertId } });
}

async function updateEntry(req, res) {
  const input = readEntry(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const { title, organization, period, description } = input.value;
  const [result] = await pool.query(
    'UPDATE career_entries SET title = ?, organization = ?, period = ?, description = ? WHERE id = ? AND user_id = ?',
    [title, organization, period, description, req.params.entryId, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Entry not found.' });
  res.json({ success: true });
}

async function deleteEntry(req, res) {
  const [result] = await pool.query('DELETE FROM career_entries WHERE id = ? AND user_id = ?', [req.params.entryId, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Entry not found.' });
  res.json({ success: true });
}

// ------------------------------------------------------------ recommendations

// The beneficiary asks the specialist who accepted them on a topic.
async function requestRecommendation(req, res) {
  const moduleId = Number(req.body?.moduleId);
  const assignment = moduleId ? await learnerAssignment(req.user.id, moduleId) : null;
  if (!assignment) return res.status(404).json({ success: false, message: 'You can ask once a specialist has accepted you for this topic.' });
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (note.length > MAX_NOTE) return res.status(400).json({ success: false, message: `Keep your note under ${MAX_NOTE} characters.` });
  try {
    const [result] = await pool.query(
      'INSERT INTO career_recommendations (beneficiary_id, specialist_id, module_id, note) VALUES (?, ?, ?, ?)',
      [req.user.id, assignment.specialist_id, moduleId, note || null]
    );
    await logActivity({ userId: req.user.id, action: 'recommendation_requested', moduleId, targetUserId: assignment.specialist_id });
    const [[me]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    await notify(req.app, assignment.specialist_id, {
      kind: 'recommendation', moduleId, moduleTitle: assignment.title, senderName: me.full_name,
      body: `${me.full_name} asked you for a recommendation for ${assignment.title}`,
    });
    return res.status(201).json({ success: true, message: 'Request sent.', data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'You already asked this specialist for this topic.' });
    throw error;
  }
}

// The beneficiary cancels a request, or removes a recommendation from their portfolio.
async function removeRecommendation(req, res) {
  const [result] = await pool.query('DELETE FROM career_recommendations WHERE id = ? AND beneficiary_id = ?', [req.params.id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Not found.' });
  res.json({ success: true });
}

async function findForSpecialist(req) {
  const [rows] = await pool.query(
    `SELECT r.*, lm.title AS topic FROM career_recommendations r JOIN learning_modules lm ON lm.id = r.module_id
     WHERE r.id = ? AND r.specialist_id = ?`,
    [req.params.id, req.user.id]
  );
  return rows[0] || null;
}

// The specialist writes it (or edits what they wrote).
async function writeRecommendation(req, res) {
  const recommendation = await findForSpecialist(req);
  if (!recommendation) return res.status(404).json({ success: false, message: 'Request not found.' });
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ success: false, message: 'Write the recommendation first.' });
  if (body.length > MAX_RECOMMENDATION) return res.status(400).json({ success: false, message: `Keep it under ${MAX_RECOMMENDATION} characters.` });
  await pool.query("UPDATE career_recommendations SET status = 'written', body = ?, written_at = NOW() WHERE id = ?", [body, recommendation.id]);
  await logActivity({ userId: req.user.id, action: 'recommendation_written', moduleId: recommendation.module_id, targetUserId: recommendation.beneficiary_id });
  const [[me]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  await notify(req.app, recommendation.beneficiary_id, {
    kind: 'recommendation', moduleId: recommendation.module_id, moduleTitle: recommendation.topic, senderName: me.full_name,
    body: `${me.full_name} wrote you a recommendation`,
  });
  res.json({ success: true, message: 'Recommendation saved.' });
}

async function declineRecommendation(req, res) {
  const recommendation = await findForSpecialist(req);
  if (!recommendation) return res.status(404).json({ success: false, message: 'Request not found.' });
  if (recommendation.status !== 'requested') return res.status(409).json({ success: false, message: 'This request was already answered.' });
  await pool.query("UPDATE career_recommendations SET status = 'declined' WHERE id = ?", [recommendation.id]);
  const [[me]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  await notify(req.app, recommendation.beneficiary_id, {
    kind: 'recommendation', moduleId: recommendation.module_id, moduleTitle: recommendation.topic, senderName: me.full_name,
    body: `${me.full_name} can't write a recommendation for you right now`,
  });
  res.json({ success: true, message: 'Request declined.' });
}

module.exports = {
  saveProfile, uploadResume, removeResume, createEntry, updateEntry, deleteEntry,
  requestRecommendation, removeRecommendation, writeRecommendation, declineRecommendation,
};
