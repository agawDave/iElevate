-- Table: learning_sessions
-- Online sessions: one each time a beneficiary takes a topic's pre-test or post-test or answers an activity.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `learning_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `kind` enum('pre_test','activity','post_test') NOT NULL,
  `held_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_learning_session_module` (`module_id`),
  KEY `idx_learning_session_beneficiary` (`beneficiary_id`,`held_at`),
  KEY `idx_learning_session_specialist` (`specialist_id`,`held_at`),
  KEY `idx_learning_session_date` (`held_at`),
  CONSTRAINT `fk_learning_session_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_learning_session_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_learning_session_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
