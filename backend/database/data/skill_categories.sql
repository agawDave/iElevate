-- Reference data: skill_categories
-- The ELEVATE phases, as skill categories.
--
-- Starting data every copy of iELEVATE needs. It's already in
-- ..\setup_fresh_database.sql; import tables\skill_categories.sql first if you use this file on its own.

INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (12,NULL,'ELEVATE Phase 1: Job Readiness','elevate-phase-1-topics','2026-11-04 16:46:12');
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (13,NULL,'ELEVATE Phase 2: Freelancing and Virtual Work','elevate-phase-2-topics','2026-11-04 16:46:12');
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (16,NULL,'ELEVATE Phase 3: Digital Marketing and Entrepreneurship','elevate-phase-3-topics','2026-11-04 17:24:14');
INSERT INTO `skill_categories` (`id`, `parent_id`, `name`, `slug`, `created_at`) VALUES (21,NULL,'ELEVATE Phase 4: Gaming','elevate-phase-4-topics','2026-11-22 20:22:02');
