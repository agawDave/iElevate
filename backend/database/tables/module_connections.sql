-- Table: module_connections
-- Topics a beneficiary has been accepted into (recorded when a specialist accepts them, so they can chat), and when the specialist opened their post-test.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_connections` (
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `connected_at` datetime NOT NULL DEFAULT current_timestamp(),
  `post_test_opened_at` datetime DEFAULT NULL,
  PRIMARY KEY (`beneficiary_id`,`module_id`),
  KEY `fk_module_connection_module` (`module_id`),
  CONSTRAINT `fk_module_connection_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_connection_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
