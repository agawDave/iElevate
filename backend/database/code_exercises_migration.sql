USE ielevate_db;

ALTER TABLE module_questions ADD COLUMN IF NOT EXISTS question_type ENUM('mcq','code') NOT NULL DEFAULT 'mcq' AFTER question_text;
ALTER TABLE module_questions MODIFY option_a VARCHAR(190) NULL;
ALTER TABLE module_questions MODIFY option_b VARCHAR(190) NULL;
ALTER TABLE module_questions MODIFY option_c VARCHAR(190) NULL;
ALTER TABLE module_questions MODIFY correct_option ENUM('a','b','c') NULL;

ALTER TABLE user_module_questions ADD COLUMN IF NOT EXISTS code_submission MEDIUMTEXT NULL;

-- A coding exercise attached to a module_questions row (question_type = 'code').
-- The specialist supplies starter code and a function the learner must implement.
CREATE TABLE IF NOT EXISTS module_code_exercises (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id INT UNSIGNED NOT NULL UNIQUE,
  function_name VARCHAR(100) NOT NULL,
  starter_code MEDIUMTEXT NOT NULL,
  CONSTRAINT fk_code_exercise_question FOREIGN KEY (question_id)
    REFERENCES module_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Each test case is a single Python boolean expression (e.g. "add(2, 3) == 5"),
-- parsed out of the specialist's uploaded .py file below a "# === TESTS ==="
-- marker. It's evaluated in-browser (Pyodide) against the learner's code, so
-- "hidden" only means "not shown in the UI while solving", not secret from the
-- network payload.
CREATE TABLE IF NOT EXISTS module_code_tests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exercise_id INT UNSIGNED NOT NULL,
  assertion_expr VARCHAR(500) NOT NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_code_test_exercise FOREIGN KEY (exercise_id)
    REFERENCES module_code_exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;
