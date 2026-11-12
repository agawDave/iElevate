-- =========================================================
-- Project-advisor feedback (profiling, chat status, analytics)
--
-- Run after profile_demographics_migration.sql. Safe to re-run.
--
-- * Profile: birthdate, civil status, highest education, sector tags, and a
--   typed address (country; for the Philippines a PSGC region code, province,
--   city/municipality and barangay; elsewhere state/region and city).
-- * Matching reads the learner's barangay and city from
--   user_learning_circumstances, so city is stored there too.
-- * Skill check: a free-text "Tell us more" note the specialist can read.
-- * A specialist marks a learner as completed, which issues the certificate.
-- =========================================================
USE ielevate_db;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birthdate DATE NULL AFTER age,
  ADD COLUMN IF NOT EXISTS civil_status ENUM('single','married','widowed','separated') NULL AFTER work_status,
  ADD COLUMN IF NOT EXISTS education ENUM('elementary','high_school','senior_high','vocational',
    'college_level','college_graduate','postgraduate') NULL AFTER civil_status,
  ADD COLUMN IF NOT EXISTS sector_tags VARCHAR(200) NULL AFTER education,   -- JSON array
  ADD COLUMN IF NOT EXISTS country VARCHAR(80) NULL AFTER sector_tags,
  ADD COLUMN IF NOT EXISTS region_code CHAR(2) NULL AFTER country,          -- PSGC region code (Philippines)
  ADD COLUMN IF NOT EXISTS state_region VARCHAR(100) NULL AFTER region_code, -- outside the Philippines
  ADD COLUMN IF NOT EXISTS province VARCHAR(100) NULL AFTER state_region,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL AFTER province;

ALTER TABLE user_learning_circumstances
  ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL AFTER barangay;

ALTER TABLE elevate_learner_profiles
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER phases_completed;

ALTER TABLE module_certificates
  ADD COLUMN IF NOT EXISTS issued_by BIGINT UNSIGNED NULL AFTER certificate_code;

-- A completed topic keeps its specialist and frees an active slot.
ALTER TABLE user_skills
  MODIFY learning_status ENUM('active','next_up','completed') NULL;

-- Beneficiaries who already gave a barangay joined ELEVATE in Tuburan, Cebu
-- (Region VII). Fill in the rest of their address once; they can change it.
UPDATE users u
JOIN user_learning_circumstances c ON c.user_id = u.id
SET u.country = 'Philippines', u.region_code = '07', u.province = 'Cebu', u.city = 'Tuburan',
    c.city = COALESCE(c.city, 'Tuburan')
WHERE u.user_type = 'beneficiary' AND u.country IS NULL AND c.barangay IS NOT NULL;
