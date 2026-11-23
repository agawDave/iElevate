-- Table: module_session_attendees
-- Beneficiaries who joined an open face-to-face session, and whether they came.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_session_attendees` (
  `session_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT current_timestamp(),
  `attended` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`session_id`,`beneficiary_id`),
  KEY `idx_session_attendee_beneficiary` (`beneficiary_id`),
  CONSTRAINT `fk_session_attendee_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_attendee_session` FOREIGN KEY (`session_id`) REFERENCES `module_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
