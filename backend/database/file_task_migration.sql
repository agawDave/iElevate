-- File tasks: a third kind of module activity. The specialist uploads a file
-- they made (a worksheet in Word, a PDF, a spreadsheet, slides or an image);
-- the learner downloads it and answers with their own file, a photo of their
-- paper answer, typed text, or several of these. The specialist reads the
-- answer and replies, as with written tasks.
--
-- Both kinds of file live in backend/activity-files/ (never public) and are
-- streamed through short-lived links, only to the people allowed to see them.
-- Safe to re-run.
USE ielevate_db;

ALTER TABLE module_activities
  MODIFY activity_type ENUM('multiple_choice','written','file') NOT NULL;

ALTER TABLE module_activities
  ADD COLUMN IF NOT EXISTS file_storage_name VARCHAR(80) NULL AFTER correct_option,
  ADD COLUMN IF NOT EXISTS file_original_name VARCHAR(255) NULL AFTER file_storage_name,
  ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR(120) NULL AFTER file_original_name,
  ADD COLUMN IF NOT EXISTS file_size INT UNSIGNED NULL AFTER file_mime_type;

ALTER TABLE module_activity_answers
  ADD COLUMN IF NOT EXISTS file_storage_name VARCHAR(80) NULL AFTER answer_text,
  ADD COLUMN IF NOT EXISTS file_original_name VARCHAR(255) NULL AFTER file_storage_name,
  ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR(120) NULL AFTER file_original_name,
  ADD COLUMN IF NOT EXISTS file_size INT UNSIGNED NULL AFTER file_mime_type;
