-- Table: elevate_application_declines
-- Specialists who declined a beneficiary for a topic, so the beneficiary goes to the next specialist who fits.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `elevate_application_declines` (
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `declined_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`beneficiary_id`,`module_id`,`specialist_id`),
  KEY `fk_application_decline_module` (`module_id`),
  KEY `fk_application_decline_specialist` (`specialist_id`),
  CONSTRAINT `fk_application_decline_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_application_decline_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_application_decline_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
