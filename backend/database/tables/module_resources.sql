-- Table: module_resources
-- Materials for a topic: the files and links specialists add.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

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
