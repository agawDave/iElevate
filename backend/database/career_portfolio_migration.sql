-- Career portfolio (for job applications), the second tab of My Portfolio:
--   * career_profiles: objective, other skills, and which resume shows
--     (built here, or a file they uploaded);
--   * career_entries: the work experience and schooling on the built resume;
--   * career_recommendations: a beneficiary asks the specialist who accepted
--     them on a topic, and the specialist writes it (or declines);
--   * portfolio_items also holds licenses, other trainings and uploaded letters;
--   * show_in_career: the work samples the beneficiary picked for employers.
-- Files live in backend/activity-files/ (never public). Safe to re-run.
USE ielevate_db;

ALTER TABLE portfolio_items
  MODIFY kind ENUM('project','award','photo','license','training','letter') NOT NULL;

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS show_in_career TINYINT(1) NOT NULL DEFAULT 0 AFTER description;

ALTER TABLE module_activity_answers
  ADD COLUMN IF NOT EXISTS show_in_career TINYINT(1) NOT NULL DEFAULT 0 AFTER reflection_updated_at;

CREATE TABLE IF NOT EXISTS career_profiles (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  objective TEXT NULL,
  other_skills VARCHAR(500) NULL,
  resume_mode ENUM('built','uploaded') NOT NULL DEFAULT 'built',
  file_storage_name VARCHAR(80) NULL,
  file_original_name VARCHAR(255) NULL,
  file_mime_type VARCHAR(120) NULL,
  file_size INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_career_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS career_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('work','education') NOT NULL,
  title VARCHAR(190) NOT NULL,          -- job title, or school
  organization VARCHAR(190) NULL,       -- employer, or course / level
  period VARCHAR(60) NULL,              -- free text, e.g. 2024-2025
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_career_entry_owner (user_id, kind),
  CONSTRAINT fk_career_entry_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS career_recommendations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NOT NULL,
  status ENUM('requested','written','declined') NOT NULL DEFAULT 'requested',
  note VARCHAR(500) NULL,               -- the beneficiary's request
  body TEXT NULL,                       -- the specialist's recommendation
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  written_at DATETIME NULL,
  UNIQUE KEY uq_career_recommendation (beneficiary_id, specialist_id, module_id),
  INDEX idx_career_recommendation_specialist (specialist_id, status),
  CONSTRAINT fk_career_rec_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_career_rec_specialist FOREIGN KEY (specialist_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_career_rec_module FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;
