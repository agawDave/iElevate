-- Table: career_recommendations
-- Recommendations beneficiaries ask their specialists for, with what the specialist wrote, or that they declined.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `career_recommendations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `status` enum('requested','written','declined') NOT NULL DEFAULT 'requested',
  `note` varchar(500) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT current_timestamp(),
  `written_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_career_recommendation` (`beneficiary_id`,`specialist_id`,`module_id`),
  KEY `idx_career_recommendation_specialist` (`specialist_id`,`status`),
  KEY `fk_career_rec_module` (`module_id`),
  CONSTRAINT `fk_career_rec_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_career_rec_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_career_rec_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
