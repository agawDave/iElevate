-- Table: learning_modules
-- The ELEVATE topics from the training design: phase, title, description and hours.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

CREATE TABLE `learning_modules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(180) NOT NULL,
  `phase` varchar(40) NOT NULL,
  `title` varchar(190) NOT NULL,
  `description` varchar(500) NOT NULL,
  `task` varchar(200) DEFAULT NULL,
  `goal_tracks` varchar(100) DEFAULT NULL,
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
