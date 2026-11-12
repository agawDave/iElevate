USE ielevate_db;

CREATE TABLE IF NOT EXISTS module_topics (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  topic_name VARCHAR(100) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_module_topic_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  INDEX idx_module_topic_order (module_id, sort_order, id)
) ENGINE=InnoDB;
