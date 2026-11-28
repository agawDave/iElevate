-- Table: module_test_questions
-- The pre-test and post-test questions a specialist writes for a topic.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_test_questions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `test_kind` enum('pre','post') NOT NULL DEFAULT 'pre',
  `prompt` varchar(1000) NOT NULL,
  `options` text NOT NULL,
  `correct_option` tinyint(3) unsigned NOT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_module_test_question_specialist` (`specialist_id`),
  KEY `idx_module_test_question_owner` (`module_id`,`specialist_id`,`test_kind`,`sort_order`),
  CONSTRAINT `fk_module_test_question_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_test_question_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
