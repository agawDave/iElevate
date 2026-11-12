-- iELEVATE: a fresh, empty database (structure + ELEVATE reference data)
--
-- What it creates: the ielevate_db database with every table, the 16 ELEVATE
-- topics with their skills, and the official program-document entries.
-- No accounts, no learners, no personal data.
--
-- How to run (XAMPP): start MySQL, open phpMyAdmin (http://localhost/phpmyadmin),
-- choose Import, pick this file and click Import. Or in a terminal:
--   C:\xampp\mysql\bin\mysql.exe -u root < backend\database\setup_fresh_database.sql
--
-- Safe on an existing copy: if ielevate_db already has these tables, the import
-- stops at the first table and changes nothing. To start over, delete the
-- ielevate_db database in phpMyAdmin first.
--
-- Made from the project's own database on 2026-11-12 by export_setup_sql.ps1.

CREATE DATABASE IF NOT EXISTS `ielevate_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ielevate_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------- tables
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `career_entries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `kind` enum('work','education') NOT NULL,
  `title` varchar(190) NOT NULL,
  `organization` varchar(190) DEFAULT NULL,
  `period` varchar(60) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_career_entry_owner` (`user_id`,`kind`),
  CONSTRAINT `fk_career_entry_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `career_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `objective` text DEFAULT NULL,
  `other_skills` varchar(500) DEFAULT NULL,
  `resume_mode` enum('built','uploaded') NOT NULL DEFAULT 'built',
  `file_storage_name` varchar(80) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(120) DEFAULT NULL,
  `file_size` int(10) unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_career_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `career_recommendations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `status` enum('requested','written','declined') NOT NULL DEFAULT 'requested',
  `note` varchar(500) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT current_timestamp(),
  `written_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_career_recommendation` (`beneficiary_id`,`specialist_id`,`module_id`),
  KEY `idx_career_recommendation_specialist` (`specialist_id`,`status`),
  KEY `fk_career_rec_module` (`module_id`),
  CONSTRAINT `fk_career_rec_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_career_rec_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_career_rec_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `conversations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_a_id` bigint(20) unsigned NOT NULL,
  `user_b_id` bigint(20) unsigned NOT NULL,
  `exchange_id` bigint(20) unsigned DEFAULT NULL,
  `module_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_module_pair` (`module_id`,`user_a_id`,`user_b_id`),
  KEY `fk_conv_user_b` (`user_b_id`),
  KEY `fk_conv_exchange` (`exchange_id`),
  KEY `idx_conversation_user_a` (`user_a_id`),
  CONSTRAINT `fk_conv_exchange` FOREIGN KEY (`exchange_id`) REFERENCES `skill_exchanges` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_conv_user_a` FOREIGN KEY (`user_a_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_conv_user_b` FOREIGN KEY (`user_b_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `credentials` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exchange_id` bigint(20) unsigned NOT NULL,
  `recipient_id` bigint(20) unsigned NOT NULL,
  `skill_id` int(10) unsigned NOT NULL,
  `issuer_id` bigint(20) unsigned NOT NULL,
  `token_id` varchar(100) DEFAULT NULL,
  `contract_address` varchar(42) DEFAULT NULL,
  `chain` enum('polygon','ethereum','mumbai_testnet','amoy_testnet') NOT NULL DEFAULT 'polygon',
  `tx_hash` varchar(66) DEFAULT NULL,
  `metadata_uri` varchar(255) DEFAULT NULL,
  `status` enum('pending','minted','failed','revoked') NOT NULL DEFAULT 'pending',
  `issued_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_credential_exchange` (`exchange_id`),
  KEY `fk_credential_skill` (`skill_id`),
  KEY `fk_credential_issuer` (`issuer_id`),
  KEY `idx_credential_recipient` (`recipient_id`),
  KEY `idx_credential_status` (`status`),
  CONSTRAINT `fk_credential_exchange` FOREIGN KEY (`exchange_id`) REFERENCES `skill_exchanges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_credential_issuer` FOREIGN KEY (`issuer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_credential_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_credential_skill` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `disputes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exchange_id` bigint(20) unsigned NOT NULL,
  `raised_by` bigint(20) unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `details` text DEFAULT NULL,
  `status` enum('open','under_review','resolved','dismissed') NOT NULL DEFAULT 'open',
  `resolved_by` bigint(20) unsigned DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_dispute_exchange` (`exchange_id`),
  KEY `fk_dispute_raiser` (`raised_by`),
  KEY `fk_dispute_resolver` (`resolved_by`),
  KEY `idx_dispute_status` (`status`),
  CONSTRAINT `fk_dispute_exchange` FOREIGN KEY (`exchange_id`) REFERENCES `skill_exchanges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dispute_raiser` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dispute_resolver` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `elevate_learner_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `goal_track` enum('job','freelance','business','undecided') NOT NULL,
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `elevate_module_assignments` (
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned DEFAULT NULL,
  `matched_skill_id` int(10) unsigned NOT NULL,
  `match_score` int(10) unsigned NOT NULL,
  `match_reasons` text DEFAULT NULL,
  `waiting_reason` varchar(255) DEFAULT NULL,
  `assignment_status` enum('suggested','pending','assigned','waiting','queued') NOT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `applied_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`beneficiary_id`,`module_id`),
  KEY `idx_elevate_assignment_specialist` (`specialist_id`,`module_id`,`assignment_status`),
  KEY `fk_elevate_assignment_module` (`module_id`),
  KEY `fk_elevate_assignment_skill` (`matched_skill_id`),
  CONSTRAINT `fk_elevate_assignment_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_elevate_assignment_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_elevate_assignment_skill` FOREIGN KEY (`matched_skill_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_elevate_assignment_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `learning_modules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(180) NOT NULL,
  `phase` varchar(40) NOT NULL,
  `title` varchar(190) NOT NULL,
  `description` varchar(500) NOT NULL,
  `hours` int(10) unsigned NOT NULL DEFAULT 0,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `owner_id` bigint(20) unsigned DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  `reviewed_by` bigint(20) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `difficulty` enum('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  `is_elevate_program` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `matches` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_a_id` bigint(20) unsigned NOT NULL,
  `user_b_id` bigint(20) unsigned NOT NULL,
  `skill_a_teaches` int(10) unsigned NOT NULL,
  `skill_b_teaches` int(10) unsigned NOT NULL,
  `match_score` decimal(5,2) NOT NULL DEFAULT 0.00,
  `status` enum('suggested','accepted','declined','expired') NOT NULL DEFAULT 'suggested',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_match_pair` (`user_a_id`,`user_b_id`,`skill_a_teaches`,`skill_b_teaches`),
  KEY `fk_match_user_b` (`user_b_id`),
  KEY `fk_match_skill_a` (`skill_a_teaches`),
  KEY `fk_match_skill_b` (`skill_b_teaches`),
  KEY `idx_match_status` (`status`),
  CONSTRAINT `fk_match_skill_a` FOREIGN KEY (`skill_a_teaches`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_match_skill_b` FOREIGN KEY (`skill_b_teaches`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_match_user_a` FOREIGN KEY (`user_a_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_match_user_b` FOREIGN KEY (`user_b_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint(20) unsigned NOT NULL,
  `sender_id` bigint(20) unsigned NOT NULL,
  `body` text NOT NULL,
  `attachment_url` varchar(255) DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_message_sender` (`sender_id`),
  KEY `idx_message_conversation_time` (`conversation_id`,`created_at`),
  CONSTRAINT `fk_message_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_message_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_activities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `activity_type` enum('multiple_choice','written','file') NOT NULL,
  `prompt` varchar(1000) NOT NULL,
  `options` text DEFAULT NULL,
  `correct_option` tinyint(3) unsigned DEFAULT NULL,
  `file_storage_name` varchar(80) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(120) DEFAULT NULL,
  `file_size` int(10) unsigned DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_module_activity_specialist` (`specialist_id`),
  KEY `idx_module_activity_owner` (`module_id`,`specialist_id`,`sort_order`),
  CONSTRAINT `fk_module_activity_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_activity_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_certificates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `certificate_code` char(36) NOT NULL,
  `issued_by` bigint(20) unsigned DEFAULT NULL,
  `file_storage_name` varchar(80) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(100) DEFAULT NULL,
  `file_size` int(10) unsigned DEFAULT NULL,
  `file_uploaded_at` datetime DEFAULT NULL,
  `issued_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `certificate_code` (`certificate_code`),
  UNIQUE KEY `uq_user_module_certificate` (`user_id`,`module_id`),
  KEY `fk_module_certificate_module` (`module_id`),
  CONSTRAINT `fk_module_certificate_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_certificate_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_code_exercises` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `question_id` int(10) unsigned NOT NULL,
  `function_name` varchar(100) NOT NULL,
  `starter_code` mediumtext NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `question_id` (`question_id`),
  CONSTRAINT `fk_code_exercise_question` FOREIGN KEY (`question_id`) REFERENCES `module_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_code_tests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `exercise_id` int(10) unsigned NOT NULL,
  `assertion_expr` varchar(500) NOT NULL,
  `is_hidden` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `fk_code_test_exercise` (`exercise_id`),
  CONSTRAINT `fk_code_test_exercise` FOREIGN KEY (`exercise_id`) REFERENCES `module_code_exercises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_connections` (
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `connected_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`beneficiary_id`,`module_id`),
  KEY `fk_module_connection_module` (`module_id`),
  CONSTRAINT `fk_module_connection_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_connection_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_questions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `question_text` varchar(500) NOT NULL,
  `question_type` enum('mcq','code') NOT NULL DEFAULT 'mcq',
  `option_a` varchar(190) DEFAULT NULL,
  `option_b` varchar(190) DEFAULT NULL,
  `option_c` varchar(190) DEFAULT NULL,
  `correct_option` enum('a','b','c') DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_module_question_order` (`module_id`,`sort_order`),
  CONSTRAINT `fk_module_question_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_resources` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `uploaded_by` bigint(20) unsigned DEFAULT NULL,
  `resource_type` enum('pdf','docx','excel','video','link') NOT NULL,
  `title` varchar(190) NOT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `storage_filename` varchar(80) DEFAULT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `file_size` bigint(20) unsigned DEFAULT NULL,
  `external_url` varchar(2048) DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_module_resource_order` (`module_id`,`sort_order`,`id`),
  KEY `idx_module_resource_uploader` (`module_id`,`uploaded_by`),
  KEY `fk_module_resource_uploader` (`uploaded_by`),
  CONSTRAINT `fk_module_resource_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_resource_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `title` varchar(190) DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `meeting_link` varchar(255) DEFAULT NULL,
  `status` enum('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  `scheduled_by` bigint(20) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_module_session_scheduler` (`scheduled_by`),
  KEY `idx_module_session_beneficiary` (`beneficiary_id`),
  KEY `idx_module_session_specialist` (`specialist_id`),
  KEY `idx_module_session_pair` (`module_id`,`beneficiary_id`,`specialist_id`),
  CONSTRAINT `fk_module_session_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_session_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_session_scheduler` FOREIGN KEY (`scheduled_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_session_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_skills` (
  `module_id` int(10) unsigned NOT NULL,
  `skill_id` int(10) unsigned NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`module_id`,`skill_id`),
  KEY `idx_module_skills_skill_module` (`skill_id`,`module_id`),
  CONSTRAINT `fk_module_skill_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_skill_skill` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_test_attempts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `test_kind` enum('pre','post') NOT NULL,
  `score` smallint(5) unsigned NOT NULL,
  `total` smallint(5) unsigned NOT NULL,
  `answers` text DEFAULT NULL,
  `taken_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_module_test_attempt` (`module_id`,`specialist_id`,`beneficiary_id`,`test_kind`),
  KEY `idx_module_test_attempt_learner` (`beneficiary_id`),
  KEY `fk_module_test_attempt_specialist` (`specialist_id`),
  CONSTRAINT `fk_module_test_attempt_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_test_attempt_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_test_attempt_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_test_questions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `prompt` varchar(1000) NOT NULL,
  `options` text NOT NULL,
  `correct_option` tinyint(3) unsigned NOT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_module_test_question_specialist` (`specialist_id`),
  KEY `idx_module_test_question_owner` (`module_id`,`specialist_id`,`sort_order`),
  CONSTRAINT `fk_module_test_question_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_test_question_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `module_topics` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `topic_name` varchar(100) NOT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_module_topic_order` (`module_id`,`sort_order`,`id`),
  CONSTRAINT `fk_module_topic_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `type` varchar(60) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notification_user_unread` (`user_id`,`read_at`),
  CONSTRAINT `fk_notification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `portfolio_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `kind` enum('project','award','photo','license','training','letter') NOT NULL,
  `title` varchar(190) NOT NULL,
  `description` text DEFAULT NULL,
  `show_in_career` tinyint(1) NOT NULL DEFAULT 0,
  `item_date` date DEFAULT NULL,
  `file_storage_name` varchar(80) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(120) DEFAULT NULL,
  `file_size` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_portfolio_item_owner` (`user_id`,`kind`),
  CONSTRAINT `fk_portfolio_item_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_refresh_user` (`user_id`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exchange_id` bigint(20) unsigned NOT NULL,
  `scheduled_by` bigint(20) unsigned NOT NULL,
  `title` varchar(190) DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `meeting_link` varchar(255) DEFAULT NULL,
  `status` enum('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_session_scheduler` (`scheduled_by`),
  KEY `idx_session_exchange` (`exchange_id`),
  KEY `idx_session_time` (`starts_at`),
  CONSTRAINT `fk_session_exchange` FOREIGN KEY (`exchange_id`) REFERENCES `skill_exchanges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_scheduler` FOREIGN KEY (`scheduled_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `skill_categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `slug` varchar(140) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_category_parent` (`parent_id`),
  CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`) REFERENCES `skill_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `skill_exchanges` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` bigint(20) unsigned NOT NULL,
  `user_a_id` bigint(20) unsigned NOT NULL,
  `user_b_id` bigint(20) unsigned NOT NULL,
  `skill_a_id` int(10) unsigned NOT NULL,
  `skill_b_id` int(10) unsigned NOT NULL,
  `status` enum('proposed','scheduled','in_progress','completed','cancelled','disputed') NOT NULL DEFAULT 'proposed',
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `user_a_rating` tinyint(3) unsigned DEFAULT NULL,
  `user_b_rating` tinyint(3) unsigned DEFAULT NULL,
  `user_a_feedback` varchar(1000) DEFAULT NULL,
  `user_b_feedback` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_exchange_match` (`match_id`),
  KEY `fk_exchange_user_b` (`user_b_id`),
  KEY `fk_exchange_skill_a` (`skill_a_id`),
  KEY `fk_exchange_skill_b` (`skill_b_id`),
  KEY `idx_exchange_status` (`status`),
  KEY `idx_exchange_users` (`user_a_id`,`user_b_id`),
  CONSTRAINT `fk_exchange_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exchange_skill_a` FOREIGN KEY (`skill_a_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exchange_skill_b` FOREIGN KEY (`skill_b_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exchange_user_a` FOREIGN KEY (`user_a_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exchange_user_b` FOREIGN KEY (`user_b_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `skills` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int(10) unsigned NOT NULL,
  `name` varchar(150) NOT NULL,
  `slug` varchar(170) NOT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_skill_category` (`category_id`),
  FULLTEXT KEY `ft_skill_name` (`name`),
  CONSTRAINT `fk_skill_category` FOREIGN KEY (`category_id`) REFERENCES `skill_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `specialist_modules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` int(10) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `title` varchar(160) NOT NULL,
  `overview` varchar(2000) NOT NULL DEFAULT '',
  `hours` smallint(5) unsigned NOT NULL DEFAULT 0,
  `status` enum('draft','pending','approved','changes_requested') NOT NULL DEFAULT 'draft',
  `review_note` varchar(1000) DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` bigint(20) unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_specialist_module` (`topic_id`,`specialist_id`),
  KEY `idx_specialist_modules_status` (`status`,`submitted_at`),
  KEY `idx_specialist_modules_specialist` (`specialist_id`),
  KEY `fk_specialist_module_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_specialist_module_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_specialist_module_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_specialist_module_topic` FOREIGN KEY (`topic_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_activity_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `action` varchar(40) NOT NULL,
  `module_id` int(10) unsigned DEFAULT NULL,
  `target_user_id` bigint(20) unsigned DEFAULT NULL,
  `details` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_activity_time` (`created_at`),
  KEY `idx_activity_user` (`user_id`,`created_at`),
  KEY `idx_activity_action` (`action`,`created_at`),
  KEY `fk_activity_target` (`target_user_id`),
  KEY `fk_activity_module` (`module_id`),
  CONSTRAINT `fk_activity_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_activity_target` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_learning_circumstances` (
  `user_id` bigint(20) unsigned NOT NULL,
  `learning_modes` text DEFAULT NULL,
  `availability` text DEFAULT NULL,
  `device_access` enum('computer','smartphone','none') DEFAULT NULL,
  `internet_access` enum('stable','slow','none') DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `service_barangays` text DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_learning_circumstances_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_module_preferences` (
  `user_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`module_id`),
  KEY `fk_module_preference_module` (`module_id`),
  CONSTRAINT `fk_module_preference_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_preference_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_module_questions` (
  `user_id` bigint(20) unsigned NOT NULL,
  `question_id` int(10) unsigned NOT NULL,
  `completed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `code_submission` mediumtext DEFAULT NULL,
  PRIMARY KEY (`user_id`,`question_id`),
  KEY `fk_user_module_question_question` (`question_id`),
  CONSTRAINT `fk_user_module_question_question` FOREIGN KEY (`question_id`) REFERENCES `module_questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_module_question_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `oauth_provider` enum('local','google','facebook') NOT NULL DEFAULT 'local',
  `oauth_id` varchar(190) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `school_or_org` varchar(190) DEFAULT NULL,
  `sex` enum('female','male','prefer_not_to_say') DEFAULT NULL,
  `age` tinyint(3) unsigned DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  `work_status` enum('unemployed','employed','self_employed','student') DEFAULT NULL,
  `civil_status` enum('single','married','widowed','separated') DEFAULT NULL,
  `education` enum('elementary','high_school','senior_high','vocational','college_level','college_graduate','postgraduate') DEFAULT NULL,
  `sector_tags` varchar(200) DEFAULT NULL,
  `country` varchar(80) DEFAULT NULL,
  `region_code` char(2) DEFAULT NULL,
  `state_region` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `mobile_number` varchar(20) DEFAULT NULL,
  `role` enum('user','admin','moderator') NOT NULL DEFAULT 'user',
  `user_type` enum('specialist','beneficiary') NOT NULL DEFAULT 'beneficiary',
  `status` enum('active','suspended','banned','deleted') NOT NULL DEFAULT 'active',
  `email_verified_at` datetime DEFAULT NULL,
  `wallet_address` varchar(42) DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_oauth` (`oauth_provider`,`oauth_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- ------------------------------------------------- reference data
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (12,NULL,'ELEVATE Phase 1: Job Readiness','elevate-phase-1-topics','2026-11-04 16:46:12'),(13,NULL,'ELEVATE Phase 2: Freelancing and Virtual Work','elevate-phase-2-topics','2026-11-04 16:46:12'),(16,NULL,'ELEVATE Phase 3: Digital Marketing and Entrepreneurship','elevate-phase-3-topics','2026-11-04 17:24:14');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (63,12,'Basic Computer Operation','elevate-basic-computer-operation',1,'2026-11-04 16:46:12'),(64,12,'Google Document','elevate-google-document',1,'2026-11-04 16:46:12'),(65,12,'Google Slides','elevate-google-slides',1,'2026-11-04 16:46:12'),(66,12,'Google Spreadsheet','elevate-google-spreadsheet',1,'2026-11-04 16:46:12'),(67,12,'Basic Internet Operation','elevate-basic-internet-operation',1,'2026-11-04 16:46:12'),(68,12,'English Communication Training','elevate-english-communication',1,'2026-11-04 16:46:12'),(69,13,'Freelancing 101','elevate-freelancing-101',1,'2026-11-04 16:46:12'),(70,13,'Introduction to Online Marketplace','elevate-online-marketplace',1,'2026-11-04 16:46:12'),(71,13,'Work from Home Basic Set up','elevate-work-from-home-setup',1,'2026-11-04 16:46:12'),(72,13,'Basics of WordPress','elevate-wordpress',1,'2026-11-04 16:46:12'),(73,13,'How to become a Virtual Assistant','elevate-virtual-assistant',1,'2026-11-04 16:46:12'),(85,16,'Introduction to Digital Marketing & Entrepreneurship','elevate-digital-marketing-intro',1,'2026-11-04 17:24:14'),(86,16,'Core Digital Marketing Skills','elevate-core-digital-marketing',1,'2026-11-04 17:24:14'),(87,16,'Building a Digital Business','elevate-digital-business',1,'2026-11-04 17:24:14');
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (89,'elevate-phase-3','ELEVATE Phase 3','Digital Marketing and Entrepreneurship','Build digital-marketing and entrepreneurship skills for employment and starting a business.',48,3,'2026-11-04 16:08:58',NULL,'pending',NULL,NULL,'beginner',1),(90,'elevate-phase-4','ELEVATE Phase 4','ELEVATE On Air','Continue ELEVATE digital-marketing and entrepreneurship learning through flexible radio-based delivery.',48,4,'2026-11-04 16:08:58',NULL,'pending',NULL,NULL,'beginner',1),(95,'elevate-basic-computer-operation','ELEVATE Phase 1','Basic Computer Operation','Lecture and demonstration on operating a computer: the foundation for the productivity, internet, and work-from-home skills in ELEVATE.',16,101,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(96,'elevate-google-document','ELEVATE Phase 1','Google Document','Create, format, and share documents with Google Docs and MS Word.',8,102,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(97,'elevate-google-slides','ELEVATE Phase 1','Google Slides','Build and present slide decks with Google Slides and MS PowerPoint.',8,103,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(98,'elevate-google-spreadsheet','ELEVATE Phase 1','Google Spreadsheet','Organize data and work with formulas in Google Sheets and MS Excel.',8,104,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(99,'elevate-basic-internet-operation','ELEVATE Phase 1','Basic Internet Operation','Use the internet for work: browsing, searching, and sending messages or documents with Gmail.',16,105,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(100,'elevate-english-communication','ELEVATE Phase 1','English Communication Training','Build confidence in English communication for job applications and BPO work, with a pre-assessment and final assessment.',24,106,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(101,'elevate-freelancing-101','ELEVATE Phase 2','Freelancing 101','Learn how freelancing works and how to start a freelance career.',8,201,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(102,'elevate-online-marketplace','ELEVATE Phase 2','Introduction to Online Marketplace','Explore online marketplaces where freelancers find clients and apply for work.',8,202,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(103,'elevate-work-from-home-setup','ELEVATE Phase 2','Work from Home Basic Set up','Prepare a basic work-from-home setup: equipment, connectivity, and remote-work tools.',8,203,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(104,'elevate-wordpress','ELEVATE Phase 2','Basics of WordPress','Build and manage a simple website with WordPress.',8,204,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(105,'elevate-virtual-assistant','ELEVATE Phase 2','How to become a Virtual Assistant','Learn the role, tools, and services of a virtual assistant and how to start a virtual-assistant career.',8,205,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1),(117,'elevate-digital-marketing-intro','ELEVATE Phase 3','Introduction to Digital Marketing & Entrepreneurship','The fundamentals of digital marketing and entrepreneurship, career paths in both, and a growth mindset. Also broadcast as ELEVATE On Air.',8,301,'2026-11-04 17:24:14',NULL,'approved',NULL,NULL,'beginner',1),(118,'elevate-core-digital-marketing','ELEVATE Phase 3','Core Digital Marketing Skills','Social media marketing, content creation (writing, visuals, video editing basics), and setting up an online store on platforms such as Shopify or Lazada.',16,302,'2026-11-04 17:24:14',NULL,'approved',NULL,NULL,'beginner',1),(119,'elevate-digital-business','ELEVATE Phase 3','Building a Digital Business','A business plan framework for a digital venture, marketing strategies for launching it, and building its brand.',16,303,'2026-11-04 17:24:14',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (95,63,1,'2026-11-04 16:46:12'),(96,64,1,'2026-11-04 16:46:12'),(97,65,1,'2026-11-04 16:46:12'),(98,66,1,'2026-11-04 16:46:12'),(99,67,1,'2026-11-04 16:46:12'),(100,68,1,'2026-11-04 16:46:12'),(101,69,1,'2026-11-04 16:46:12'),(102,70,1,'2026-11-04 16:46:12'),(103,71,1,'2026-11-04 16:46:12'),(104,72,1,'2026-11-04 16:46:12'),(105,73,1,'2026-11-04 16:46:12'),(117,85,1,'2026-11-04 17:24:14'),(118,86,1,'2026-11-04 17:24:14'),(119,87,1,'2026-11-04 17:24:14');
INSERT INTO `module_resources` (`id`, `module_id`, `uploaded_by`, `resource_type`, `title`, `original_filename`, `storage_filename`, `mime_type`, `file_size`, `external_url`, `sort_order`, `created_at`) VALUES (12,89,NULL,'pdf','Official ELEVATE Phase 3 Program Document','ELEVATE-Phase-3.pdf','elevate-phase-3.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:08:58'),(13,90,NULL,'pdf','Official ELEVATE Phase 4 Program Document','ELEVATE-Phase-4.pdf','elevate-phase-4.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:08:58'),(14,95,NULL,'pdf','Official ELEVATE Phase 1 Program Document','ELEVATE-Phase-1.pdf','elevate-phase-1.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(15,99,NULL,'pdf','Official ELEVATE Phase 1 Program Document','ELEVATE-Phase-1.pdf','elevate-phase-1.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(16,100,NULL,'pdf','Official ELEVATE Phase 1 Program Document','ELEVATE-Phase-1.pdf','elevate-phase-1.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(17,96,NULL,'pdf','Official ELEVATE Phase 1 Program Document','ELEVATE-Phase-1.pdf','elevate-phase-1.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(18,97,NULL,'pdf','Official ELEVATE Phase 1 Program Document','ELEVATE-Phase-1.pdf','elevate-phase-1.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(19,98,NULL,'pdf','Official ELEVATE Phase 1 Program Document','ELEVATE-Phase-1.pdf','elevate-phase-1.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(21,101,NULL,'pdf','Official ELEVATE Phase 2 Program Document','ELEVATE-Phase-2.pdf','elevate-phase-2.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(22,102,NULL,'pdf','Official ELEVATE Phase 2 Program Document','ELEVATE-Phase-2.pdf','elevate-phase-2.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(23,105,NULL,'pdf','Official ELEVATE Phase 2 Program Document','ELEVATE-Phase-2.pdf','elevate-phase-2.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(24,104,NULL,'pdf','Official ELEVATE Phase 2 Program Document','ELEVATE-Phase-2.pdf','elevate-phase-2.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(25,103,NULL,'pdf','Official ELEVATE Phase 2 Program Document','ELEVATE-Phase-2.pdf','elevate-phase-2.pdf','application/pdf',NULL,NULL,1,'2026-11-04 16:46:12'),(34,118,NULL,'pdf','Official ELEVATE Phase 3 Program Document','ELEVATE-Phase-3.pdf','elevate-phase-3.pdf','application/pdf',NULL,NULL,1,'2026-11-04 17:24:14'),(35,119,NULL,'pdf','Official ELEVATE Phase 3 Program Document','ELEVATE-Phase-3.pdf','elevate-phase-3.pdf','application/pdf',NULL,NULL,1,'2026-11-04 17:24:14'),(36,117,NULL,'pdf','Official ELEVATE Phase 3 Program Document','ELEVATE-Phase-3.pdf','elevate-phase-3.pdf','application/pdf',NULL,NULL,1,'2026-11-04 17:24:14'),(37,118,NULL,'pdf','Official ELEVATE Phase 4 (On Air) Program Document','ELEVATE-Phase-4.pdf','elevate-phase-4.pdf','application/pdf',NULL,NULL,2,'2026-11-04 17:24:14'),(38,119,NULL,'pdf','Official ELEVATE Phase 4 (On Air) Program Document','ELEVATE-Phase-4.pdf','elevate-phase-4.pdf','application/pdf',NULL,NULL,2,'2026-11-04 17:24:14'),(39,117,NULL,'pdf','Official ELEVATE Phase 4 (On Air) Program Document','ELEVATE-Phase-4.pdf','elevate-phase-4.pdf','application/pdf',NULL,NULL,2,'2026-11-04 17:24:14');

SET FOREIGN_KEY_CHECKS = 1;
-- Done. Next: sign up in the app, then make your account the admin (see README.md).