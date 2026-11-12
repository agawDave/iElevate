const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { resourceDirectory } = require('../middleware/moduleResourceUpload');
const {
  recomputeElevateAssignments,
} = require('../services/elevateAssignmentService');

function parseReasons(value) {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((reason) => typeof reason === 'string') : [];
  } catch {
    return [];
  }
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function listModules(req, res) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 12 : Number(req.query.limit);
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const skillId = req.query.skillId ? Number(req.query.skillId) : null;
  const difficulty = ['beginner', 'intermediate', 'advanced'].includes(req.query.level) ? req.query.level : '';
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const moduleIdentifier = typeof req.query.moduleId === 'string' ? req.query.moduleId.trim() : '';
  const recommendedOnly = req.query.recommended === 'true';
  const requestedSort = req.query.sort || 'curriculum';
  const sort = ['curriculum', 'relevance', 'newest', 'title', 'hours'].includes(requestedSort) ? requestedSort : '';

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50
    || (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1))
    || (skillId !== null && (!Number.isInteger(skillId) || skillId < 1))
    || (req.query.level && !difficulty) || !sort) {
    return res.status(400).json({ success: false, message: 'Invalid module filter or pagination value' });
  }
  const userId = req.user.id;
  const [accounts] = await pool.query('SELECT user_type FROM users WHERE id = ? AND status = \'active\'', [userId]);
  const userType = accounts[0]?.user_type;
  if (userType === 'beneficiary') {
    // Bring the learner's matches up to date. If the database reports a lock
    // conflict (another change to the same learner at the same moment), try
    // again rather than failing the page.
    for (let attempt = 1; ; attempt += 1) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await recomputeElevateAssignments(userId, connection);
        await connection.commit();
        break;
      } catch (error) {
        await connection.rollback();
        const lockConflict = error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT';
        if (!lockConflict || attempt >= 3) throw error;
      } finally {
        connection.release();
      }
    }
  }
  const where = [
    "lm.approval_status = 'approved'",
    'lm.is_elevate_program = 1',
  ];
  const whereParams = [];
  if (userType === 'beneficiary') {
    where.push(`EXISTS (
      SELECT 1 FROM elevate_module_assignments visible_assignment
      WHERE visible_assignment.module_id = lm.id
        AND visible_assignment.beneficiary_id = ?
    )`);
    whereParams.push(userId);
  } else if (userType === 'specialist') {
    where.push(`(
      EXISTS (
        SELECT 1 FROM elevate_module_assignments visible_assignment
        WHERE visible_assignment.module_id = lm.id
          AND visible_assignment.specialist_id = ?
          AND visible_assignment.assignment_status = 'assigned'
      )
      OR EXISTS (
        SELECT 1 FROM module_skills teach_ms
        JOIN user_skills teach_us ON teach_us.skill_id = teach_ms.skill_id
          AND teach_us.relation_type = 'teaches' AND teach_us.user_id = ?
        WHERE teach_ms.module_id = lm.id AND teach_ms.is_primary = 1
      )
    )`);
    whereParams.push(userId, userId);
  } else {
    where.push('1 = 0');
  }
  if (moduleIdentifier) {
    if (/^\d+$/.test(moduleIdentifier)) {
      where.push('lm.id = ?');
      whereParams.push(Number(moduleIdentifier));
    } else {
      where.push('lm.slug = ?');
      whereParams.push(moduleIdentifier);
    }
  }
  if (search) {
    where.push(`(
      lm.title LIKE ? OR lm.description LIKE ?
      OR EXISTS (
        SELECT 1 FROM module_skills search_ms JOIN skills search_skill ON search_skill.id = search_ms.skill_id
        WHERE search_ms.module_id = lm.id AND search_skill.name LIKE ?
      )
    )`);
    whereParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    where.push(`EXISTS (
      SELECT 1 FROM module_skills category_ms JOIN skills category_skill ON category_skill.id = category_ms.skill_id
      WHERE category_ms.module_id = lm.id AND category_skill.category_id = ?
    )`);
    whereParams.push(categoryId);
  }
  if (skillId) {
    where.push('EXISTS (SELECT 1 FROM module_skills filter_ms WHERE filter_ms.module_id = lm.id AND filter_ms.skill_id = ?)');
    whereParams.push(skillId);
  }
  if (difficulty) {
    where.push('lm.difficulty = ?');
    whereParams.push(difficulty);
  }
  if (recommendedOnly) {
    where.push(`EXISTS (
      SELECT 1 FROM elevate_module_assignments recommended_assignment
      WHERE recommended_assignment.module_id = lm.id
        AND recommended_assignment.beneficiary_id = ?
        AND recommended_assignment.assignment_status = 'assigned'
    )`);
    whereParams.push(userId);
  }

  const whereSql = where.join(' AND ');
  // One row per module: a beneficiary has at most one assignment per module,
  // and a specialist's assignments are grouped into a learner count.
  const assignmentJoin = userType === 'specialist'
    ? `LEFT JOIN (
        SELECT module_id, specialist_id, 'assigned' AS assignment_status, NULL AS matched_skill_id,
               0 AS match_score, NULL AS match_reasons, NULL AS waiting_reason, NULL AS applied_at,
               COUNT(DISTINCT beneficiary_id) AS learner_count
        FROM elevate_module_assignments
        WHERE specialist_id = ? AND assignment_status = 'assigned'
        GROUP BY module_id, specialist_id
      ) ema ON ema.module_id = lm.id`
    : `LEFT JOIN (
        SELECT module_id, specialist_id, assignment_status, matched_skill_id, match_score,
               match_reasons, waiting_reason, applied_at, 0 AS learner_count
        FROM elevate_module_assignments
        WHERE beneficiary_id = ?
      ) ema ON ema.module_id = lm.id`;
  const orderBy = {
    curriculum: 'lm.sort_order ASC, lm.id ASC',
    relevance: 'match_score DESC, lm.created_at DESC, lm.id DESC',
    newest: 'lm.created_at DESC, lm.id DESC',
    title: 'lm.title ASC, lm.id ASC',
    hours: 'lm.hours ASC, lm.id ASC',
  }[sort];

  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
       FROM learning_modules lm LEFT JOIN users owner ON owner.id = lm.owner_id
       WHERE ${whereSql}`,
      whereParams
    ),
    pool.query(
      `SELECT lm.id, lm.slug, lm.phase, lm.title, lm.description, lm.hours, lm.difficulty, lm.sort_order,
              COALESCE(lm.owner_id, ema.specialist_id) AS owner_id,
              COALESCE(owner.full_name, assignment_specialist.full_name) AS specialist_name,
              ema.assignment_status, ema.matched_skill_id, ema.match_score,
              ema.match_reasons, ema.waiting_reason, ema.learner_count, ema.applied_at,
              (
                SELECT COUNT(*) FROM messages unread
                JOIN conversations c ON c.id = unread.conversation_id
                WHERE c.module_id = lm.id AND (c.user_a_id = ? OR c.user_b_id = ?)
                  AND unread.sender_id <> ? AND unread.read_at IS NULL
                  AND (
                    EXISTS (
                      SELECT 1 FROM module_connections mc
                      WHERE mc.module_id = c.module_id
                        AND (mc.beneficiary_id = c.user_a_id OR mc.beneficiary_id = c.user_b_id)
                    )
                    OR EXISTS (
                      SELECT 1 FROM elevate_module_assignments ea
                      WHERE ea.module_id = c.module_id AND ea.assignment_status = 'assigned'
                        AND ((ea.beneficiary_id = c.user_a_id AND ea.specialist_id = c.user_b_id)
                          OR (ea.beneficiary_id = c.user_b_id AND ea.specialist_id = c.user_a_id))
                    )
                  )
              ) AS unread_message_count,
              (
                SELECT sender.full_name FROM messages unread
                JOIN conversations c ON c.id = unread.conversation_id
                JOIN users sender ON sender.id = unread.sender_id
                WHERE c.module_id = lm.id AND (c.user_a_id = ? OR c.user_b_id = ?)
                  AND unread.sender_id <> ? AND unread.read_at IS NULL
                  AND (
                    EXISTS (
                      SELECT 1 FROM module_connections mc
                      WHERE mc.module_id = c.module_id
                        AND (mc.beneficiary_id = c.user_a_id OR mc.beneficiary_id = c.user_b_id)
                    )
                    OR EXISTS (
                      SELECT 1 FROM elevate_module_assignments ea
                      WHERE ea.module_id = c.module_id AND ea.assignment_status = 'assigned'
                        AND ((ea.beneficiary_id = c.user_a_id AND ea.specialist_id = c.user_b_id)
                          OR (ea.beneficiary_id = c.user_b_id AND ea.specialist_id = c.user_a_id))
                    )
                  )
                ORDER BY unread.created_at DESC LIMIT 1
              ) AS unread_message_sender_name,
              EXISTS (SELECT 1 FROM module_connections mc WHERE mc.module_id = lm.id AND mc.beneficiary_id = ?) AS is_connected,
              EXISTS (
                SELECT 1 FROM module_skills teach_ms
                JOIN user_skills teach_us ON teach_us.skill_id = teach_ms.skill_id
                  AND teach_us.relation_type = 'teaches' AND teach_us.user_id = ?
                WHERE teach_ms.module_id = lm.id AND teach_ms.is_primary = 1
              ) AS teaches_topic,
              ema.match_score AS direct_score,
              0 AS related_score
       FROM learning_modules lm
       LEFT JOIN users owner ON owner.id = lm.owner_id
       ${assignmentJoin}
       LEFT JOIN users assignment_specialist ON assignment_specialist.id = ema.specialist_id
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [
        userId, userId, userId, userId, userId, userId, userId, userId, userId,
        ...whereParams, limit, (page - 1) * limit,
      ]
    ),
  ]);
  const total = Number(countRows[0].total);
  const modules = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    phase: row.phase,
    title: row.title,
    description: row.description,
    hours: row.hours,
    difficulty: row.difficulty,
    ownerId: row.owner_id,
    specialistName: row.specialist_name,
    // suggested -> pending (applied) -> assigned (accepted); or waiting / queued.
    assignmentStatus: row.assignment_status,
    appliedAt: row.applied_at || null,
    matchedSkillId: row.matched_skill_id,
    connected: Boolean(row.is_connected),
    canAddMaterials: userType === 'specialist' && Boolean(row.teaches_topic),
    unreadMessageCount: Number(row.unread_message_count) || 0,
    unreadMessageSenderName: row.unread_message_sender_name,
    matchScore: Number(row.match_score) || 0,
    matchReasons: parseReasons(row.match_reasons),
    waitingReason: row.waiting_reason || '',
    learnerCount: Number(row.learner_count) || 0,
    directScore: Number(row.direct_score),
    relatedScore: Number(row.related_score),
    skills: [],
    topics: [],
    questions: [],
    resources: [],
  }));
  const moduleIds = modules.map((module) => module.id);
  if (!moduleIds.length) {
    return res.json({
      success: true,
      data: [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  const [skillRows] = await pool.query(
    `SELECT ms.module_id, s.id, s.name, c.name AS category, ms.is_primary,
            EXISTS (
              SELECT 1 FROM user_skills wants
              WHERE wants.user_id = ? AND wants.skill_id = s.id AND wants.relation_type = 'wants_to_learn'
            ) AS is_match
     FROM module_skills ms
     JOIN skills s ON s.id = ms.skill_id
     JOIN skill_categories c ON c.id = s.category_id
     WHERE ms.module_id IN (?) ORDER BY ms.is_primary DESC, s.name`,
    [userId, moduleIds]
  );
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  skillRows.forEach((skill) => {
    const module = moduleById.get(skill.module_id);
    if (module) {
      module.skills.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        primary: Boolean(skill.is_primary),
        matched: Boolean(skill.is_match),
      });
    }
  });
  const [topicRows] = await pool.query(
    `SELECT module_id, topic_name
     FROM module_topics
     WHERE module_id IN (?)
     ORDER BY module_id, sort_order, id`,
    [moduleIds]
  );
  topicRows.forEach((topic) => {
    moduleById.get(topic.module_id)?.topics.push(topic.topic_name);
  });
  modules.forEach((module) => {
    const matched = module.skills.filter((skill) => skill.matched);
    if (matched.length) {
      module.matchReason = `Matches your learning goal${matched.length > 1 ? 's' : ''}: ${matched.map((skill) => skill.name).join(', ')}`;
    } else if (module.relatedScore) {
      module.matchReason = 'Shares a skill category with one of your learning goals';
    } else {
      module.matchReason = '';
    }
  });

  const [questionRows] = await pool.query(
    `SELECT mq.id AS question_id, mq.module_id, mq.question_text, mq.question_type,
            mq.option_a, mq.option_b, mq.option_c, umq.completed_at
     FROM module_questions mq
     LEFT JOIN user_module_questions umq ON umq.question_id = mq.id AND umq.user_id = ?
     WHERE mq.module_id IN (?) ORDER BY mq.module_id, mq.sort_order`,
    [userId, moduleIds]
  );
  const questionsById = new Map();
  questionRows.forEach((row) => {
    const question = {
      id: row.question_id,
      type: row.question_type,
      text: row.question_text,
      options: row.question_type === 'mcq' ? { a: row.option_a, b: row.option_b, c: row.option_c } : null,
      completed: Boolean(row.completed_at),
    };
    moduleById.get(row.module_id)?.questions.push(question);
    questionsById.set(row.question_id, question);
  });

  const questionIds = [...questionsById.keys()];
  if (questionIds.length) {
    const [exercises] = await pool.query(
      `SELECT id, question_id, function_name, starter_code FROM module_code_exercises WHERE question_id IN (?)`,
      [questionIds]
    );
    if (exercises.length) {
      const exerciseIds = exercises.map((exercise) => exercise.id);
      const [tests] = await pool.query(
        `SELECT id, exercise_id, assertion_expr, is_hidden FROM module_code_tests
         WHERE exercise_id IN (?) ORDER BY exercise_id, sort_order`,
        [exerciseIds]
      );
      const testsByExercise = new Map();
      tests.forEach((test) => {
        const list = testsByExercise.get(test.exercise_id) || [];
        list.push({ id: test.id, assertion: test.assertion_expr, hidden: Boolean(test.is_hidden) });
        testsByExercise.set(test.exercise_id, list);
      });
      exercises.forEach((exercise) => {
        const question = questionsById.get(exercise.question_id);
        if (question) {
          question.code = {
            functionName: exercise.function_name,
            starterCode: exercise.starter_code,
            tests: testsByExercise.get(exercise.id) || [],
          };
        }
      });
    }
  }

  const [certificates] = await pool.query(
    'SELECT module_id, certificate_code, issued_at FROM module_certificates WHERE user_id = ? AND module_id IN (?)',
    [userId, moduleIds]
  );
  const certificateByModule = new Map(certificates.map((certificate) => [certificate.module_id, certificate]));
  modules.forEach((module) => {
    const certificate = certificateByModule.get(module.id);
    module.completed = module.questions.length > 0
      && module.questions.every((question) => question.completed);
    module.certificate = certificate || null;
  });

  // Official resources for everyone; a specialist's own materials only for that
  // specialist and the beneficiaries matched to them on the topic.
  const [resources] = await pool.query(
    `SELECT mr.id, mr.module_id, mr.resource_type, mr.title, mr.original_filename, mr.mime_type,
            mr.external_url, mr.sort_order, mr.file_size, mr.uploaded_by, mr.created_at,
            uploader.full_name AS uploader_name
     FROM module_resources mr
     LEFT JOIN users uploader ON uploader.id = mr.uploaded_by
     WHERE mr.module_id IN (?)
       AND (
         mr.uploaded_by IS NULL
         OR mr.uploaded_by = ?
         OR EXISTS (
           SELECT 1 FROM elevate_module_assignments material_assignment
           WHERE material_assignment.module_id = mr.module_id
             AND material_assignment.beneficiary_id = ?
             AND material_assignment.specialist_id = mr.uploaded_by
             AND material_assignment.assignment_status = 'assigned'
         )
       )
     ORDER BY mr.module_id, mr.uploaded_by IS NOT NULL, mr.sort_order, mr.id`,
    [moduleIds, userId, userId]
  );
  resources.forEach((resource) => {
    const module = moduleById.get(resource.module_id);
    if (!module) return;
    module.resources.push({
      id: resource.id,
      type: resource.resource_type,
      title: resource.title,
      fileName: resource.original_filename,
      mimeType: resource.mime_type,
      url: resource.external_url,
      fileSize: resource.file_size ? Number(resource.file_size) : null,
      official: !resource.uploaded_by,
      uploadedByMe: String(resource.uploaded_by) === String(userId),
      uploaderName: resource.uploader_name || null,
      addedAt: resource.created_at,
    });
  });

  res.json({
    success: true,
    data: modules,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

async function listModuleFilters(req, res) {
  const [categories] = await pool.query(
    `SELECT DISTINCT c.id, c.name
     FROM skill_categories c
     JOIN skills s ON s.category_id = c.id
     JOIN module_skills ms ON ms.skill_id = s.id
     JOIN learning_modules lm ON lm.id = ms.module_id
     LEFT JOIN users owner ON owner.id = lm.owner_id
     WHERE lm.approval_status = 'approved' AND lm.is_elevate_program = 1
       AND (lm.owner_id IS NULL OR (owner.status = 'active' AND owner.user_type = 'specialist'))
     ORDER BY c.name`
  );
  res.json({ success: true, data: categories });
}

async function completeQuestion(req, res) {
  const { questionId } = req.params;
  const connection = await pool.getConnection();

  try {
    const [questions] = await connection.query(
      `SELECT id, module_id, question_type, correct_option FROM module_questions WHERE id = ?`,
      [questionId]
    );
    const question = questions[0];
    if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

    let codeSubmission = null;
    if (question.question_type === 'code') {
      const { passed, testResults, code } = req.body;
      if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ success: false, message: 'Your code is required' });
      }
      const [tests] = await connection.query(
        `SELECT ct.id FROM module_code_tests ct
         JOIN module_code_exercises ce ON ce.id = ct.exercise_id
         WHERE ce.question_id = ?`,
        [question.id]
      );
      const passedIds = new Set(
        Array.isArray(testResults) ? testResults.filter((result) => result.passed).map((result) => result.testId) : []
      );
      const allPassed = passed === true && tests.length > 0 && tests.every((test) => passedIds.has(test.id));
      if (!allPassed) {
        return res.status(400).json({ success: false, message: 'All tests must pass before continuing' });
      }
      codeSubmission = code;
    } else {
      const { answer } = req.body;
      if (!['a', 'b', 'c'].includes(answer)) {
        return res.status(400).json({ success: false, message: 'A valid answer is required' });
      }
      if (answer !== question.correct_option) {
        return res.status(400).json({ success: false, message: 'Incorrect answer' });
      }
    }

    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO user_module_questions (user_id, question_id, code_submission) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE code_submission = VALUES(code_submission)`,
      [req.user.id, question.id, codeSubmission]
    );

    const [remaining] = await connection.query(
      `SELECT COUNT(*) AS remaining
       FROM module_questions mq
       LEFT JOIN user_module_questions umq
         ON umq.question_id = mq.id AND umq.user_id = ?
       WHERE mq.module_id = ? AND umq.question_id IS NULL`,
      [req.user.id, question.module_id]
    );

    let certificate = null;
    if (remaining[0].remaining === 0) {
      const code = uuidv4();
      await connection.query(
        `INSERT IGNORE INTO module_certificates (user_id, module_id, certificate_code)
         VALUES (?, ?, ?)`,
        [req.user.id, question.module_id, code]
      );
      const [certificates] = await connection.query(
        `SELECT certificate_code, issued_at FROM module_certificates WHERE user_id = ? AND module_id = ?`,
        [req.user.id, question.module_id]
      );
      certificate = certificates[0] || null;
    }

    await connection.commit();
    res.json({ success: true, data: { completed: true, moduleCompleted: remaining[0].remaining === 0, certificate } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listMyModulePreferences(req, res) {
  const [rows] = await pool.query(
    `SELECT ump.module_id, lm.slug, lm.title, lm.phase
     FROM user_module_preferences ump
     JOIN learning_modules lm ON lm.id = ump.module_id
     WHERE ump.user_id = ? ORDER BY ump.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, data: rows });
}

async function addModulePreference(req, res) {
  const [users] = await pool.query('SELECT user_type FROM users WHERE id = ?', [req.user.id]);
  if (users[0]?.user_type === 'beneficiary') {
    return res.status(403).json({ success: false, message: 'ELEVATE curriculum is assigned from your learning profile; modules cannot be self-selected' });
  }
  const [modules] = await pool.query("SELECT id FROM learning_modules WHERE id = ? AND approval_status = 'approved'", [req.body.moduleId]);
  if (!modules[0]) return res.status(404).json({ success: false, message: 'Module not found' });
  await pool.query(
    'INSERT IGNORE INTO user_module_preferences (user_id, module_id) VALUES (?, ?)',
    [req.user.id, req.body.moduleId]
  );
  res.status(201).json({ success: true, message: 'Module added to learning plan' });
}

async function removeModulePreference(req, res) {
  const [users] = await pool.query('SELECT user_type FROM users WHERE id = ?', [req.user.id]);
  if (users[0]?.user_type === 'beneficiary') {
    return res.status(403).json({ success: false, message: 'ELEVATE curriculum assignments are managed from your learning profile' });
  }
  await pool.query('DELETE FROM user_module_preferences WHERE user_id = ? AND module_id = ?', [req.user.id, req.params.moduleId]);
  res.json({ success: true, message: 'Module removed from learning plan' });
}

async function connectToModule(req, res) {
  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'beneficiary') return res.status(403).json({ success: false, message: 'Only beneficiaries can connect to a specialist module' });
  const [modules] = await pool.query(
    "SELECT id, owner_id, is_elevate_program FROM learning_modules WHERE id = ? AND approval_status = 'approved'",
    [req.params.moduleId]
  );
  const module = modules[0];
  if (!module) return res.status(404).json({ success: false, message: 'Approved module not found' });
  if (module.is_elevate_program) {
    const [assignments] = await pool.query(
      `SELECT specialist_id, assignment_status
       FROM elevate_module_assignments WHERE beneficiary_id = ? AND module_id = ?`,
      [req.user.id, module.id]
    );
    const assignment = assignments[0];
    if (!assignment || assignment.assignment_status !== 'assigned' || !assignment.specialist_id) {
      return res.status(409).json({ success: false, message: 'This ELEVATE phase is waiting for a matching specialist' });
    }
    return res.json({ success: true, data: { specialistId: assignment.specialist_id } });
  }
  if (!module.owner_id) return res.status(400).json({ success: false, message: 'This system module has no specialist connection' });
  if (module.owner_id === req.user.id) return res.status(400).json({ success: false, message: 'You cannot connect to your own module' });

  const [userAId, userBId] = [req.user.id, module.owner_id].sort((a, b) => a - b);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT IGNORE INTO user_module_preferences (user_id, module_id) VALUES (?, ?)', [req.user.id, module.id]);
    await connection.query(
      'INSERT IGNORE INTO module_connections (beneficiary_id, module_id) VALUES (?, ?)',
      [req.user.id, module.id]
    );
    await connection.query(
      `INSERT IGNORE INTO conversations (module_id, user_a_id, user_b_id)
       VALUES (?, ?, ?)`,
      [module.id, userAId, userBId]
    );
    const [conversations] = await connection.query(
      'SELECT id FROM conversations WHERE module_id = ? AND user_a_id = ? AND user_b_id = ?',
      [module.id, userAId, userBId]
    );
    await connection.commit();
    res.status(201).json({ success: true, data: { conversationId: conversations[0].id } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createModule(req, res) {
  const uploadedFiles = req.files || [];
  const reject = async (status, message) => {
    await Promise.all(uploadedFiles.map((file) => fs.promises.unlink(file.path).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    })));
    return res.status(status).json({ success: false, message });
  };
  const [users] = await pool.query("SELECT user_type FROM users WHERE id = ? AND status = 'active'", [req.user.id]);
  if (users[0]?.user_type !== 'specialist') return reject(403, 'Only specialists can submit modules');
  return reject(403, 'Learning modules are provided by the ELEVATE program. Specialists register their teaching skills to receive learner assignments.');
  const body = req.body || {};
  const parseArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const title = body.title;
  const description = body.description;
  const topics = body.topics === undefined ? [] : parseArray(body.topics);
  const phase = body.phase;
  const hours = body.hours;
  const difficulty = body.difficulty;
  const questions = parseArray(body.questions);
  const skillIds = parseArray(body.skillIds);
  const resourceLinks = body.resourceLinks === undefined ? [] : parseArray(body.resourceLinks);
  if (!title || typeof title !== 'string' || title.length > 190
    || !description || typeof description !== 'string' || description.length > 500
    || !questions || questions.length < 1) {
    return reject(400, 'Title, description, and at least one question are required');
  }
  if (!Array.isArray(topics) || topics.length > 20
    || topics.some((topic) => typeof topic !== 'string' || !topic.trim() || topic.trim().length > 100)
    || new Set(topics.map((topic) => topic.trim().toLocaleLowerCase())).size !== topics.length) {
    return reject(400, 'Add up to 20 unique topics, each no longer than 100 characters');
  }
  if (!Array.isArray(skillIds) || skillIds.length < 1 || skillIds.length > 5
    || skillIds.some((id) => !['number', 'string'].includes(typeof id)
      || !/^\d+$/.test(String(id)) || !Number.isInteger(Number(id)) || Number(id) < 1)
    || new Set(skillIds.map(Number)).size !== skillIds.length) {
    return reject(400, 'Choose one primary skill and up to four additional skills');
  }
  if (difficulty !== undefined && !['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    return reject(400, 'Choose a valid module difficulty level');
  }
  if (!Array.isArray(resourceLinks) || resourceLinks.length + uploadedFiles.length > 10
    || resourceLinks.some((resource) => (
      !resource || typeof resource.title !== 'string' || !resource.title.trim() || resource.title.trim().length > 190
      || typeof resource.url !== 'string' || resource.url.length > 2048
      || !isHttpUrl(resource.url)
    ))) {
    return reject(400, 'Add up to 10 resources with a title and a valid HTTP or HTTPS link');
  }
  for (const file of uploadedFiles) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension === '.pdf') {
      const handle = await fs.promises.open(file.path, 'r');
      const header = Buffer.alloc(5);
      await handle.read(header, 0, header.length, 0);
      await handle.close();
      if (header.toString() !== '%PDF-') return reject(400, 'One uploaded file is not a valid PDF');
    }
    if (extension === '.docx') {
      const handle = await fs.promises.open(file.path, 'r');
      const header = Buffer.alloc(4);
      await handle.read(header, 0, header.length, 0);
      await handle.close();
      if (header[0] !== 0x50 || header[1] !== 0x4b) return reject(400, 'One uploaded file is not a valid DOCX document');
    }
  }
  const moduleDifficulty = difficulty || 'beginner';
  const normalizedSkillIds = skillIds.map(Number);
  const [skills] = await pool.query(
    `SELECT s.id FROM skills s
     JOIN user_skills us ON us.skill_id = s.id AND us.user_id = ? AND us.relation_type = 'teaches'
     WHERE s.id IN (?) AND s.is_approved = 1`,
    [req.user.id, normalizedSkillIds]
  );
  if (skills.length !== normalizedSkillIds.length) {
    return reject(400, 'Module skills must be skills you have registered as willing to teach in your profile');
  }
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO learning_modules (owner_id, slug, phase, title, description, hours, difficulty, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, slug, phase || 'Specialist Module', title, description, Number(hours) || 0, moduleDifficulty]
    );
    for (const [index, skillId] of normalizedSkillIds.entries()) {
      await connection.query(
        'INSERT INTO module_skills (module_id, skill_id, is_primary) VALUES (?, ?, ?)',
        [result.insertId, skillId, index === 0 ? 1 : 0]
      );
    }
    for (const [index, topic] of topics.entries()) {
      await connection.query(
        'INSERT INTO module_topics (module_id, topic_name, sort_order) VALUES (?, ?, ?)',
        [result.insertId, topic.trim(), index + 1]
      );
    }
    let resourceOrder = 0;
    for (const resource of resourceLinks) {
      const url = new URL(resource.url);
      await connection.query(
        `INSERT INTO module_resources (module_id, resource_type, title, external_url, sort_order)
         VALUES (?, 'link', ?, ?, ?)`,
        [result.insertId, resource.title.trim(), url.toString(), ++resourceOrder]
      );
    }
    for (const file of uploadedFiles) {
      const extension = path.extname(file.originalname).toLowerCase();
      const resourceType = extension === '.pdf' ? 'pdf' : extension === '.docx' ? 'docx' : 'video';
      await connection.query(
        `INSERT INTO module_resources
          (module_id, resource_type, title, original_filename, storage_filename, mime_type, file_size, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          resourceType,
          path.basename(file.originalname, extension).slice(0, 190) || resourceType.toUpperCase(),
          path.basename(file.originalname).slice(0, 255),
          path.basename(file.filename),
          file.mimetype,
          file.size,
          ++resourceOrder,
        ]
      );
    }
    for (const [index, question] of questions.entries()) {
      if (question.type === 'code') {
        const code = question.code || {};
        if (!question.text || !code.functionName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(code.functionName) || !code.starterCode || !Array.isArray(code.tests) || code.tests.length < 1) {
          throw new Error('Each coding exercise needs instructions, a detected function name, starter code, and at least one test case');
        }
        if (code.tests.some((test) => !test.assertion?.trim())) {
          throw new Error('Each test case needs an assertion expression');
        }
        const [questionResult] = await connection.query(
          `INSERT INTO module_questions (module_id, question_text, question_type, sort_order)
           VALUES (?, ?, 'code', ?)`,
          [result.insertId, question.text, index + 1]
        );
        const [exerciseResult] = await connection.query(
          `INSERT INTO module_code_exercises (question_id, function_name, starter_code) VALUES (?, ?, ?)`,
          [questionResult.insertId, code.functionName, code.starterCode]
        );
        for (const [testIndex, test] of code.tests.entries()) {
          await connection.query(
            `INSERT INTO module_code_tests (exercise_id, assertion_expr, is_hidden, sort_order)
             VALUES (?, ?, ?, ?)`,
            [exerciseResult.insertId, test.assertion, test.hidden ? 1 : 0, testIndex + 1]
          );
        }
      } else {
        if (!question.text || !question.options?.a || !question.options?.b || !question.options?.c || !['a', 'b', 'c'].includes(question.answer)) {
          throw new Error('Each question needs text, three options, and a correct answer');
        }
        await connection.query(
          `INSERT INTO module_questions (module_id, question_text, question_type, option_a, option_b, option_c, correct_option, sort_order)
           VALUES (?, ?, 'mcq', ?, ?, ?, ?, ?)`,
          [result.insertId, question.text, question.options.a, question.options.b, question.options.c, question.answer, index + 1]
        );
      }
    }
    await connection.commit();
    res.status(201).json({ success: true, message: 'Module submitted for admin approval' });
  } catch (error) {
    await connection.rollback();
    await Promise.all(uploadedFiles.map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    })));
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listModules,
  listModuleFilters,
  completeQuestion,
  listMyModulePreferences,
  addModulePreference,
  removeModulePreference,
  connectToModule,
  createModule,
};
