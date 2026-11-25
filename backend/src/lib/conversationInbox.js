const { pool } = require('../config/db');
const { livesAbroad } = require('./places');

// Every ELEVATE conversation the user is part of. A chat exists once the
// specialist accepts the learner's application, so its status is:
//   ongoing   - accepted, the learner is doing the topic
//   completed - the specialist marked the learner as finished (certificate issued)
// (Incoming applications have no chat yet; see applicationController.)
async function loadInbox(userId, { moduleId = null } = {}) {
  const params = [userId, userId, userId, userId];
  let moduleFilter = '';
  if (moduleId) {
    moduleFilter = 'AND c.module_id = ?';
    params.push(Number(moduleId));
  }
  const [rows] = await pool.query(
    `SELECT c.id, c.module_id, lm.slug AS module_slug, lm.title AS module_title, lm.phase,
            a.beneficiary_id, a.specialist_id, a.assigned_at,
            other.id AS other_user_id, other.full_name AS other_user_name, other.avatar_url AS other_user_avatar,
            last_message.body AS last_message, last_message.created_at AS last_message_at,
            last_message.sender_id AS last_sender_id,
            (SELECT COUNT(*) FROM messages unread
             WHERE unread.conversation_id = c.id AND unread.sender_id <> ? AND unread.read_at IS NULL) AS unread_count,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
            cert.id AS certificate_id, cert.certificate_code, cert.issued_at AS completed_at,
            cert.file_storage_name IS NOT NULL AS certificate_has_file, cert.file_original_name AS certificate_file_name,
            profile.notes AS learner_notes, learner.country AS learner_country,
            (SELECT sa.band FROM elevate_skill_assessments sa
             WHERE sa.user_id = a.beneficiary_id AND sa.skill_id = a.matched_skill_id
             ORDER BY sa.attempt DESC LIMIT 1) AS learner_band
     FROM conversations c
     JOIN learning_modules lm ON lm.id = c.module_id
       AND lm.is_elevate_program = 1 AND lm.approval_status = 'approved'
     JOIN elevate_module_assignments a ON a.module_id = c.module_id AND a.assignment_status = 'assigned'
       AND ((a.beneficiary_id = c.user_a_id AND a.specialist_id = c.user_b_id)
         OR (a.beneficiary_id = c.user_b_id AND a.specialist_id = c.user_a_id))
     JOIN users other ON other.id = IF(c.user_a_id = ?, c.user_b_id, c.user_a_id)
     JOIN users learner ON learner.id = a.beneficiary_id
     LEFT JOIN messages last_message ON last_message.id = (
       SELECT m.id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
     )
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = c.module_id
     LEFT JOIN elevate_learner_profiles profile ON profile.user_id = a.beneficiary_id
     WHERE (c.user_a_id = ? OR c.user_b_id = ?) ${moduleFilter}
     ORDER BY COALESCE(last_message.created_at, a.assigned_at) DESC`,
    params
  );
  const isSpecialistView = (row) => Number(row.specialist_id) === Number(userId);
  return rows.map((row) => {
    const status = row.certificate_code ? 'completed' : 'ongoing';
    return {
      id: row.id,
      moduleId: row.module_id,
      moduleSlug: row.module_slug,
      moduleTitle: row.module_title,
      phase: row.phase,
      status,
      otherUserId: row.other_user_id,
      otherUserName: row.other_user_name,
      otherUserAvatar: row.other_user_avatar,
      beneficiaryId: row.beneficiary_id,
      specialistId: row.specialist_id,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      lastSenderId: row.last_sender_id || null,
      // The learner wrote last and the specialist hasn't answered yet.
      awaitingSpecialist: Boolean(row.last_sender_id) && Number(row.last_sender_id) === Number(row.beneficiary_id),
      matchedAt: row.assigned_at,
      messageCount: Number(row.message_count) || 0,
      unreadCount: Number(row.unread_count) || 0,
      certificateId: row.certificate_id || null,
      certificateCode: row.certificate_code || null,
      certificateHasFile: Boolean(row.certificate_has_file),
      certificateFileName: row.certificate_file_name || null,
      completedAt: row.completed_at || null,
      // The learner lives outside the Philippines: online only, no face-to-face booking.
      learnerOnlineOnly: livesAbroad(row.learner_country),
      // Shown to the specialist only: what the learner wrote and their level.
      learnerNotes: isSpecialistView(row) ? row.learner_notes || '' : undefined,
      learnerBand: isSpecialistView(row) ? row.learner_band || null : undefined,
    };
  });
}

// The admin's chats with this user (no topic), once the admin has written.
async function loadAdminChats(userId) {
  const [rows] = await pool.query(
    `SELECT c.id, other.full_name AS other_user_name, other.avatar_url AS other_user_avatar,
            last_message.body AS last_message, last_message.created_at AS last_message_at,
            last_message.sender_id AS last_sender_id
     FROM conversations c
     JOIN users other ON other.id = IF(c.user_a_id = ?, c.user_b_id, c.user_a_id) AND other.role IN ('admin', 'moderator')
     JOIN messages last_message ON last_message.id = (
       SELECT m.id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
     )
     WHERE c.module_id IS NULL AND ? IN (c.user_a_id, c.user_b_id)`,
    [userId, userId]
  );
  return rows.map((row) => ({
    id: row.id,
    otherUserName: row.other_user_name,
    otherUserAvatar: row.other_user_avatar,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    lastSenderId: row.last_sender_id,
  }));
}

function summarize(items) {
  const summary = {};
  ['incoming', 'ongoing', 'completed'].forEach((status) => {
    const group = items.filter((item) => item.status === status);
    summary[status] = {
      count: group.length,
      unread: group.reduce((total, item) => total + item.unreadCount, 0),
    };
  });
  return summary;
}

module.exports = { loadInbox, loadAdminChats, summarize };
