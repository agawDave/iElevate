-- Topic sessions are looked up by topic and learner-specialist pair, so index
-- that. Also removes messages.resource_id, which a short-lived "ask about this
-- material" chat feature added (dropped in favour of a simpler chat).
USE ielevate_db;

ALTER TABLE module_sessions
  ADD INDEX IF NOT EXISTS idx_module_session_pair (module_id, beneficiary_id, specialist_id);

ALTER TABLE messages
  DROP COLUMN IF EXISTS resource_id;
