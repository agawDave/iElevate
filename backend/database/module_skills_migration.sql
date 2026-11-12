USE ielevate_db;

ALTER TABLE learning_modules
  ADD COLUMN IF NOT EXISTS difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner';

CREATE TABLE IF NOT EXISTS module_skills (
  module_id INT UNSIGNED NOT NULL,
  skill_id INT UNSIGNED NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (module_id, skill_id),
  INDEX idx_module_skills_skill_module (skill_id, module_id),
  CONSTRAINT fk_module_skill_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_skill_skill FOREIGN KEY (skill_id)
    REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS idx_user_skills_learning
  ON user_skills (user_id, relation_type, skill_id);
