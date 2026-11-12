-- Run once after schema.sql, modules_migration.sql, and module_preferences_migration.sql.
USE ielevate_db;

CREATE TABLE module_connections (
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NOT NULL,
  connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (beneficiary_id, module_id),
  CONSTRAINT fk_module_connection_beneficiary FOREIGN KEY (beneficiary_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_connection_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE conversations
  ADD COLUMN module_id INT UNSIGNED NULL AFTER exchange_id,
  ADD KEY idx_conversation_user_a (user_a_id);

ALTER TABLE conversations
  DROP INDEX uq_conversation_pair,
  ADD UNIQUE KEY uq_conversation_module_pair (module_id, user_a_id, user_b_id);
