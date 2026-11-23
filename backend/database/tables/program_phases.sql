-- Table: program_phases
-- The ELEVATE phases: number, name and the year each was created (its modules have learning_modules.phase).
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `program_phases` (
  `number` tinyint(3) unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `year` smallint(5) unsigned DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`number`),
  KEY `fk_program_phase_creator` (`created_by`),
  CONSTRAINT `fk_program_phase_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
