-- Table: specialist_modules
-- The module each specialist creates for a topic they teach, and the admin's review (draft, waiting, approved, changes requested).
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `specialist_modules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `title` varchar(160) NOT NULL,
  `overview` varchar(2000) NOT NULL DEFAULT '',
  `hours` smallint(5) unsigned NOT NULL DEFAULT 0,
  `status` enum('draft','pending','approved','changes_requested') NOT NULL DEFAULT 'draft',
  `review_note` varchar(1000) DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` bigint(20) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_specialist_module` (`topic_id`,`specialist_id`),
  KEY `idx_specialist_modules_status` (`status`,`submitted_at`),
  KEY `idx_specialist_modules_specialist` (`specialist_id`),
  KEY `fk_specialist_module_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_specialist_module_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_specialist_module_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_specialist_module_topic` FOREIGN KEY (`topic_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
