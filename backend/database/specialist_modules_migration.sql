USE ielevate_db;

-- Specialists create their own module for each ELEVATE topic they teach.
-- The topic (learning_modules row from the training design) keeps the phase,
-- the skill check and the journey working; the specialist's module gives it
-- their own title, overview and hours. Their materials, activities and
-- pre/post-test stay linked by (topic, specialist) as before.
--
-- A module goes draft -> pending (sent to the admin) -> approved, or back to
-- changes_requested with the admin's note. Beneficiaries can only apply to a
-- specialist whose module for the topic is approved.
CREATE TABLE IF NOT EXISTS specialist_modules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  overview VARCHAR(2000) NOT NULL DEFAULT '',
  hours SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft', 'pending', 'approved', 'changes_requested') NOT NULL DEFAULT 'draft',
  review_note VARCHAR(1000) NULL,
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_specialist_module (topic_id, specialist_id),
  KEY idx_specialist_modules_status (status, submitted_at),
  KEY idx_specialist_modules_specialist (specialist_id),
  CONSTRAINT fk_specialist_module_topic FOREIGN KEY (topic_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_specialist_module_specialist FOREIGN KEY (specialist_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_specialist_module_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
