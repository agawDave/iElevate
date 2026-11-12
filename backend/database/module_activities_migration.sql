-- Specialist-made module activities. Each specialist adds activities to the
-- topics they teach; their accepted learners answer them on the module page.
--   multiple_choice - 2 to 4 choices, checked automatically (try again until right)
--   written         - a written answer the specialist reads and replies to
USE ielevate_db;

CREATE TABLE IF NOT EXISTS module_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NOT NULL,
  activity_type ENUM('multiple_choice','written') NOT NULL,
  prompt VARCHAR(1000) NOT NULL,
  options TEXT NULL,                       -- JSON array of choices (multiple choice)
  correct_option TINYINT UNSIGNED NULL,    -- index into options
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_module_activity_module FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_activity_specialist FOREIGN KEY (specialist_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_module_activity_owner (module_id, specialist_id, sort_order)
) ENGINE=InnoDB;

-- A learner's latest answer to an activity.
CREATE TABLE IF NOT EXISTS module_activity_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_id BIGINT UNSIGNED NOT NULL,
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  selected_option TINYINT UNSIGNED NULL,   -- multiple choice
  answer_text TEXT NULL,                   -- written
  is_correct TINYINT(1) NULL,              -- multiple choice only
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  feedback TEXT NULL,                      -- the specialist's reply to a written answer
  reviewed_at DATETIME NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_activity_answer (activity_id, beneficiary_id),
  CONSTRAINT fk_activity_answer_activity FOREIGN KEY (activity_id) REFERENCES module_activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_answer_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
