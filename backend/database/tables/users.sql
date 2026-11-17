-- Table: users
-- Every account: beneficiaries, specialists and admins, with their profile. Passwords are stored only as hashes.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

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
