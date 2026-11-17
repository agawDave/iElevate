-- Table: career_profiles
-- Each beneficiary's career portfolio: objective, other skills, and their resume (built by iELEVATE or uploaded).
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `career_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `objective` text DEFAULT NULL,
  `other_skills` varchar(500) DEFAULT NULL,
  `resume_mode` enum('built','uploaded') NOT NULL DEFAULT 'built',
  `file_storage_name` varchar(80) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(120) DEFAULT NULL,
  `file_size` int(10) unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_career_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
