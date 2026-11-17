-- Table: module_test_attempts
-- Beneficiaries' pre-test and post-test scores, each with a copy of the questions as they were.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_test_attempts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `test_kind` enum('pre','post') NOT NULL,
  `score` smallint(5) unsigned NOT NULL,
  `total` smallint(5) unsigned NOT NULL,
  `answers` text DEFAULT NULL,
  `taken_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_module_test_attempt` (`module_id`,`specialist_id`,`beneficiary_id`,`test_kind`),
  KEY `idx_module_test_attempt_learner` (`beneficiary_id`),
  KEY `fk_module_test_attempt_specialist` (`specialist_id`),
  CONSTRAINT `fk_module_test_attempt_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_test_attempt_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_test_attempt_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
