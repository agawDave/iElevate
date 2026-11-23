-- Table: module_prerequisites
-- Which modules a module needs first (a topic waits as "next up" until the beneficiary can do them).
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_prerequisites` (
  `module_id` int(10) unsigned NOT NULL,
  `prerequisite_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`module_id`,`prerequisite_id`),
  KEY `idx_module_prerequisite` (`prerequisite_id`),
  CONSTRAINT `fk_module_prerequisite_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_prerequisite_needs` FOREIGN KEY (`prerequisite_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
