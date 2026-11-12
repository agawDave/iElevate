-- Activity log (tracking and reporting objective): one row per thing a user
-- does - logging in, applying, accepting, messaging, booking a session,
-- answering an activity, getting a certificate, taking the skill check.
-- The admin's Activity log page lists it; the Reports page counts from it.
USE ielevate_db;

CREATE TABLE IF NOT EXISTS user_activity_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,          -- who did it
  action VARCHAR(40) NOT NULL,               -- login, applied, accepted, message_sent, ...
  module_id INT UNSIGNED NULL,               -- the topic, when there is one
  target_user_id BIGINT UNSIGNED NULL,       -- the other person (learner or specialist)
  details VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_time (created_at),
  INDEX idx_activity_user (user_id, created_at),
  INDEX idx_activity_action (action, created_at),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_module FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Fill in what already happened, from the dates stored on existing records,
-- so reports cover the time before the log existed. Each statement skips rows
-- already in the log, so this is safe to re-run. (Past logins can't be
-- recovered: only each user's last login was stored.)

INSERT INTO user_activity_log (user_id, action, details, created_at)
SELECT u.id, 'registered', CONCAT('Joined as ', u.user_type), u.created_at
FROM users u
WHERE u.user_type IN ('beneficiary', 'specialist')
  AND NOT EXISTS (SELECT 1 FROM user_activity_log l WHERE l.user_id = u.id AND l.action = 'registered');

INSERT INTO user_activity_log (user_id, action, details, created_at)
SELECT u.id, 'login', 'Last login before the activity log started', u.last_login_at
FROM users u
WHERE u.last_login_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_activity_log l WHERE l.user_id = u.id AND l.action = 'login');

INSERT INTO user_activity_log (user_id, action, details, created_at)
SELECT sa.user_id, 'skill_check', IF(sa.attempt = 1, 'Pre-test', 'Post-test'), MIN(sa.taken_at)
FROM elevate_skill_assessments sa
WHERE NOT EXISTS (SELECT 1 FROM user_activity_log l WHERE l.user_id = sa.user_id AND l.action = 'skill_check')
GROUP BY sa.user_id, sa.attempt;

INSERT INTO user_activity_log (user_id, action, module_id, target_user_id, created_at)
SELECT a.beneficiary_id, 'applied', a.module_id, a.specialist_id, a.applied_at
FROM elevate_module_assignments a
WHERE a.applied_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_activity_log l
                  WHERE l.user_id = a.beneficiary_id AND l.action = 'applied' AND l.module_id = a.module_id);

INSERT INTO user_activity_log (user_id, action, module_id, target_user_id, created_at)
SELECT a.specialist_id, 'accepted', a.module_id, a.beneficiary_id, a.assigned_at
FROM elevate_module_assignments a
WHERE a.assignment_status = 'assigned' AND a.assigned_at IS NOT NULL AND a.specialist_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_activity_log l
                  WHERE l.target_user_id = a.beneficiary_id AND l.action = 'accepted' AND l.module_id = a.module_id);

INSERT INTO user_activity_log (user_id, action, module_id, target_user_id, created_at)
SELECT m.sender_id, 'message_sent', c.module_id, IF(c.user_a_id = m.sender_id, c.user_b_id, c.user_a_id), m.created_at
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.module_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_activity_log l
                  WHERE l.user_id = m.sender_id AND l.action = 'message_sent' AND l.created_at = m.created_at);

INSERT INTO user_activity_log (user_id, action, module_id, target_user_id, created_at)
SELECT ms.scheduled_by, 'session_booked', ms.module_id,
       IF(ms.scheduled_by = ms.beneficiary_id, ms.specialist_id, ms.beneficiary_id), ms.created_at
FROM module_sessions ms
WHERE NOT EXISTS (SELECT 1 FROM user_activity_log l
                  WHERE l.user_id = ms.scheduled_by AND l.action = 'session_booked' AND l.created_at = ms.created_at);

INSERT INTO user_activity_log (user_id, action, module_id, target_user_id, details, created_at)
SELECT ans.beneficiary_id, 'activity_answered', act.module_id, act.specialist_id,
       IF(act.activity_type = 'written', 'Written task', IF(ans.is_correct = 1, 'Correct', 'Not correct')), ans.submitted_at
FROM module_activity_answers ans
JOIN module_activities act ON act.id = ans.activity_id
WHERE NOT EXISTS (SELECT 1 FROM user_activity_log l
                  WHERE l.user_id = ans.beneficiary_id AND l.action = 'activity_answered' AND l.created_at = ans.submitted_at);

INSERT INTO user_activity_log (user_id, action, module_id, target_user_id, created_at)
SELECT mc.issued_by, 'certificate_issued', mc.module_id, mc.user_id, mc.issued_at
FROM module_certificates mc
WHERE mc.issued_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_activity_log l
                  WHERE l.target_user_id = mc.user_id AND l.action = 'certificate_issued' AND l.module_id = mc.module_id);
