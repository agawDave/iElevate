-- =========================================================
-- ELEVATE skill check (Orientation, Pre-test, Profiling)
--
-- Run after elevate_training_design_migration.sql. Safe to re-run.
--
-- * Beneficiaries take a skill-check questionnaire instead of picking topics
--   by hand. Each topic gets a level from 0 to 3; topics below 2.0 on the
--   learner's goal track become "wants to learn" topics, either active
--   (matched to a specialist now) or next up (queued).
-- * Specialists record, per topic they teach, their level, the learner levels
--   they take, a learner limit, certifications and earlier ELEVATE phases.
-- * Adds the Phase 3 topic modules (Modules 1 to 3 of the Phase 3 training
--   design, also broadcast as Phase 4 "ELEVATE On Air").
-- =========================================================
USE ielevate_db;

-- Part A answers that are not learning circumstances.
CREATE TABLE IF NOT EXISTS elevate_learner_profiles (
  user_id           BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  goal_track        ENUM('job','freelance','business','undecided') NOT NULL,
  used_computer     TINYINT(1) NOT NULL,
  phases_completed  VARCHAR(40) NULL,   -- JSON array of phase numbers, e.g. [1,2]
  sex               ENUM('female','male','prefer_not_to_say') NULL,
  age               TINYINT UNSIGNED NULL,
  work_status       ENUM('unemployed','employed','self_employed','student') NULL,
  completed_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_learner_profile_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One row per topic per attempt. Attempt 1 is the pre-test; later attempts
-- are post-tests, so monitoring and evaluation can compare them.
CREATE TABLE IF NOT EXISTS elevate_skill_assessments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  skill_id        INT UNSIGNED NOT NULL,
  attempt         SMALLINT UNSIGNED NOT NULL,
  test_kind       ENUM('pre','post') NOT NULL,
  self_score      DECIMAL(3,2) NULL,          -- Part B average, 0 to 3
  check_correct   TINYINT UNSIGNED NULL,      -- Part C answers correct
  check_total     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  level           DECIMAL(3,2) NOT NULL,      -- (self + 1.5 x correct) / 2
  band            ENUM('beginner','developing','proficient','strong') NOT NULL,
  flagged         TINYINT(1) NOT NULL DEFAULT 0,
  outcome         ENUM('active','next_up','refresher','peer_helper') NOT NULL,
  outcome_reason  VARCHAR(255) NULL,
  answers         TEXT NULL,                  -- JSON: ratings and chosen options
  taken_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_attempt (user_id, attempt, skill_id),
  CONSTRAINT fk_assessment_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_skill FOREIGN KEY (skill_id)
    REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- wants_to_learn rows: learning_status/status_reason come from the skill check
-- (NULL = picked by hand, treated as active). proficiency holds the learner's band.
-- teaches rows: the rest describe the specialist (Part D).
ALTER TABLE user_skills
  ADD COLUMN IF NOT EXISTS learning_status ENUM('active','next_up') NULL AFTER proficiency,
  ADD COLUMN IF NOT EXISTS status_reason VARCHAR(255) NULL AFTER learning_status,
  ADD COLUMN IF NOT EXISTS learner_levels VARCHAR(40) NULL,          -- JSON: ["beginner","developing"]; NULL = any
  ADD COLUMN IF NOT EXISTS max_learners SMALLINT UNSIGNED NULL,       -- per topic; NULL = no limit
  ADD COLUMN IF NOT EXISTS certifications VARCHAR(500) NULL,          -- JSON array
  ADD COLUMN IF NOT EXISTS elevate_phases_taught VARCHAR(40) NULL;    -- JSON array of phase numbers

-- Next-up topics are listed on the Modules page without a specialist yet.
ALTER TABLE elevate_module_assignments
  MODIFY assignment_status ENUM('assigned','waiting','queued') NOT NULL;

-- ---------------------------------------------------------
-- Phase 3 topics (also taught over radio as Phase 4, ELEVATE On Air)
-- ---------------------------------------------------------
INSERT IGNORE INTO skill_categories (name, slug) VALUES
  ('ELEVATE Phase 3: Digital Marketing and Entrepreneurship', 'elevate-phase-3-topics');

INSERT IGNORE INTO skills (category_id, name, slug) VALUES
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-3-topics'), 'Introduction to Digital Marketing & Entrepreneurship', 'elevate-digital-marketing-intro'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-3-topics'), 'Core Digital Marketing Skills', 'elevate-core-digital-marketing'),
  ((SELECT id FROM skill_categories WHERE slug = 'elevate-phase-3-topics'), 'Building a Digital Business', 'elevate-digital-business');

INSERT IGNORE INTO learning_modules
  (owner_id, slug, phase, title, description, hours, sort_order, approval_status, difficulty, is_elevate_program)
VALUES
  (NULL, 'elevate-digital-marketing-intro', 'ELEVATE Phase 3', 'Introduction to Digital Marketing & Entrepreneurship',
   'The fundamentals of digital marketing and entrepreneurship, career paths in both, and a growth mindset. Also broadcast as ELEVATE On Air.', 8, 301, 'approved', 'beginner', 1),
  (NULL, 'elevate-core-digital-marketing', 'ELEVATE Phase 3', 'Core Digital Marketing Skills',
   'Social media marketing, content creation (writing, visuals, video editing basics), and setting up an online store on platforms such as Shopify or Lazada.', 16, 302, 'approved', 'beginner', 1),
  (NULL, 'elevate-digital-business', 'ELEVATE Phase 3', 'Building a Digital Business',
   'A business plan framework for a digital venture, marketing strategies for launching it, and building its brand.', 16, 303, 'approved', 'beginner', 1);

INSERT IGNORE INTO module_skills (module_id, skill_id, is_primary)
SELECT lm.id, s.id, 1
FROM learning_modules lm
JOIN skills s ON s.slug = lm.slug
WHERE lm.slug IN ('elevate-digital-marketing-intro', 'elevate-core-digital-marketing', 'elevate-digital-business');

-- Official program documents (files go in backend/module-resources/).
INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT lm.id, 'pdf', 'Official ELEVATE Phase 3 Program Document', 'ELEVATE-Phase-3.pdf',
       'elevate-phase-3.pdf', 'application/pdf', 1
FROM learning_modules lm
WHERE lm.slug IN ('elevate-digital-marketing-intro', 'elevate-core-digital-marketing', 'elevate-digital-business')
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.original_filename = 'ELEVATE-Phase-3.pdf'
  );

INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT lm.id, 'pdf', 'Official ELEVATE Phase 4 (On Air) Program Document', 'ELEVATE-Phase-4.pdf',
       'elevate-phase-4.pdf', 'application/pdf', 2
FROM learning_modules lm
WHERE lm.slug IN ('elevate-digital-marketing-intro', 'elevate-core-digital-marketing', 'elevate-digital-business')
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.original_filename = 'ELEVATE-Phase-4.pdf'
  );
