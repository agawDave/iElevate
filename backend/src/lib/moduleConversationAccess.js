const { pool } = require('../config/db');

// A conversation the user may read and write in: a topic chat between a
// learner and their specialist, or the admin's chat with a beneficiary or
// specialist (no topic, module_id NULL).
async function findAccessibleConversation(conversationId, userId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.module_id, c.user_a_id, c.user_b_id, lm.owner_id, lm.title AS module_title
     FROM conversations c
     LEFT JOIN learning_modules lm ON lm.id = c.module_id
     WHERE c.id = CAST(? AS UNSIGNED)
       AND (c.user_a_id = CAST(? AS UNSIGNED) OR c.user_b_id = CAST(? AS UNSIGNED))
       AND (
         (
           c.module_id IS NULL
           AND EXISTS (
             SELECT 1 FROM users staff
             WHERE staff.id IN (c.user_a_id, c.user_b_id) AND staff.role IN ('admin', 'moderator')
           )
         )
         OR (
           lm.approval_status = 'approved'
           AND (
             (
               lm.is_elevate_program = 1
               AND EXISTS (
                 SELECT 1 FROM elevate_module_assignments assignment
                 WHERE assignment.module_id = c.module_id
                   AND assignment.assignment_status = 'assigned'
                   AND (
                     (assignment.beneficiary_id = c.user_a_id AND assignment.specialist_id = c.user_b_id)
                     OR (assignment.beneficiary_id = c.user_b_id AND assignment.specialist_id = c.user_a_id)
                   )
               )
             )
             OR (
               lm.is_elevate_program = 0
               AND EXISTS (
                 SELECT 1 FROM module_connections mc
                 WHERE mc.module_id = c.module_id
                   AND (
                     (c.user_a_id = lm.owner_id AND c.user_b_id = mc.beneficiary_id)
                     OR (c.user_b_id = lm.owner_id AND c.user_a_id = mc.beneficiary_id)
                   )
               )
             )
           )
         )
       )`,
    [conversationId, userId, userId]
  );
  return rows[0] || null;
}

module.exports = { findAccessibleConversation };
