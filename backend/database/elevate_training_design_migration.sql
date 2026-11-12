-- =========================================================
-- ELEVATE training-design modules and circumstance matching
--
-- Run after elevate_curriculum_matching_migration.sql.
--
-- * Each COMPETENCIES/TOPICS row of the Phase 1 and Phase 2 training designs
--   becomes its own learning module with one matching skill. Beneficiaries say
--   which topics they want to learn; specialists say which topics they teach.
-- * "Orientation, Pre-test, Profiling" is the onboarding questionnaire and
--   "Monitoring and Evaluation" is the admin progress report, so neither is a
--   module.
-- * Each user's learning circumstances (learning mode, weekly availability,
--   device and internet access, barangay) are stored so the system can assign
--   the specialist whose circumstances align with the beneficiary's.
-- * The whole-phase Phase 1 and Phase 2 modules are replaced by their topics.
--   Phase 3 and Phase 4 stay hidden (pending) until their resource persons
--   are added to a training design.
-- =========================================================
USE ielevate_db;

CREATE TABLE IF NOT EXISTS user_learning_circumstances (
  user_id           BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  learning_modes    TEXT NULL,          -- JSON array: face_to_face, online, radio
  availability      TEXT NULL,          -- JSON array of weekly slots such as "mon-morning"
  device_access     ENUM('computer','smartphone','none') NULL,   -- beneficiaries
  internet_access   ENUM('stable','slow','none') NULL,           -- beneficiaries
  barangay          VARCHAR(100) NULL,  -- beneficiary's home barangay
  service_barangays TEXT NULL,          -- specialist: JSON array of barangays for face-to-face sessions
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_learning_circumstances_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE elevate_module_assignments
  ADD COLUMN IF NOT EXISTS match_reasons TEXT NULL AFTER match_score,
  ADD COLUMN IF NOT EXISTS waiting_reason VARCHAR(255) NULL AFTER match_reasons;

-- ---------------------------------------------------------
-- Topic skills (one per training-design topic)
-- ---------------------------------------------------------
INSERT IGNORE INTO skill_categories (name, slug) VALUES
  ('ELEVATE Phase 1: Job Readiness', 'elevate-phase-1-topics'),
  ('ELEVATE Phase 2: Freelancing and Virtual Work', 'elevate-phase-2-topics');

INSERT IGNORE INTO skills (category_id, name, slug) VALUES
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-1-topics'), 'Basic Computer Operation', 'elevate-basic-computer-operation'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-1-topics'), 'Google Document', 'elevate-google-document'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-1-topics'), 'Google Slides', 'elevate-google-slides'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-1-topics'), 'Google Spreadsheet', 'elevate-google-spreadsheet'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-1-topics'), 'Basic Internet Operation', 'elevate-basic-internet-operation'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-1-topics'), 'English Communication Training', 'elevate-english-communication'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-2-topics'), 'Freelancing 101', 'elevate-freelancing-101'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-2-topics'), 'Introduction to Online Marketplace', 'elevate-online-marketplace'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-2-topics'), 'Work from Home Basic Set up', 'elevate-work-from-home-setup'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-2-topics'), 'Basics of WordPress', 'elevate-wordpress'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-2-topics'), 'How to become a Virtual Assistant', 'elevate-virtual-assistant');

-- ---------------------------------------------------------
-- Topic modules (hours from the training designs)
-- ---------------------------------------------------------
INSERT IGNORE INTO learning_modules
  (owner_id, slug, phase, title, description, hours, sort_order, approval_status, difficulty, is_elevate_program)
VALUES
  (NULL, 'elevate-basic-computer-operation', 'ELEVATE Phase 1', 'Basic Computer Operation',
   'Lecture and demonstration on operating a computer: the foundation for the productivity, internet, and work-from-home skills in ELEVATE.', 16, 101, 'approved', 'beginner', 1),
  (NULL, 'elevate-google-document', 'ELEVATE Phase 1', 'Google Document',
   'Create, format, and share documents with Google Docs and MS Word.', 8, 102, 'approved', 'beginner', 1),
  (NULL, 'elevate-google-slides', 'ELEVATE Phase 1', 'Google Slides',
   'Build and present slide decks with Google Slides and MS PowerPoint.', 8, 103, 'approved', 'beginner', 1),
  (NULL, 'elevate-google-spreadsheet', 'ELEVATE Phase 1', 'Google Spreadsheet',
   'Organize data and work with formulas in Google Sheets and MS Excel.', 8, 104, 'approved', 'beginner', 1),
  (NULL, 'elevate-basic-internet-operation', 'ELEVATE Phase 1', 'Basic Internet Operation',
   'Use the internet for work: browsing, searching, and sending messages or documents with Gmail.', 16, 105, 'approved', 'beginner', 1),
  (NULL, 'elevate-english-communication', 'ELEVATE Phase 1', 'English Communication Training',
   'Build confidence in English communication for job applications and BPO work, with a pre-assessment and final assessment.', 24, 106, 'approved', 'beginner', 1),
  (NULL, 'elevate-freelancing-101', 'ELEVATE Phase 2', 'Freelancing 101',
   'Learn how freelancing works and how to start a freelance career.', 8, 201, 'approved', 'beginner', 1),
  (NULL, 'elevate-online-marketplace', 'ELEVATE Phase 2', 'Introduction to Online Marketplace',
   'Explore online marketplaces where freelancers find clients and apply for work.', 8, 202, 'approved', 'beginner', 1),
  (NULL, 'elevate-work-from-home-setup', 'ELEVATE Phase 2', 'Work from Home Basic Set up',
   'Prepare a basic work-from-home setup: equipment, connectivity, and remote-work tools.', 8, 203, 'approved', 'beginner', 1),
  (NULL, 'elevate-wordpress', 'ELEVATE Phase 2', 'Basics of WordPress',
   'Build and manage a simple website with WordPress.', 8, 204, 'approved', 'beginner', 1),
  (NULL, 'elevate-virtual-assistant', 'ELEVATE Phase 2', 'How to become a Virtual Assistant',
   'Learn the role, tools, and services of a virtual assistant and how to start a virtual-assistant career.', 8, 205, 'approved', 'beginner', 1);

-- Each topic module is matched through the skill with the same slug.
INSERT IGNORE INTO module_skills (module_id, skill_id, is_primary)
SELECT lm.id, s.id, 1
FROM learning_modules lm
JOIN skills s ON s.slug = lm.slug
WHERE lm.is_elevate_program = 1 AND lm.slug LIKE 'elevate-%' AND lm.slug NOT LIKE 'elevate-phase-%';

-- Official program documents (files go in backend/module-resources/).
INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT lm.id, 'pdf', 'Official ELEVATE Phase 1 Program Document', 'ELEVATE-Phase-1.pdf',
       'elevate-phase-1.pdf', 'application/pdf', 1
FROM learning_modules lm
WHERE lm.slug IN (
    'elevate-basic-computer-operation', 'elevate-google-document', 'elevate-google-slides',
    'elevate-google-spreadsheet', 'elevate-basic-internet-operation', 'elevate-english-communication'
  )
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.original_filename = 'ELEVATE-Phase-1.pdf'
  );

INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT lm.id, 'pdf', 'Official ELEVATE Phase 2 Program Document', 'ELEVATE-Phase-2.pdf',
       'elevate-phase-2.pdf', 'application/pdf', 1
FROM learning_modules lm
WHERE lm.slug IN (
    'elevate-freelancing-101', 'elevate-online-marketplace', 'elevate-work-from-home-setup',
    'elevate-wordpress', 'elevate-virtual-assistant'
  )
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.original_filename = 'ELEVATE-Phase-2.pdf'
  );

-- ---------------------------------------------------------
-- Retire the whole-phase modules
-- ---------------------------------------------------------
DELETE FROM learning_modules WHERE slug IN ('elevate-phase-1', 'elevate-phase-2');
UPDATE learning_modules SET approval_status = 'pending'
WHERE slug IN ('elevate-phase-3', 'elevate-phase-4');
DELETE FROM elevate_module_assignments
WHERE module_id IN (SELECT id FROM learning_modules WHERE slug IN ('elevate-phase-3', 'elevate-phase-4'));

-- conversations.module_id has no foreign key, so remove threads of deleted modules.
DELETE FROM conversations
WHERE module_id IS NOT NULL AND module_id NOT IN (SELECT id FROM learning_modules);
