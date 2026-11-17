-- Table: elevate_module_assignments
-- Each beneficiary's ELEVATE topics and where they are with each one: suggested, applied, accepted, waiting, with which specialist and why.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `elevate_module_assignments` (
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned DEFAULT NULL,
  `matched_skill_id` int(10) unsigned NOT NULL,
  `match_score` int(10) unsigned NOT NULL,
  `match_reasons` text DEFAULT NULL,
  `waiting_reason` varchar(255) DEFAULT NULL,
  `assignment_status` enum('suggested','pending','assigned','waiting','queued') NOT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `applied_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`beneficiary_id`,`module_id`),
  KEY `idx_elevate_assignment_specialist` (`specialist_id`,`module_id`,`assignment_status`),
  KEY `fk_elevate_assignment_module` (`module_id`),
  KEY `fk_elevate_assignment_skill` (`matched_skill_id`),
  CONSTRAINT `fk_elevate_assignment_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_elevate_assignment_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_elevate_assignment_skill` FOREIGN KEY (`matched_skill_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_elevate_assignment_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
