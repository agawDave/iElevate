const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { signActivityFileToken, verifyActivityFileToken } = require('../config/jwt');
const { activityFilePath } = require('../middleware/activityFileUpload');

// Who may open a file:
//   a past module answer  - that learner, the activity's specialist, and admins;
//   a portfolio item      - the beneficiary who added it, and admins;
//   an uploaded resume    - its owner, and admins (id = the owner's user id).
async function findViewableFile(kind, id, viewerId) {
  const [[viewer]] = await pool.query('SELECT role, status FROM users WHERE id = ?', [viewerId]);
  if (!viewer || viewer.status !== 'active') return null;
  const isAdmin = ['admin', 'moderator'].includes(viewer.role);

  if (kind === 'answer') {
    const [rows] = await pool.query(
      `SELECT ans.id, ans.beneficiary_id, act.specialist_id, ans.file_storage_name, ans.file_original_name, ans.file_mime_type
       FROM module_activity_answers ans JOIN module_activities act ON act.id = ans.activity_id
       WHERE ans.id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row || !row.file_storage_name) return null;
    const allowed = isAdmin || Number(row.beneficiary_id) === Number(viewerId) || Number(row.specialist_id) === Number(viewerId);
    return allowed ? row : null;
  }

  if (kind === 'portfolio') {
    const [rows] = await pool.query('SELECT id, user_id, file_storage_name, file_original_name, file_mime_type FROM portfolio_items WHERE id = ?', [id]);
    const row = rows[0];
    if (!row || !row.file_storage_name) return null;
    return isAdmin || Number(row.user_id) === Number(viewerId) ? row : null;
  }

  if (kind === 'resume') {
    const [rows] = await pool.query('SELECT user_id AS id, file_storage_name, file_original_name, file_mime_type FROM career_profiles WHERE user_id = ?', [id]);
    const row = rows[0];
    if (!row || !row.file_storage_name) return null;
    return isAdmin || Number(row.id) === Number(viewerId) ? row : null;
  }
  return null;
}

// A short-lived link to one file, for this viewer.
function signedFileUrl(req, kind, id) {
  const token = signActivityFileToken({ purpose: 'activity-file', kind, id: Number(id), userId: Number(req.user.id) });
  return `${req.protocol}://${req.get('host')}/api/elevate/activities/files/${kind}/${id}?token=${encodeURIComponent(token)}`;
}

function downloadName(file) {
  const extension = path.extname(file.file_storage_name);
  const original = file.file_original_name || '';
  return (original.toLowerCase().endsWith(extension) ? original : `Activity file${extension}`).replace(/[\r\n"\\/]/g, '_');
}

function linkHandler(kind, param) {
  return async (req, res) => {
    const file = await findViewableFile(kind, req.params[param], req.user.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });
    const url = signedFileUrl(req, kind, file.id);
    res.json({
      success: true,
      data: { url, downloadUrl: `${url}&download=1`, fileName: downloadName(file), mimeType: file.file_mime_type, expiresIn: 600 },
    });
  };
}

async function streamActivityFile(req, res) {
  const { kind, id } = req.params;
  let token;
  try {
    token = verifyActivityFileToken(req.query.token);
  } catch {
    return res.status(401).json({ success: false, message: 'This link has expired. Go back and open the file again.' });
  }
  if (token.purpose !== 'activity-file' || token.kind !== kind || Number(token.id) !== Number(id)) {
    return res.status(403).json({ success: false, message: 'File access denied.' });
  }
  // Checked again: access may have changed since the link was made.
  const file = await findViewableFile(kind, id, token.userId);
  if (!file) return res.status(404).json({ success: false, message: 'File not found.' });

  const filePath = activityFilePath(file.file_storage_name);
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'The file is missing. Ask for it to be uploaded again.' });
    throw error;
  }
  // PDFs and photos can open in the browser; Office files always download.
  const inline = req.query.download !== '1' && /^(application\/pdf|image\/)/.test(file.file_mime_type || '');
  res.setHeader('Content-Type', file.file_mime_type || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(downloadName(file))}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  fs.createReadStream(filePath).pipe(res);
}

module.exports = {
  answerFileLink: linkHandler('answer', 'answerId'),
  portfolioFileLink: linkHandler('portfolio', 'itemId'),
  resumeFileLink: linkHandler('resume', 'userId'),
  signedFileUrl,
  streamActivityFile,
};
