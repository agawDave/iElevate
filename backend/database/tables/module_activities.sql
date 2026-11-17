-- Table: module_activities
-- Activities a specialist writes for a topic: multiple choice, written tasks and file tasks.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_activities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `activity_type` enum('multiple_choice','written','file') NOT NULL,
  `prompt` varchar(1000) NOT NULL,
  `options` text DEFAULT NULL,
  `correct_option` tinyint(3) unsigned DEFAULT NULL,
  `file_storage_name` varchar(80) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(120) DEFAULT NULL,
  `file_size` int(10) unsigned DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_module_activity_specialist` (`specialist_id`),
  KEY `idx_module_activity_owner` (`module_id`,`specialist_id`,`sort_order`),
  CONSTRAINT `fk_module_activity_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_activity_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
