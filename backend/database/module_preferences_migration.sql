USE ielevate_db;

CREATE TABLE IF NOT EXISTS user_module_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, module_id),
  CONSTRAINT fk_module_preference_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_preference_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;
