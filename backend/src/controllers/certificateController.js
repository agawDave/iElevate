const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { signCertificateToken, verifyCertificateToken } = require('../config/jwt');
const { certificatePath } = require('../middleware/certificateUpload');

// A certificate file can be opened by the learner it was issued to, the
// specialist who issued it, and admins - nobody else.
async function findViewableCertificate(certificateId, viewerId) {
  const [rows] = await pool.query(
    `SELECT cert.id, cert.user_id, cert.issued_by, cert.file_storage_name, cert.file_original_name,
            cert.file_mime_type, lm.title AS module_title, viewer.role, viewer.status AS viewer_status
     FROM module_certificates cert
     JOIN learning_modules lm ON lm.id = cert.module_id
     JOIN users viewer ON viewer.id = ?
     WHERE cert.id = ?`,
    [viewerId, certificateId]
  );
  const row = rows[0];
  if (!row || row.viewer_status !== 'active' || !row.file_storage_name) return null;
  const allowed = Number(row.user_id) === Number(viewerId)
    || Number(row.issued_by) === Number(viewerId)
    || ['admin', 'moderator'].includes(row.role);
  return allowed ? row : null;
}

function downloadName(certificate) {
  const extension = path.extname(certificate.file_storage_name);
  const original = certificate.file_original_name || '';
  return (original.toLowerCase().endsWith(extension) ? original : `Certificate - ${certificate.module_title}${extension}`)
    .replace(/[\r\n"\\/]/g, '_');
}

async function createCertificateLink(req, res) {
  const certificate = await findViewableCertificate(req.params.certificateId, req.user.id);
  if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found' });
  const token = signCertificateToken({ purpose: 'certificate', certificateId: Number(certificate.id), userId: Number(req.user.id) });
  const url = `${req.protocol}://${req.get('host')}/api/certificates/${certificate.id}/file?token=${encodeURIComponent(token)}`;
  res.json({
    success: true,
    data: {
      url,
      downloadUrl: `${url}&download=1`,
      fileName: downloadName(certificate),
      mimeType: certificate.file_mime_type,
      expiresIn: 600,
    },
  });
}

async function streamCertificate(req, res) {
  let token;
  try {
    token = verifyCertificateToken(req.query.token);
  } catch {
    return res.status(401).json({ success: false, message: 'This certificate link has expired. Go back and open it again.' });
  }
  if (token.purpose !== 'certificate' || Number(token.certificateId) !== Number(req.params.certificateId)) {
    return res.status(403).json({ success: false, message: 'Certificate access denied' });
  }
  // Checked again: access may have changed since the link was made.
  const certificate = await findViewableCertificate(req.params.certificateId, token.userId);
  if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found' });

  const filePath = certificatePath(certificate.file_storage_name);
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'The certificate file is missing. Ask your specialist to upload it again.' });
    throw error;
  }
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', certificate.file_mime_type || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(downloadName(certificate))}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  fs.createReadStream(filePath).pipe(res);
}

module.exports = { createCertificateLink, streamCertificate };
