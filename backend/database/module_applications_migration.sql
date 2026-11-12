-- Apply, then the specialist accepts (project-advisor flow):
--   suggested - the skill check gave the learner this topic and a best-fit
--               specialist was found; the learner hasn't applied yet
--   pending   - the learner applied; waiting for that specialist to accept (Incoming)
--   assigned  - the specialist accepted; the learner is doing the topic (Ongoing),
--               or finished it with a certificate (Completed)
--   waiting   - no specialist fits yet (an application is sent once one does)
--   queued    - next up: starts after a current topic is finished
USE ielevate_db;

ALTER TABLE elevate_module_assignments
  MODIFY assignment_status ENUM('suggested','pending','assigned','waiting','queued') NOT NULL,
  ADD COLUMN IF NOT EXISTS applied_at DATETIME NULL AFTER assigned_at;

-- A specialist who declined a learner's application for a topic isn't asked again;
-- the application moves to the next specialist who fits.
CREATE TABLE IF NOT EXISTS elevate_application_declines (
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NOT NULL,
  declined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (beneficiary_id, module_id, specialist_id),
  CONSTRAINT fk_application_decline_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_application_decline_module FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_application_decline_specialist FOREIGN KEY (specialist_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Existing automatic matches (runs once; safe to re-run):
-- 1. Matches that had started (messages or a certificate) count as applied and
--    accepted, so they stay Ongoing / Completed.
UPDATE elevate_module_assignments a
SET a.applied_at = COALESCE(a.assigned_at, NOW())
WHERE a.assignment_status = 'assigned' AND a.applied_at IS NULL
  AND (
    EXISTS (SELECT 1 FROM module_certificates mc WHERE mc.user_id = a.beneficiary_id AND mc.module_id = a.module_id)
    OR EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.module_id = a.module_id
        AND c.user_a_id = LEAST(a.beneficiary_id, a.specialist_id)
        AND c.user_b_id = GREATEST(a.beneficiary_id, a.specialist_id)
    )
  );

-- 2. Matches nobody had started become suggestions the learner applies to.
UPDATE elevate_module_assignments
SET assignment_status = 'suggested', assigned_at = NULL
WHERE assignment_status = 'assigned' AND applied_at IS NULL;

-- 3. Only accepted topics keep a module connection.
DELETE mc FROM module_connections mc
JOIN learning_modules lm ON lm.id = mc.module_id AND lm.is_elevate_program = 1
WHERE NOT EXISTS (
  SELECT 1 FROM elevate_module_assignments a
  WHERE a.beneficiary_id = mc.beneficiary_id AND a.module_id = mc.module_id AND a.assignment_status = 'assigned'
);
