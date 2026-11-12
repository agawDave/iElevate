const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { recomputeElevateAssignments, promoteNextUpTopics, lockLearner } = require('../services/elevateAssignmentService');
const { certificateMimeType, removeCertificateFile } = require('../middleware/certificateUpload');
const { logActivity } = require('../lib/activityLog');

// The specialist assigned to a learner on a topic marks them as completed
// (graduated) by uploading the certificate they made for them. That issues the
// certificate, moves the conversation to "Completed", and starts the learner's
// next-up topic if a slot frees up.
async function findAssignment(connection, moduleId, beneficiaryId, specialistId) {
  // Inside a transaction, lock the learner first, like every other change to
  // their matches, so concurrent changes queue instead of deadlocking.
  if (connection !== pool) await lockLearner(connection, beneficiaryId);
  const [rows] = await connection.query(
    `SELECT a.beneficiary_id, a.module_id, a.matched_skill_id, lm.title, learner.full_name AS learner_name
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     JOIN users learner ON learner.id = a.beneficiary_id
     WHERE a.module_id = ? AND a.beneficiary_id = ? AND a.specialist_id = ? AND a.assignment_status = 'assigned'`,
    [moduleId, beneficiaryId, specialistId]
  );
  return rows[0] || null;
}

function cleanFileName(name) {
  return String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(-255) || 'certificate';
}

// The uploaded certificate, checked, or an error message.
async function readCertificateUpload(req) {
  if (!req.file) return { error: 'Upload the certificate you made for this learner (PDF, PNG or JPG).' };
  const mimeType = await certificateMimeType(req.file);
  if (!mimeType) return { error: 'That file is not a valid PDF, PNG or JPG. Save the certificate again and upload it.' };
  return {
    file: {
      storageName: req.file.filename,
      originalName: cleanFileName(req.file.originalname),
      mimeType,
      size: req.file.size,
    },
  };
}

// Refuse the request and delete the file multer already saved.
async function discard(req, res, status, message) {
  await removeCertificateFile(req.file?.filename);
  return res.status(status).json({ success: false, message });
}

async function completeLearner(req, res) {
  const { moduleId, beneficiaryId } = req.params;
  const upload = await readCertificateUpload(req);
  if (upload.error) return discard(req, res, 400, upload.error);
  const { file } = upload;

  const connection = await pool.getConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const assignment = await findAssignment(connection, moduleId, beneficiaryId, req.user.id);
    if (!assignment) {
      await connection.rollback();
      return discard(req, res, 403, 'Only the specialist assigned to this learner can mark the topic completed.');
    }
    const [existing] = await connection.query(
      'SELECT id FROM module_certificates WHERE user_id = ? AND module_id = ? FOR UPDATE',
      [beneficiaryId, moduleId]
    );
    if (existing.length) {
      await connection.rollback();
      return discard(req, res, 409, `${assignment.learner_name} already has a certificate for ${assignment.title}. Use "Replace certificate" to change the file.`);
    }
    await connection.query(
      `INSERT INTO module_certificates
         (user_id, module_id, certificate_code, issued_by,
          file_storage_name, file_original_name, file_mime_type, file_size, file_uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [beneficiaryId, moduleId, uuidv4(), req.user.id, file.storageName, file.originalName, file.mimeType, file.size]
    );
    await connection.query(
      `UPDATE user_skills SET learning_status = 'completed', status_reason = NULL
       WHERE user_id = ? AND skill_id = ? AND relation_type = 'wants_to_learn'`,
      [beneficiaryId, assignment.matched_skill_id]
    );
    const started = await promoteNextUpTopics(beneficiaryId, connection);
    await recomputeElevateAssignments(beneficiaryId, connection);
    const [[certificate]] = await connection.query(
      `SELECT id, certificate_code, issued_at, file_original_name
       FROM module_certificates WHERE user_id = ? AND module_id = ?`,
      [beneficiaryId, moduleId]
    );
    await connection.commit();
    committed = true;
    await logActivity({ userId: req.user.id, action: 'certificate_issued', moduleId: Number(moduleId), targetUserId: Number(beneficiaryId) });
    res.json({
      success: true,
      message: `Certificate issued. ${assignment.learner_name} completed ${assignment.title}.`,
      data: { certificate, startedTopics: started },
    });
  } catch (error) {
    await connection.rollback();
    if (!committed) await removeCertificateFile(file.storageName);
    throw error;
  } finally {
    connection.release();
  }
}

// Swap the certificate file (a typo in the name, a better design). Only the
// specialist still assigned to the learner on that topic can do this.
async function replaceCertificate(req, res) {
  const { moduleId, beneficiaryId } = req.params;
  const upload = await readCertificateUpload(req);
  if (upload.error) return discard(req, res, 400, upload.error);
  const { file } = upload;

  const assignment = await findAssignment(pool, moduleId, beneficiaryId, req.user.id);
  if (!assignment) return discard(req, res, 403, 'Only the specialist assigned to this learner can change their certificate.');
  const [rows] = await pool.query(
    'SELECT id, file_storage_name FROM module_certificates WHERE user_id = ? AND module_id = ?',
    [beneficiaryId, moduleId]
  );
  if (!rows.length) return discard(req, res, 404, 'Mark the learner as completed first.');
  try {
    await pool.query(
      `UPDATE module_certificates
       SET issued_by = ?, file_storage_name = ?, file_original_name = ?, file_mime_type = ?, file_size = ?, file_uploaded_at = NOW()
       WHERE id = ?`,
      [req.user.id, file.storageName, file.originalName, file.mimeType, file.size, rows[0].id]
    );
  } catch (error) {
    await removeCertificateFile(file.storageName);
    throw error;
  }
  await removeCertificateFile(rows[0].file_storage_name);
  res.json({ success: true, message: `Certificate replaced for ${assignment.learner_name}.` });
}

// Undo a completion made by mistake. The topic becomes active again and the
// certificate (and its file) is withdrawn.
async function reopenLearner(req, res) {
  const { moduleId, beneficiaryId } = req.params;
  const connection = await pool.getConnection();
  let removedFile = null;
  try {
    await connection.beginTransaction();
    const assignment = await findAssignment(connection, moduleId, beneficiaryId, req.user.id);
    if (!assignment) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Only the specialist assigned to this learner can reopen the topic.' });
    }
    const [certificates] = await connection.query(
      'SELECT file_storage_name FROM module_certificates WHERE user_id = ? AND module_id = ? FOR UPDATE',
      [beneficiaryId, moduleId]
    );
    removedFile = certificates[0]?.file_storage_name || null;
    await connection.query('DELETE FROM module_certificates WHERE user_id = ? AND module_id = ?', [beneficiaryId, moduleId]);
    await connection.query(
      `UPDATE user_skills SET learning_status = 'active'
       WHERE user_id = ? AND skill_id = ? AND relation_type = 'wants_to_learn' AND learning_status = 'completed'`,
      [beneficiaryId, assignment.matched_skill_id]
    );
    await recomputeElevateAssignments(beneficiaryId, connection);
    await connection.commit();
    await removeCertificateFile(removedFile);
    await logActivity({ userId: req.user.id, action: 'topic_reopened', moduleId: Number(moduleId), targetUserId: Number(beneficiaryId) });
    res.json({ success: true, message: `${assignment.title} reopened. The certificate was withdrawn.` });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { completeLearner, replaceCertificate, reopenLearner };
