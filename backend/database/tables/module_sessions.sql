-- Table: module_sessions
-- Face-to-face sessions for a topic: one-on-one (a specialist and a beneficiary) or open (posted by a specialist for anyone who needs the topic), with when, where, seats and the status.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned DEFAULT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT 0,
  `title` varchar(190) DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `meeting_link` varchar(255) DEFAULT NULL,
  `seats` smallint(5) unsigned DEFAULT NULL,
  `status` enum('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  `scheduled_by` bigint(20) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_module_session_scheduler` (`scheduled_by`),
  KEY `idx_module_session_beneficiary` (`beneficiary_id`),
  KEY `idx_module_session_specialist` (`specialist_id`),
  KEY `idx_module_session_pair` (`module_id`,`beneficiary_id`,`specialist_id`),
  CONSTRAINT `fk_module_session_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_session_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_session_scheduler` FOREIGN KEY (`scheduled_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_session_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
