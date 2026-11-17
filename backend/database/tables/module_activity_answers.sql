-- Table: module_activity_answers
-- Beneficiaries' answers to the activities, with the specialist's feedback and rubric scores.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `module_activity_answers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `selected_option` tinyint(3) unsigned DEFAULT NULL,
  `answer_text` text DEFAULT NULL,
  `file_storage_name` varchar(80) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(120) DEFAULT NULL,
  `file_size` int(10) unsigned DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  `attempts` smallint(5) unsigned NOT NULL DEFAULT 1,
  `feedback` text DEFAULT NULL,
  `rubric_content` tinyint(3) unsigned DEFAULT NULL,
  `rubric_completeness` tinyint(3) unsigned DEFAULT NULL,
  `rubric_effort` tinyint(3) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `reflection` text DEFAULT NULL,
  `reflection_updated_at` datetime DEFAULT NULL,
  `show_in_career` tinyint(1) NOT NULL DEFAULT 0,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_activity_answer` (`activity_id`,`beneficiary_id`),
  KEY `fk_activity_answer_beneficiary` (`beneficiary_id`),
  CONSTRAINT `fk_activity_answer_activity` FOREIGN KEY (`activity_id`) REFERENCES `module_activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_activity_answer_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
