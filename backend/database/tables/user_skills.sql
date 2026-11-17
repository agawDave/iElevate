-- Table: user_skills
-- Topics a specialist teaches (with their limits and learner levels) and skills a beneficiary is learning.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `user_skills` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `skill_id` int(10) unsigned NOT NULL,
  `relation_type` enum('teaches','wants_to_learn') NOT NULL,
  `proficiency` enum('beginner','intermediate','advanced','expert') DEFAULT NULL,
  `learning_status` enum('active','next_up','completed') DEFAULT NULL,
  `status_reason` varchar(255) DEFAULT NULL,
  `years_experience` decimal(4,1) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `learner_levels` varchar(40) DEFAULT NULL,
  `max_learners` smallint(5) unsigned DEFAULT NULL,
  `certifications` varchar(500) DEFAULT NULL,
  `elevate_phases_taught` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_skill_relation` (`user_id`,`skill_id`,`relation_type`),
  KEY `idx_userskill_lookup` (`skill_id`,`relation_type`),
  KEY `idx_user_skills_learning` (`user_id`,`relation_type`,`skill_id`),
  CONSTRAINT `fk_userskill_skill` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_userskill_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
