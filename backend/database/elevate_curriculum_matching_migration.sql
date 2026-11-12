USE ielevate_db;

INSERT IGNORE INTO skill_categories (name, slug)
VALUES ('Digital Employment & Entrepreneurship', 'digital-employment-entrepreneurship');

INSERT IGNORE INTO skills (category_id, name, slug) VALUES
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Digital Literacy', 'digital-literacy'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'English Communication', 'english-communication'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Office Productivity Applications', 'office-productivity-applications'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Freelancing', 'freelancing'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Online Marketplace Skills', 'online-marketplace-skills'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Remote Work Setup', 'remote-work-setup'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'WordPress', 'wordpress'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Virtual Assistance', 'virtual-assistance'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Digital Marketing', 'digital-marketing'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Entrepreneurship', 'entrepreneurship'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'E-commerce', 'e-commerce'),
  ((SELECT id FROM skill_categories WHERE slug = 'digital-employment-entrepreneurship'), 'Digital Content Creation', 'digital-content-creation');

ALTER TABLE learning_modules
  ADD COLUMN IF NOT EXISTS is_elevate_program TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS elevate_module_assignments (
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  module_id INT UNSIGNED NOT NULL,
  specialist_id BIGINT UNSIGNED NULL,
  matched_skill_id INT UNSIGNED NOT NULL,
  match_score INT UNSIGNED NOT NULL,
  assignment_status ENUM('assigned', 'waiting') NOT NULL,
  assigned_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (beneficiary_id, module_id),
  INDEX idx_elevate_assignment_specialist (specialist_id, module_id, assignment_status),
  CONSTRAINT fk_elevate_assignment_beneficiary FOREIGN KEY (beneficiary_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_elevate_assignment_module FOREIGN KEY (module_id)
    REFERENCES learning_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_elevate_assignment_specialist FOREIGN KEY (specialist_id)
    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_elevate_assignment_skill FOREIGN KEY (matched_skill_id)
    REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO learning_modules
  (owner_id, slug, phase, title, description, hours, sort_order, approval_status, difficulty, is_elevate_program)
VALUES
  (NULL, 'elevate-phase-1', 'ELEVATE Phase 1', 'Job Readiness: Computer and English Communication',
   'Build basic computer-operation and English-communication competencies for employment readiness.', 96, 1, 'approved', 'beginner', 1),
  (NULL, 'elevate-phase-2', 'ELEVATE Phase 2', 'Freelancing and Virtual Work',
   'Develop freelancing, online marketplace, work-from-home setup, WordPress, and virtual-assistant skills.', 48, 2, 'approved', 'beginner', 1),
  (NULL, 'elevate-phase-3', 'ELEVATE Phase 3', 'Digital Marketing and Entrepreneurship',
   'Build digital-marketing and entrepreneurship skills for employment and starting a business.', 48, 3, 'approved', 'beginner', 1),
  (NULL, 'elevate-phase-4', 'ELEVATE Phase 4', 'ELEVATE On Air',
   'Continue ELEVATE digital-marketing and entrepreneurship learning through flexible radio-based delivery.', 48, 4, 'approved', 'beginner', 1);

UPDATE learning_modules SET is_elevate_program = 1
WHERE slug IN ('elevate-phase-1', 'elevate-phase-2', 'elevate-phase-3', 'elevate-phase-4');

INSERT IGNORE INTO module_skills (module_id, skill_id, is_primary)
SELECT lm.id, s.id,
       IF(s.slug = 'digital-literacy' AND lm.slug = 'elevate-phase-1', 1, 0)
FROM learning_modules lm
JOIN skills s ON s.slug IN ('digital-literacy', 'english-communication', 'office-productivity-applications')
WHERE lm.slug = 'elevate-phase-1';

INSERT IGNORE INTO module_skills (module_id, skill_id, is_primary)
SELECT lm.id, s.id,
       IF(s.slug = 'freelancing' AND lm.slug = 'elevate-phase-2', 1, 0)
FROM learning_modules lm
JOIN skills s ON s.slug IN ('freelancing', 'online-marketplace-skills', 'remote-work-setup', 'wordpress', 'virtual-assistance')
WHERE lm.slug = 'elevate-phase-2';

INSERT IGNORE INTO module_skills (module_id, skill_id, is_primary)
SELECT lm.id, s.id,
       IF(s.slug = 'digital-marketing' AND lm.slug IN ('elevate-phase-3', 'elevate-phase-4'), 1, 0)
FROM learning_modules lm
JOIN skills s ON s.slug IN ('digital-marketing', 'entrepreneurship', 'e-commerce', 'digital-content-creation')
WHERE lm.slug IN ('elevate-phase-3', 'elevate-phase-4');

INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT id, 'pdf', 'Official ELEVATE Phase 1 Program Document', 'ELEVATE-Phase-1.pdf',
       'elevate-phase-1.pdf', 'application/pdf', 1
FROM learning_modules lm
WHERE slug = 'elevate-phase-1'
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.resource_type = 'pdf'
      AND mr.original_filename = 'ELEVATE-Phase-1.pdf'
  );

INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT id, 'pdf', 'Official ELEVATE Phase 2 Program Document', 'ELEVATE-Phase-2.pdf',
       'elevate-phase-2.pdf', 'application/pdf', 1
FROM learning_modules lm
WHERE slug = 'elevate-phase-2'
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.resource_type = 'pdf'
      AND mr.original_filename = 'ELEVATE-Phase-2.pdf'
  );

INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT id, 'pdf', 'Official ELEVATE Phase 3 Program Document', 'ELEVATE-Phase-3.pdf',
       'elevate-phase-3.pdf', 'application/pdf', 1
FROM learning_modules lm
WHERE slug = 'elevate-phase-3'
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.resource_type = 'pdf'
      AND mr.original_filename = 'ELEVATE-Phase-3.pdf'
  );

INSERT INTO module_resources
  (module_id, resource_type, title, original_filename, storage_filename, mime_type, sort_order)
SELECT id, 'pdf', 'Official ELEVATE Phase 4 Program Document', 'ELEVATE-Phase-4.pdf',
       'elevate-phase-4.pdf', 'application/pdf', 1
FROM learning_modules lm
WHERE slug = 'elevate-phase-4'
  AND NOT EXISTS (
    SELECT 1 FROM module_resources mr
    WHERE mr.module_id = lm.id AND mr.resource_type = 'pdf'
      AND mr.original_filename = 'ELEVATE-Phase-4.pdf'
  );
