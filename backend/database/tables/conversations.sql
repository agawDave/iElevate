-- Table: conversations
-- Chats between two people, usually a beneficiary and their specialist about a topic.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

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
