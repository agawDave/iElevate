const { pool } = require('../config/db');
const { offeredSql } = require('../lib/programPhases');
const {
  recomputeElevateAssignments,
} = require('../services/elevateAssignmentService');

// The Modules page list: the ELEVATE topics a beneficiary has in their plan, or
// the topics a specialist teaches, with assignments, materials and modules.
// (Specialists create their own modules in specialistModuleController.)

function parseReasons(value) {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((reason) => typeof reason === 'string') : [];
  } catch {
    return [];
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
      ) AND ${offeredSql('lm')}
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
  // Specialists' own modules for these topics.
  //   specialist:  myModule = their module for the topic (null = not created yet)
  //   beneficiary: specialistModule = the module of the specialist they applied
  //                to or learn with; hasModules = some approved module exists
  //                (otherwise the topic is "coming soon")
  if (userType === 'specialist') {
    const [mine] = await pool.query(
      `SELECT id, topic_id, title, overview, hours, status, review_note, submitted_at, reviewed_at, approved_at
       FROM specialist_modules WHERE specialist_id = ? AND topic_id IN (?)`,
      [userId, moduleIds]
    );
    modules.forEach((module) => { module.myModule = null; });
    mine.forEach((row) => {
      const module = moduleById.get(row.topic_id);
      if (!module) return;
      module.myModule = {
        id: row.id,
        title: row.title,
        overview: row.overview,
        hours: Number(row.hours) || 0,
        status: row.status,
        reviewNote: row.review_note || '',
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        approvedAt: row.approved_at,
      };
    });
  } else if (userType === 'beneficiary') {
    const [approved] = await pool.query(
      `SELECT sm.topic_id, sm.specialist_id, sm.title, sm.overview, sm.hours
       FROM specialist_modules sm
       JOIN users specialist ON specialist.id = sm.specialist_id AND specialist.status = 'active' AND specialist.user_type = 'specialist'
       WHERE sm.status = 'approved' AND sm.topic_id IN (?)`,
      [moduleIds]
    );
    modules.forEach((module) => {
      const forTopic = approved.filter((row) => Number(row.topic_id) === Number(module.id));
      module.hasModules = forTopic.length > 0;
      const theirs = module.ownerId && ['pending', 'assigned'].includes(module.assignmentStatus)
        ? forTopic.find((row) => Number(row.specialist_id) === Number(module.ownerId))
        : null;
      module.specialistModule = theirs ? { title: theirs.title, overview: theirs.overview, hours: Number(theirs.hours) || 0 } : null;
    });
  }
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

  const [certificates] = await pool.query(
    'SELECT module_id, certificate_code, issued_at FROM module_certificates WHERE user_id = ? AND module_id IN (?)',
    [userId, moduleIds]
  );
  const certificateByModule = new Map(certificates.map((certificate) => [certificate.module_id, certificate]));
  modules.forEach((module) => {
    const certificate = certificateByModule.get(module.id);
    module.certificate = certificate || null;
  });

  // Materials are added by specialists: each one's only for that specialist and
  // the beneficiaries matched to them on the topic.
  const [resources] = await pool.query(
    `SELECT mr.id, mr.module_id, mr.resource_type, mr.title, mr.original_filename, mr.mime_type,
            mr.external_url, mr.sort_order, mr.file_size, mr.uploaded_by, mr.created_at,
            uploader.full_name AS uploader_name
     FROM module_resources mr
     LEFT JOIN users uploader ON uploader.id = mr.uploaded_by
     WHERE mr.module_id IN (?)
       AND (
         mr.uploaded_by = ?
         OR EXISTS (
           SELECT 1 FROM elevate_module_assignments material_assignment
           WHERE material_assignment.module_id = mr.module_id
             AND material_assignment.beneficiary_id = ?
             AND material_assignment.specialist_id = mr.uploaded_by
             AND material_assignment.assignment_status = 'assigned'
         )
       )
     ORDER BY mr.module_id, mr.sort_order, mr.id`,
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

module.exports = { listModules };
