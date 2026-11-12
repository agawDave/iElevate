USE ielevate_db;

CREATE TABLE IF NOT EXISTS learning_modules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  phase VARCHAR(40) NOT NULL,
  title VARCHAR(190) NOT NULL,
  description VARCHAR(500) NOT NULL,
  hours INT UNSIGNED NOT NULL DEFAULT 0,
  difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE learning_modules ADD COLUMN IF NOT EXISTS owner_id BIGINT UNSIGNED NULL;
ALTER TABLE learning_modules ADD COLUMN IF NOT EXISTS approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved';
ALTER TABLE learning_modules ADD COLUMN IF NOT EXISTS reviewed_by BIGINT UNSIGNED NULL;
ALTER TABLE learning_modules ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL;
ALTER TABLE learning_modules ADD COLUMN IF NOT EXISTS difficulty ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner';
CREATE INDEX IF NOT EXISTS idx_user_skills_learning ON user_skills (user_id, relation_type, skill_id);

UPDATE learning_modules SET approval_status = 'approved' WHERE approval_status IS NULL;

CREATE TABLE IF NOT EXISTS module_skills (
  module_id INT UNSIGNED NOT NULL,
  skill_id INT UNSIGNED NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (module_id, skill_id),
  INDEX idx_module_skills_skill_module (skill_id, module_id),
  CONSTRAINT fk_module_skill_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_skill_skill FOREIGN KEY (skill_id)
    REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS module_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(190) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  meeting_link VARCHAR(255) NULL,
  status ENUM('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  scheduled_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_module_session_module FOREIGN KEY (module_id) REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_session_beneficiary FOREIGN KEY (beneficiary_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_session_specialist FOREIGN KEY (specialist_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_session_scheduler FOREIGN KEY (scheduled_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_module_session_beneficiary (beneficiary_id),
  INDEX idx_module_session_specialist (specialist_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS module_questions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  question_text VARCHAR(500) NOT NULL,
  option_a VARCHAR(190) NOT NULL,
  option_b VARCHAR(190) NOT NULL,
  option_c VARCHAR(190) NOT NULL,
  correct_option ENUM('a','b','c') NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_module_question_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  UNIQUE KEY uq_module_question_order (module_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS module_resources (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id INT UNSIGNED NOT NULL,
  resource_type ENUM('pdf','docx','video','link') NOT NULL,
  title VARCHAR(190) NOT NULL,
  original_filename VARCHAR(255) NULL,
  storage_filename VARCHAR(80) NULL,
  mime_type VARCHAR(120) NULL,
  file_size BIGINT UNSIGNED NULL,
  external_url VARCHAR(2048) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_module_resource_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  INDEX idx_module_resource_order (module_id, sort_order, id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_module_questions (
  user_id BIGINT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, question_id),
  CONSTRAINT fk_user_module_question_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_module_question_question FOREIGN KEY (question_id)
    REFERENCES module_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS module_certificates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NOT NULL,
  certificate_code CHAR(36) NOT NULL UNIQUE,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_module_certificate (user_id, module_id),
  CONSTRAINT fk_module_certificate_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_module_certificate_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO learning_modules (slug, phase, title, description, hours, sort_order) VALUES
('digital-foundations-orientation', 'Phase 1', 'Orientation, Pre-test, Profiling', 'Understand your goals and create your learning profile.', 8, 1),
('digital-foundations-computer', 'Phase 1', 'Basic Computer Operation', 'Learn the essential parts and everyday uses of a computer.', 16, 2),
('digital-foundations-documents', 'Phase 1', 'Google Documents', 'Create, edit, and share documents online.', 8, 3),
('digital-foundations-slides', 'Phase 1', 'Google Slides', 'Build clear and useful presentations.', 8, 4),
('digital-foundations-spreadsheet', 'Phase 1', 'Google Spreadsheet', 'Organize information and work with spreadsheet data.', 8, 5),
('digital-foundations-javascript', 'Phase 1', 'JavaScript', 'Learn the basics of programming interactive web pages.', 16, 5),
('digital-foundations-internet', 'Phase 1', 'Basic Internet Operation', 'Navigate the web safely and effectively.', 16, 6),
('digital-foundations-english', 'Phase 1', 'English Communication Training', 'Practice clear communication for study and work.', 24, 7),
('digital-foundations-monitoring', 'Phase 1', 'Monitoring and Evaluation', 'Reflect on progress and identify the next steps.', 8, 8),
('freelancing-orientation', 'Phase 2', 'Orientation, Pre-test, Profiling', 'Prepare your goals for online work.', 4, 9),
('freelancing-101', 'Phase 2', 'Freelancing 101', 'Understand independent project work and client relationships.', 8, 10),
('online-marketplace', 'Phase 2', 'Introduction to Online Marketplace', 'Find clients and projects through online platforms.', 8, 11),
('work-from-home-setup', 'Phase 2', 'Work from Home Basic Set Up', 'Create a reliable and professional remote-work setup.', 8, 12),
('wordpress', 'Phase 2', 'Basics of WordPress', 'Build and manage a basic website.', 8, 13),
('virtual-assistant', 'Phase 2', 'How to become a Virtual Assistant', 'Learn the habits and tools used by virtual assistants.', 8, 14),
('freelancing-monitoring', 'Phase 2', 'Monitoring and Evaluation', 'Review your readiness for online work.', 4, 15),
('marketing-orientation', 'Phase 3', 'Orientation / Profiling', 'Set goals for digital marketing and entrepreneurship.', 4, 16),
('digital-marketing-intro', 'Phase 3', 'Introduction to Digital Marketing & Entrepreneurship', 'Understand digital marketing, entrepreneurship, and career paths.', 8, 17),
('core-digital-marketing', 'Phase 3', 'Core Digital Marketing Skills', 'Create content and understand social and e-commerce platforms.', 16, 18),
('digital-business', 'Phase 3', 'Building a Digital Business', 'Plan a digital venture, brand, and marketing strategy.', 16, 19),
('marketing-monitoring', 'Phase 3', 'Monitoring and Evaluation', 'Measure learning and plan continued growth.', 4, 20),
('on-air-orientation', 'On Air', 'Orientation / Profiling', 'Start your on-air digital marketing learning path.', 4, 21),
('on-air-intro', 'On Air', 'Introduction to Digital Marketing & Entrepreneurship', 'Learn the foundations of digital marketing on air.', 8, 22),
('on-air-core-skills', 'On Air', 'Core Digital Marketing Skills', 'Practice content, social media, and e-commerce basics.', 16, 23),
('on-air-business', 'On Air', 'Building a Digital Business', 'Develop a practical digital business idea.', 16, 24),
('on-air-monitoring', 'On Air', 'Monitoring and Evaluation', 'Review your on-air learning outcomes.', 4, 25);

INSERT IGNORE INTO module_questions (module_id, question_text, option_a, option_b, option_c, correct_option, sort_order)
SELECT id, CONCAT('What is one useful goal when learning ', title, '?'), 'Practice the skill', 'Skip the topic', 'Avoid activities', 'a', 1 FROM learning_modules;
INSERT IGNORE INTO module_questions (module_id, question_text, option_a, option_b, option_c, correct_option, sort_order)
SELECT id, CONCAT('What is a good way to improve your ', title, ' knowledge?'), 'Practice regularly', 'Never review', 'Ignore feedback', 'a', 2 FROM learning_modules;
INSERT IGNORE INTO module_questions (module_id, question_text, option_a, option_b, option_c, correct_option, sort_order)
SELECT id, CONCAT('What should you do after studying ', title, '?'), 'Use it in a small project', 'Forget the lesson', 'Avoid trying it', 'a', 3 FROM learning_modules;
