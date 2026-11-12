-- Learning portfolio additions:
--   * reflections: "What I learned", written by the learner on each written or
--     file-task answer;
--   * rubric: the specialist's optional 1-4 scores (content, completeness, effort)
--     when replying to a written or file-task answer;
--   * portfolio_items: projects, awards and photos the beneficiary adds
--     themself. Files live in backend/activity-files/ (never public).
-- Safe to re-run.
USE ielevate_db;

ALTER TABLE module_activity_answers
  ADD COLUMN IF NOT EXISTS reflection TEXT NULL AFTER reviewed_at,
  ADD COLUMN IF NOT EXISTS reflection_updated_at DATETIME NULL AFTER reflection,
  ADD COLUMN IF NOT EXISTS rubric_content TINYINT UNSIGNED NULL AFTER feedback,
  ADD COLUMN IF NOT EXISTS rubric_completeness TINYINT UNSIGNED NULL AFTER rubric_content,
  ADD COLUMN IF NOT EXISTS rubric_effort TINYINT UNSIGNED NULL AFTER rubric_completeness;

CREATE TABLE IF NOT EXISTS portfolio_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('project','award','photo') NOT NULL,
  title VARCHAR(190) NOT NULL,
  description TEXT NULL,
  item_date DATE NULL,
  file_storage_name VARCHAR(80) NULL,
  file_original_name VARCHAR(255) NULL,
  file_mime_type VARCHAR(120) NULL,
  file_size INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_portfolio_item_owner (user_id, kind),
  CONSTRAINT fk_portfolio_item_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
