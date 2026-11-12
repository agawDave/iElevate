-- Specialist-made certificates. When a specialist marks a learner as completed
-- they upload the certificate they designed (PDF, PNG or JPG). The file lives in
-- backend/certificates/ (never public) and is streamed only to the learner, the
-- specialist who issued it, and admins.
USE ielevate_db;

ALTER TABLE module_certificates
  ADD COLUMN IF NOT EXISTS file_storage_name VARCHAR(80) NULL AFTER issued_by,
  ADD COLUMN IF NOT EXISTS file_original_name VARCHAR(255) NULL AFTER file_storage_name,
  ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR(100) NULL AFTER file_original_name,
  ADD COLUMN IF NOT EXISTS file_size INT UNSIGNED NULL AFTER file_mime_type,
  ADD COLUMN IF NOT EXISTS file_uploaded_at DATETIME NULL AFTER file_size;
