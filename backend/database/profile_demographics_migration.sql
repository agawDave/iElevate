-- =========================================================
-- Profile = demographic data only
--
-- Run after elevate_skill_check_migration.sql.
--
-- Sex, age, work status and mobile number move to the user's Profile (users
-- table). The skill check and learning circumstances stay on "My Learning
-- Plan". Barangay is entered on the Profile but stays stored in
-- user_learning_circumstances, because matching reads it from there.
-- =========================================================
USE ielevate_db;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sex ENUM('female','male','prefer_not_to_say') NULL AFTER school_or_org,
  ADD COLUMN IF NOT EXISTS age TINYINT UNSIGNED NULL AFTER sex,
  ADD COLUMN IF NOT EXISTS work_status ENUM('unemployed','employed','self_employed','student') NULL AFTER age,
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20) NULL AFTER work_status;

-- Carry over answers given in the skill check before this change.
UPDATE users u
JOIN elevate_learner_profiles p ON p.user_id = u.id
SET u.sex = COALESCE(u.sex, p.sex),
    u.age = COALESCE(u.age, p.age),
    u.work_status = COALESCE(u.work_status, p.work_status);
