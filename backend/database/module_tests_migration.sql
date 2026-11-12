-- Pre-test and post-test for each module. The specialist writes multiple-choice
-- questions for each topic they teach; their accepted learners take the same
-- questions twice:
--   pre  - before the activities (the activities open once it's done)
--   post - after all activities are done
-- One attempt of each per learner, so "before 2/5 -> after 5/5" shows what they
-- learned. Each attempt keeps a copy of the questions as they were then.
-- Safe to re-run.
USE ielevate_db;

CREATE TABLE IF NOT EXISTS module_test_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NOT NULL,
  prompt VARCHAR(1000) NOT NULL,
  options TEXT NOT NULL,                    -- JSON array of 2 to 4 choices
  correct_option TINYINT UNSIGNED NOT NULL, -- index into options
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_module_test_question_module FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_test_question_specialist FOREIGN KEY (specialist_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_module_test_question_owner (module_id, specialist_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS module_test_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NOT NULL,   -- whose test it was
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  test_kind ENUM('pre','post') NOT NULL,
  score SMALLINT UNSIGNED NOT NULL,
  total SMALLINT UNSIGNED NOT NULL,
  answers TEXT NULL,                        -- JSON: each question, its choices, the correct one, the learner's pick
  taken_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_module_test_attempt (module_id, specialist_id, beneficiary_id, test_kind),
  INDEX idx_module_test_attempt_learner (beneficiary_id),
  CONSTRAINT fk_module_test_attempt_module FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_test_attempt_specialist FOREIGN KEY (specialist_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_test_attempt_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
