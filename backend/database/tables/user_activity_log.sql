-- Table: user_activity_log
-- What people did in iELEVATE, for the admin's activity log.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `user_activity_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `action` varchar(40) NOT NULL,
  `module_id` int(10) unsigned DEFAULT NULL,
  `target_user_id` bigint(20) unsigned DEFAULT NULL,
  `details` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_activity_time` (`created_at`),
  KEY `idx_activity_user` (`user_id`,`created_at`),
  KEY `idx_activity_action` (`action`,`created_at`),
  KEY `fk_activity_target` (`target_user_id`),
  KEY `fk_activity_module` (`module_id`),
  CONSTRAINT `fk_activity_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_activity_target` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
