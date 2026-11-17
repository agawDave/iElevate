-- Table: user_learning_circumstances
-- How and when each person can learn or teach: online or face to face, available times, device, internet and barangay.
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

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
