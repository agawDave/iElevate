-- iELEVATE: a fresh, empty database (structure + ELEVATE reference data)
--
-- What it creates: the ielevate_db database with every table, the ELEVATE
-- topics with their skills.
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
-- To read one table at a time, see the tables\ folder (one file per table) and
-- the data\ folder (the reference data). This file is all of them together.
--
-- Made from the project's own database on 2026-11-27 by export_setup_sql.ps1.

CREATE DATABASE IF NOT EXISTS `ielevate_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ielevate_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- Tables (33)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- career_entries: Work and education lines in a beneficiary's career portfolio.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- career_profiles: Each beneficiary's career portfolio: objective, other skills, and their resume (built by iELEVATE or uploaded).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- career_recommendations: Recommendations beneficiaries ask their specialists for, with what the specialist wrote, or that they declined.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- conversations: Chats between two people: a beneficiary and their specialist about a topic, or the admin and a beneficiary or specialist (module_id empty).
-- ----------------------------------------------------------------------------
CREATE TABLE `conversations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_a_id` bigint(20) unsigned NOT NULL,
  `user_b_id` bigint(20) unsigned NOT NULL,
  `module_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_module_pair` (`module_id`,`user_a_id`,`user_b_id`),
  KEY `fk_conv_user_b` (`user_b_id`),
  KEY `idx_conversation_user_a` (`user_a_id`),
  CONSTRAINT `fk_conv_user_a` FOREIGN KEY (`user_a_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_conv_user_b` FOREIGN KEY (`user_b_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- elevate_application_declines: Specialists who declined a beneficiary for a topic, so the beneficiary goes to the next specialist who fits.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- elevate_learner_profiles: The skill check's questions about the beneficiary: goal, computer experience, phases already done, and background.
-- ----------------------------------------------------------------------------
CREATE TABLE `elevate_learner_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `goal_track` varchar(30) NOT NULL,
  `goal_other` varchar(150) DEFAULT NULL COMMENT 'The goal the beneficiary typed under "Other"; asked about like "Not sure yet" (goal_track)',
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

-- ----------------------------------------------------------------------------
-- elevate_module_assignments: Each beneficiary's ELEVATE topics and where they are with each one: suggested, applied, accepted, waiting, with which specialist and why.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- elevate_skill_assessments: Skill check results for each skill: the self-rating, the check questions, the level found, and the outcome.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- learning_modules: The ELEVATE topics from the training design: phase, title, description and hours.
-- ----------------------------------------------------------------------------
CREATE TABLE `learning_modules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(180) NOT NULL,
  `phase` varchar(40) NOT NULL,
  `title` varchar(190) NOT NULL,
  `description` varchar(500) NOT NULL,
  `task` varchar(200) DEFAULT NULL,
  `goal_tracks` varchar(500) DEFAULT NULL,
  `uses_computer` tinyint(1) NOT NULL DEFAULT 0,
  `recommend_as_foundation` tinyint(1) NOT NULL DEFAULT 0,
  `learner_note` varchar(255) DEFAULT NULL,
  `is_hidden` tinyint(1) NOT NULL DEFAULT 0,
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

-- ----------------------------------------------------------------------------
-- learning_sessions: Online sessions: one each time a beneficiary takes a topic's pre-test or post-test or answers an activity.
-- ----------------------------------------------------------------------------
CREATE TABLE `learning_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `kind` enum('pre_test','activity','post_test') NOT NULL,
  `held_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_learning_session_module` (`module_id`),
  KEY `idx_learning_session_beneficiary` (`beneficiary_id`,`held_at`),
  KEY `idx_learning_session_specialist` (`specialist_id`,`held_at`),
  KEY `idx_learning_session_date` (`held_at`),
  CONSTRAINT `fk_learning_session_beneficiary` FOREIGN KEY (`beneficiary_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_learning_session_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_learning_session_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- messages: The messages in each conversation, with attachments and when they were read.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_activities: Activities a specialist writes for a topic: multiple choice, written tasks and file tasks.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_activity_answers: Beneficiaries' answers to the activities, with the specialist's feedback and rubric scores.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_certificates: The certificate a specialist uploads when a beneficiary completes a topic.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_connections: Topics a beneficiary has been accepted into (recorded when a specialist accepts them, so they can chat).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_prerequisites: Which modules a module needs first (a topic waits as "next up" until the beneficiary can do them).
-- ----------------------------------------------------------------------------
CREATE TABLE `module_prerequisites` (
  `module_id` int(10) unsigned NOT NULL,
  `prerequisite_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`module_id`,`prerequisite_id`),
  KEY `idx_module_prerequisite` (`prerequisite_id`),
  CONSTRAINT `fk_module_prerequisite_module` FOREIGN KEY (`module_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_module_prerequisite_needs` FOREIGN KEY (`prerequisite_id`) REFERENCES `learning_modules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- module_resources: Materials for a topic: the files and links specialists add.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_session_attendees: Beneficiaries who joined an open face-to-face session, and whether they came.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_sessions: Face-to-face sessions for a topic: one-on-one (a specialist and a beneficiary) or open (posted by a specialist for anyone who needs the topic), with when, where, seats and the status.
-- ----------------------------------------------------------------------------
CREATE TABLE `module_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `module_id` int(10) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned DEFAULT NULL,
  `specialist_id` bigint(20) unsigned NOT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT 0,
  `title` varchar(190) DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `meeting_link` varchar(255) DEFAULT NULL,
  `seats` smallint(5) unsigned DEFAULT NULL,
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

-- ----------------------------------------------------------------------------
-- module_skills: Which skill each ELEVATE topic teaches (links learning_modules to skills).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_test_attempts: Beneficiaries' pre-test and post-test scores, each with a copy of the questions as they were.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- module_test_questions: The pre-test and post-test questions a specialist writes for a topic.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- notifications: The notification bell: face-to-face session notices for each person (requested, accepted, cancelled, posted, joined), and when they read each one.
-- ----------------------------------------------------------------------------
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `body` varchar(500) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`,`id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- portfolio_items: What beneficiaries add to their portfolio: projects, awards, photos, licenses, trainings and letters.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- program_goals: The answers to the pre-assessment's "What is your main goal in joining ELEVATE?" question, managed by the admin; modules list the goals that need them (learning_modules.goal_tracks), and "Not sure yet" asks about the phase in start_phase (0 = all phases; normal goals leave it empty).
-- ----------------------------------------------------------------------------
CREATE TABLE `program_goals` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `value` varchar(30) NOT NULL,
  `label` varchar(150) NOT NULL,
  `start_phase` tinyint(3) unsigned DEFAULT NULL COMMENT 'Only for "Not sure yet": the phase it starts from, 0 = all phases; NULL = a normal goal',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_program_goals_value` (`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- program_phases: The ELEVATE phases: number, name and the year each was created (its modules have learning_modules.phase).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- skill_categories: Groups of skills: the ELEVATE phases.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- skills: The skills behind the ELEVATE topics.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- specialist_modules: The module each specialist creates for a topic they teach, and the admin's review (draft, waiting, approved, changes requested).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- user_activity_log: What people did in iELEVATE, for the admin's activity log.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- user_learning_circumstances: How and when each person can learn or teach: online or face to face, available times, device, internet and barangay.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- user_skills: Topics a specialist teaches (with their limits and learner levels) and skills a beneficiary is learning.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- users: Every account: beneficiaries, specialists and admins, with their profile. Passwords are stored only as hashes.
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- Reference data
-- ============================================================================

-- skill_categories: The ELEVATE phases, as skill categories.
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (12,NULL,'ELEVATE Phase 1: Job Readiness','elevate-phase-1-topics','2026-11-04 16:46:12');
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (13,NULL,'ELEVATE Phase 2: Freelancing and Virtual Work','elevate-phase-2-topics','2026-11-04 16:46:12');
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (16,NULL,'ELEVATE Phase 3: Digital Marketing and Entrepreneurship','elevate-phase-3-topics','2026-11-04 17:24:14');
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (22,NULL,'ELEVATE Phase 4: gaming','elevate-phase-4-topics','2026-11-23 20:52:52');

-- skills: The skills behind the ELEVATE topics.
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (63,12,'Basic Computer Operation','elevate-basic-computer-operation',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (64,12,'Google Document','elevate-google-document',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (65,12,'Google Slides','elevate-google-slides',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (66,12,'Google Spreadsheet','elevate-google-spreadsheet',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (67,12,'Basic Internet Operation','elevate-basic-internet-operation',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (68,12,'English Communication Training','elevate-english-communication',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (69,13,'Freelancing 101','elevate-freelancing-101',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (70,13,'Introduction to Online Marketplace','elevate-online-marketplace',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (71,13,'Work from Home Basic Set up','elevate-work-from-home-setup',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (72,13,'Basics of WordPress','elevate-wordpress',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (73,13,'How to become a Virtual Assistant','elevate-virtual-assistant',1,'2026-11-04 16:46:12');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (85,16,'Introduction to Digital Marketing & Entrepreneurship','elevate-digital-marketing-intro',1,'2026-11-04 17:24:14');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (86,16,'Core Digital Marketing Skills','elevate-core-digital-marketing',1,'2026-11-04 17:24:14');
INSERT INTO `skills` (`id`, `category_id`, `name`, `slug`, `is_approved`, `created_at`) VALUES (87,16,'Building a Digital Business','elevate-digital-business',1,'2026-11-04 17:24:14');

-- learning_modules: The ELEVATE modules from the training design, with each one's pre-assessment task and goals.
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (89,'elevate-phase-3','ELEVATE Phase 3','Digital Marketing and Entrepreneurship','Build digital-marketing and entrepreneurship skills for employment and starting a business.',NULL,NULL,0,0,NULL,0,48,3,'2026-11-04 16:08:58',NULL,'pending',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (90,'elevate-phase-4','ELEVATE Phase 4','ELEVATE On Air','Continue ELEVATE digital-marketing and entrepreneurship learning through flexible radio-based delivery.',NULL,NULL,0,0,NULL,0,48,4,'2026-11-04 16:08:58',NULL,'pending',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (95,'elevate-basic-computer-operation','ELEVATE Phase 1','Basic Computer Operation','Lecture and demonstration on operating a computer: the foundation for the productivity, internet, and work-from-home skills in ELEVATE.','Turn on a computer, use the mouse and keyboard, and save and find files','[\"job\",\"freelance\",\"business\"]',1,1,NULL,0,16,101,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (96,'elevate-google-document','ELEVATE Phase 1','Google Document','Create, format, and share documents with Google Docs and MS Word.','Write and format a document in Google Docs or MS Word','[\"job\",\"freelance\"]',1,0,NULL,0,8,102,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (97,'elevate-google-slides','ELEVATE Phase 1','Google Slides','Build and present slide decks with Google Slides and MS PowerPoint.','Make a slide presentation in Google Slides or PowerPoint','[\"job\",\"freelance\"]',1,0,NULL,0,8,103,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (98,'elevate-google-spreadsheet','ELEVATE Phase 1','Google Spreadsheet','Organize data and work with formulas in Google Sheets and MS Excel.','Organize data and use simple formulas in Google Sheets or Excel','[\"job\",\"freelance\",\"business\"]',1,0,NULL,0,8,104,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (99,'elevate-basic-internet-operation','ELEVATE Phase 1','Basic Internet Operation','Use the internet for work: browsing, searching, and sending messages or documents with Gmail.','Search the internet and send emails with attachments in Gmail','[\"job\",\"freelance\",\"business\"]',0,0,NULL,0,16,105,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (100,'elevate-english-communication','ELEVATE Phase 1','English Communication Training','Build confidence in English communication for job applications and BPO work, with a pre-assessment and final assessment.','Answer job interview questions in English','[\"job\",\"freelance\"]',0,0,'Your specialist will confirm your English level in a short spoken check.',0,24,106,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (101,'elevate-freelancing-101','ELEVATE Phase 2','Freelancing 101','Learn how freelancing works and how to start a freelance career.','Explain what freelancing is and how freelancers get paid','[\"freelance\"]',0,0,NULL,0,8,201,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (102,'elevate-online-marketplace','ELEVATE Phase 2','Introduction to Online Marketplace','Explore online marketplaces where freelancers find clients and apply for work.','Create a profile and apply for work on a site like Upwork or OnlineJobs.ph','[\"freelance\"]',0,0,NULL,0,8,202,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (103,'elevate-work-from-home-setup','ELEVATE Phase 2','Work from Home Basic Set up','Prepare a basic work-from-home setup: equipment, connectivity, and remote-work tools.','Set up a device, internet and tools for working from home','[\"freelance\"]',0,0,NULL,0,8,203,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (104,'elevate-wordpress','ELEVATE Phase 2','Basics of WordPress','Build and manage a simple website with WordPress.','Build or edit a simple website in WordPress','[\"freelance\"]',0,0,NULL,0,8,204,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (105,'elevate-virtual-assistant','ELEVATE Phase 2','How to become a Virtual Assistant','Learn the role, tools, and services of a virtual assistant and how to start a virtual-assistant career.','Do virtual-assistant tasks such as managing a client’s email and schedule','[\"freelance\"]',0,0,NULL,0,8,205,'2026-11-04 16:46:12',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (117,'elevate-digital-marketing-intro','ELEVATE Phase 3','Introduction to Digital Marketing & Entrepreneurship','The fundamentals of digital marketing and entrepreneurship, career paths in both, and a growth mindset. Also broadcast as ELEVATE On Air.','Explain how digital marketing helps a small business sell.','[\"business\"]',0,1,NULL,0,8,301,'2026-11-04 17:24:14',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (118,'elevate-core-digital-marketing','ELEVATE Phase 3','Core Digital Marketing Skills','Social media marketing, content creation (writing, visuals, video editing basics), and setting up an online store on platforms such as Shopify or Lazada.','Make social media posts that promote a product','[\"business\"]',0,0,NULL,0,16,302,'2026-11-04 17:24:14',NULL,'approved',NULL,NULL,'beginner',1);
INSERT INTO `learning_modules` (`id`, `slug`, `phase`, `title`, `description`, `task`, `goal_tracks`, `uses_computer`, `recommend_as_foundation`, `learner_note`, `is_hidden`, `hours`, `sort_order`, `created_at`, `owner_id`, `approval_status`, `reviewed_by`, `reviewed_at`, `difficulty`, `is_elevate_program`) VALUES (119,'elevate-digital-business','ELEVATE Phase 3','Building a Digital Business','A business plan framework for a digital venture, marketing strategies for launching it, and building its brand.','Write a simple business plan for selling online','[\"business\"]',0,0,NULL,0,16,303,'2026-11-04 17:24:14',NULL,'approved',NULL,NULL,'beginner',1);

-- module_skills: Which skill each ELEVATE topic teaches.
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (95,63,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (96,64,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (97,65,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (98,66,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (99,67,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (100,68,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (101,69,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (102,70,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (103,71,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (104,72,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (105,73,1,'2026-11-04 16:46:12');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (117,85,1,'2026-11-04 17:24:14');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (118,86,1,'2026-11-04 17:24:14');
INSERT INTO `module_skills` (`module_id`, `skill_id`, `is_primary`, `created_at`) VALUES (119,87,1,'2026-11-04 17:24:14');

-- module_prerequisites: Which modules a module needs first.
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (96,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (97,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (98,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (101,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (102,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (102,100);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (103,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (104,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (104,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,96);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,98);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,100);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (118,117);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (119,117);

-- program_phases: The ELEVATE phases, with the year each was created.
INSERT INTO `program_phases` (`number`, `name`, `year`, `created_by`, `created_at`) VALUES (1,'Job Readiness',2021,NULL,'2026-11-22 19:12:44');
INSERT INTO `program_phases` (`number`, `name`, `year`, `created_by`, `created_at`) VALUES (2,'Freelancing and Virtual Work',NULL,NULL,'2026-11-22 19:12:44');
INSERT INTO `program_phases` (`number`, `name`, `year`, `created_by`, `created_at`) VALUES (3,'Digital Marketing and Entrepreneurship',NULL,NULL,'2026-11-22 19:12:44');
INSERT INTO `program_phases` (`number`, `name`, `year`, `created_by`, `created_at`) VALUES (4,'gaming',2026,5,'2026-11-23 20:52:52');

-- program_goals: The main goals beneficiaries choose from in the pre-assessment.
INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (1,'job','Get hired for an office or BPO job',NULL);
INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (2,'freelance','Work from home as a freelancer or virtual assistant',NULL);
INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (3,'business','Start or grow my own online business',NULL);
INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (4,'undecided','Not sure yet',1);

SET FOREIGN_KEY_CHECKS = 1;
-- Done. Next: sign up in the app, then make your account the admin (see README.md).
