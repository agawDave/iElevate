-- =========================================================
-- Specialist learning materials on ELEVATE topic modules
--
-- Run after elevate_training_design_migration.sql.
--
-- Specialists can attach PDF, Word (DOCX), Excel (XLSX/XLS), video files and
-- links to the topics they teach. A row with uploaded_by = NULL is an official
-- program resource visible to everyone in the topic; a row with uploaded_by set
-- is visible only to that specialist and the beneficiaries matched to them.
-- =========================================================
USE ielevate_db;

ALTER TABLE module_resources
  MODIFY resource_type ENUM('pdf','docx','excel','video','link') NOT NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by BIGINT UNSIGNED NULL AFTER module_id,
  ADD INDEX IF NOT EXISTS idx_module_resource_uploader (module_id, uploaded_by);

ALTER TABLE module_resources
  ADD CONSTRAINT fk_module_resource_uploader FOREIGN KEY IF NOT EXISTS (uploaded_by)
    REFERENCES users(id) ON DELETE CASCADE;
