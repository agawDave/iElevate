-- Table: elevate_skill_assessments
-- Skill check results for each skill: the self-rating, the check questions, the level found, and the outcome.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `elevate_skill_assessments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `skill_id` int(10) unsigned NOT NULL,
  `attempt` smallint(5) unsigned NOT NULL,
  `test_kind` enum('pre','post') NOT NULL,
  `self_score` decimal(3,2) DEFAULT NULL,
  `check_correct` tinyint(3) unsigned DEFAULT NULL,
  `check_total` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `level` decimal(3,2) NOT NULL,
  `band` enum('beginner','developing','proficient','strong') NOT NULL,
  `flagged` tinyint(1) NOT NULL DEFAULT 0,
  `outcome` enum('active','next_up','refresher','peer_helper') NOT NULL,
  `outcome_reason` varchar(255) DEFAULT NULL,
  `answers` text DEFAULT NULL,
  `taken_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assessment_attempt` (`user_id`,`attempt`,`skill_id`),
  KEY `fk_assessment_skill` (`skill_id`),
  CONSTRAINT `fk_assessment_skill` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
