-- Table: program_goals
-- The answers to the pre-assessment's "What is your main goal in joining ELEVATE?" question, managed by the admin; modules list the goals that need them (learning_modules.goal_tracks), and "Not sure yet" asks about the phase in start_phase (0 = all phases; normal goals leave it empty).
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `program_goals` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `value` varchar(30) NOT NULL,
  `label` varchar(150) NOT NULL,
  `start_phase` tinyint(3) unsigned DEFAULT NULL COMMENT 'Only for "Not sure yet": the phase it starts from, 0 = all phases; NULL = a normal goal',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_program_goals_value` (`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
