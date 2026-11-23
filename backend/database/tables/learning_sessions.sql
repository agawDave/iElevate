-- Table: learning_sessions
-- Online sessions: one per beneficiary, module and day the beneficiary worked on it online (activity answers, topic tests).
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `learning_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `session_date` date NOT NULL,
  `started_at` datetime NOT NULL,
  `ended_at` datetime NOT NULL,
  `answers` smallint(5) unsigned NOT NULL DEFAULT 0,
  `pre_test` tinyint(1) NOT NULL DEFAULT 0,
  `post_test` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_learning_session_day` (`module_id`,`beneficiary_id`,`specialist_id`,`session_date`),
  KEY `idx_learning_session_beneficiary` (`beneficiary_id`,`session_date`),
  KEY `idx_learning_session_specialist` (`specialist_id`,`session_date`),
  KEY `idx_learning_session_date` (`session_date`),
  CONSTRAINT `fk_learning_session_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_learning_session_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_learning_session_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
