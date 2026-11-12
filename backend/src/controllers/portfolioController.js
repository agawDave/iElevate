const { pool } = require('../config/db');
const { buildPortfolio } = require('../lib/portfolio');
const { logActivity } = require('../lib/activityLog');
const { checkActivityFile, removeActivityFile, TYPE_MESSAGE } = require('../middleware/activityFileUpload');
const { withUpload } = require('./activityController');
const { signedFileUrl } = require('./activityFileController');

// The learning portfolio: viewing it (the beneficiary or an admin), and the
// parts the beneficiary writes: their reflections, and the projects, awards
// and photos they add themselves (always labelled as added by them).
const KINDS = ['project', 'award', 'photo', 'license', 'training', 'letter'];
const KIND_LABELS = { project: 'Project', award: 'Award', photo: 'Photo', license: 'License', training: 'Training', letter: 'Letter' };
const MAX_ITEMS = 60;
const MAX_TITLE = 190;
const MAX_DESCRIPTION = 1000;
const MAX_REFLECTION = 2000;
const BAD_FILE = `That file couldn't be read as what its name says. ${TYPE_MESSAGE}`;

// Photos display on the page, so they get a short-lived link for this viewer.
function withPreviews(req, portfolio) {
  return {
    ...portfolio,
    items: portfolio.items.map((item) => ({
      ...item,
      previewUrl: item.file?.mimeType?.startsWith('image/') ? signedFileUrl(req, 'portfolio', item.id) : null,
    })),
  };
}

async function myPortfolio(req, res) {
  const portfolio = await buildPortfolio(req.user.id);
  if (!portfolio) return res.status(403).json({ success: false, message: 'The learning portfolio is for beneficiaries.' });
  res.json({ success: true, data: withPreviews(req, portfolio) });
}

// An admin opens a beneficiary's portfolio (admin routes check the role).
async function beneficiaryPortfolio(req, res) {
  const portfolio = await buildPortfolio(Number(req.params.id));
  if (!portfolio) return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
  // Admins see finished recommendations, not pending requests.
  portfolio.career.recommendations = portfolio.career.recommendations.filter((item) => item.status === 'written');
  res.json({ success: true, data: withPreviews(req, portfolio) });
}

async function isBeneficiary(userId) {
  const [[user]] = await pool.query('SELECT user_type, role FROM users WHERE id = ?', [userId]);
  return Boolean(user) && user.user_type === 'beneficiary' && !['admin', 'moderator'].includes(user.role);
}

function readDetails(body = {}) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Give it a title.' };
  if (title.length > MAX_TITLE) return { error: `Keep the title under ${MAX_TITLE} characters.` };
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length > MAX_DESCRIPTION) return { error: `Keep the description under ${MAX_DESCRIPTION} characters.` };
  const itemDate = typeof body.itemDate === 'string' ? body.itemDate.trim() : '';
  if (itemDate && (!/^\d{4}-\d{2}-\d{2}$/.test(itemDate) || Number.isNaN(new Date(`${itemDate}T00:00:00`).getTime()))) return { error: 'Choose a valid date.' };
  return { value: { title, description: description || null, itemDate: itemDate || null } };
}

// What each kind needs: a photo needs a picture; a project or letter needs a file or text.
function missingContent(kind, file, description) {
  if (kind === 'photo' && !file) return 'Choose the photo.';
  if (kind === 'photo' && !file.mimeType.startsWith('image/')) return 'Choose a JPG or PNG photo.';
  if (kind === 'project' && !file && !description) return 'Attach your project, or describe it.';
  if (kind === 'letter' && !file && !description) return 'Attach the letter, or type it.';
  return '';
}

const createItem = withUpload(async (req, res) => {
  if (!await isBeneficiary(req.user.id)) return res.status(403).json({ success: false, message: 'The learning portfolio is for beneficiaries.' });
  const { kind } = req.body || {};
  if (!KINDS.includes(kind)) return res.status(400).json({ success: false, message: 'Choose a project, an award or a photo.' });
  const input = readDetails(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  let file = null;
  if (req.file) {
    file = await checkActivityFile(req.file);
    if (!file) return res.status(400).json({ success: false, message: BAD_FILE });
  }
  const missing = missingContent(kind, file, input.value.description);
  if (missing) return res.status(400).json({ success: false, message: missing });
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM portfolio_items WHERE user_id = ?', [req.user.id]);
  if (Number(count.total) >= MAX_ITEMS) return res.status(400).json({ success: false, message: `A portfolio can have up to ${MAX_ITEMS} items you added.` });
  const [result] = await pool.query(
    `INSERT INTO portfolio_items (user_id, kind, title, description, item_date, file_storage_name, file_original_name, file_mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, kind, input.value.title, input.value.description, input.value.itemDate,
      file?.storageName || null, file?.originalName || null, file?.mimeType || null, file?.size || null]
  );
  req.keepUpload = Boolean(file);
  await logActivity({ userId: req.user.id, action: 'portfolio_added', details: `${KIND_LABELS[kind]}: ${input.value.title}`.slice(0, 250) });
  res.status(201).json({ success: true, message: 'Added to your portfolio.', data: { id: result.insertId } });
});

async function findOwnItem(req) {
  const [rows] = await pool.query('SELECT * FROM portfolio_items WHERE id = ? AND user_id = ?', [req.params.itemId, req.user.id]);
  return rows[0] || null;
}

const updateItem = withUpload(async (req, res) => {
  const item = await findOwnItem(req);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
  const input = readDetails(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  // A new file replaces the old one; removeFile=1 removes it.
  let newFile = null;
  if (req.file) {
    newFile = await checkActivityFile(req.file);
    if (!newFile) return res.status(400).json({ success: false, message: BAD_FILE });
  }
  const keepsOld = !newFile && req.body?.removeFile !== '1' && item.file_storage_name;
  const file = newFile || (keepsOld
    ? { storageName: item.file_storage_name, originalName: item.file_original_name, mimeType: item.file_mime_type, size: item.file_size }
    : null);
  const missing = missingContent(item.kind, file, input.value.description);
  if (missing) return res.status(400).json({ success: false, message: missing });
  await pool.query(
    `UPDATE portfolio_items SET title = ?, description = ?, item_date = ?,
       file_storage_name = ?, file_original_name = ?, file_mime_type = ?, file_size = ?
     WHERE id = ?`,
    [input.value.title, input.value.description, input.value.itemDate,
      file?.storageName || null, file?.originalName || null, file?.mimeType || null, file?.size || null, item.id]
  );
  req.keepUpload = Boolean(newFile);
  if (item.file_storage_name && item.file_storage_name !== file?.storageName) await removeActivityFile(item.file_storage_name);
  res.json({ success: true, message: 'Saved.' });
});

async function deleteItem(req, res) {
  const item = await findOwnItem(req);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
  await pool.query('DELETE FROM portfolio_items WHERE id = ?', [item.id]);
  await removeActivityFile(item.file_storage_name);
  res.json({ success: true, message: 'Removed from your portfolio.' });
}

// "What I learned" on the learner's own written or file-task answer.
// Stays editable after the topic is completed.
async function saveReflection(req, res) {
  const reflection = typeof req.body?.reflection === 'string' ? req.body.reflection.trim() : '';
  if (reflection.length > MAX_REFLECTION) return res.status(400).json({ success: false, message: `Keep your reflection under ${MAX_REFLECTION} characters.` });
  const [[answer]] = await pool.query(
    `SELECT ans.id FROM module_activity_answers ans
     JOIN module_activities act ON act.id = ans.activity_id AND act.activity_type <> 'multiple_choice'
     WHERE ans.id = ? AND ans.beneficiary_id = ?`,
    [req.params.answerId, req.user.id]
  );
  if (!answer) return res.status(404).json({ success: false, message: 'Answer not found.' });
  await pool.query('UPDATE module_activity_answers SET reflection = ?, reflection_updated_at = NOW() WHERE id = ?', [reflection || null, answer.id]);
  res.json({ success: true, message: 'Reflection saved.' });
}

// "Show in career portfolio" on a written or file-task answer, or a project.
async function showAnswerInCareer(req, res) {
  const [[answer]] = await pool.query(
    `SELECT ans.id FROM module_activity_answers ans
     JOIN module_activities act ON act.id = ans.activity_id AND act.activity_type <> 'multiple_choice'
     WHERE ans.id = ? AND ans.beneficiary_id = ?`,
    [req.params.answerId, req.user.id]
  );
  if (!answer) return res.status(404).json({ success: false, message: 'Answer not found.' });
  await pool.query('UPDATE module_activity_answers SET show_in_career = ? WHERE id = ?', [req.body?.show ? 1 : 0, answer.id]);
  res.json({ success: true });
}

async function showItemInCareer(req, res) {
  const item = await findOwnItem(req);
  if (!item || item.kind !== 'project') return res.status(404).json({ success: false, message: 'Project not found.' });
  await pool.query('UPDATE portfolio_items SET show_in_career = ? WHERE id = ?', [req.body?.show ? 1 : 0, item.id]);
  res.json({ success: true });
}

module.exports = {
  isBeneficiary, myPortfolio, beneficiaryPortfolio, createItem, updateItem, deleteItem, saveReflection, showAnswerInCareer, showItemInCareer,
};
