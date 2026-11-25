-- Table: elevate_learner_profiles
-- The skill check's questions about the beneficiary: goal, computer experience, phases already done, and background.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `elevate_learner_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `goal_track` varchar(30) NOT NULL,
  `goal_other` varchar(150) DEFAULT NULL COMMENT 'The goal the beneficiary typed under "Other"; asked about like "Not sure yet" (goal_track)',
  `used_computer` tinyint(1) NOT NULL,
  `phases_completed` varchar(40) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `sex` enum('female','male','prefer_not_to_say') DEFAULT NULL,
  `age` tinyint(3) unsigned DEFAULT NULL,
  `work_status` enum('unemployed','employed','self_employed','student') DEFAULT NULL,
  `completed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_learner_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
