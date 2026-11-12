USE ielevate_db;

CREATE TABLE IF NOT EXISTS module_resources (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  resource_type ENUM('pdf','docx','video','link') NOT NULL,
  title VARCHAR(190) NOT NULL,
  original_filename VARCHAR(255) NULL,
  storage_filename VARCHAR(80) NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT UNSIGNED NULL,
  external_url VARCHAR(2048) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_module_resource_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  INDEX idx_module_resource_order (module_id, sort_order, id)
) ENGINE=InnoDB;
