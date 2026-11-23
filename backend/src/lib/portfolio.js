const { pool } = require('../config/db');

// A beneficiary's learning portfolio: their skill profile (skill check), and
// for every topic they learned or are learning: the specialist, dates, the
// certificate, pre-test / post-test scores, activities done, sessions held,
// and the written and file work they sent with the specialist's replies.
// Returns null if the user isn't a beneficiary.

const attempt = (row) => (row ? { score: Number(row.score), total: Number(row.total), takenAt: row.taken_at } : null);

async function buildPortfolio(beneficiaryId) {
  const [[person]] = await pool.query(
    `SELECT u.id, u.full_name, u.user_type, u.role, u.city, u.province, u.state_region, u.created_at,
            u.avatar_url, u.bio, u.school_or_org, u.education, u.email, u.mobile_number, c.barangay, p.goal_track
     FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     LEFT JOIN elevate_learner_profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [beneficiaryId]
  );
  if (!person || person.user_type !== 'beneficiary' || ['admin', 'moderator'].includes(person.role)) return null;

  const [accepted, certificatesOnly, tests, activityCounts, work, sessions, skills, ownItems, careerProfiles, careerEntries, recommendations] = await Promise.all([
    // Topics a specialist accepted them for (ongoing or completed).
    pool.query(
      `SELECT a.module_id, a.specialist_id, a.assigned_at, lm.slug, lm.title, lm.phase, lm.hours, lm.sort_order,
              s.full_name AS specialist_name,
              cert.id AS certificate_id, cert.issued_at, cert.file_storage_name IS NOT NULL AS has_file, issuer.full_name AS issuer_name
       FROM elevate_module_assignments a
       JOIN learning_modules lm ON lm.id = a.module_id
       LEFT JOIN users s ON s.id = a.specialist_id
       LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
       LEFT JOIN users issuer ON issuer.id = cert.issued_by
       WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'`,
      [beneficiaryId]
    ),
    // Certificates for topics they're no longer assigned to (kept in the portfolio).
    pool.query(
      `SELECT cert.module_id, cert.id AS certificate_id, cert.issued_at, cert.file_storage_name IS NOT NULL AS has_file,
              issuer.full_name AS issuer_name, issuer.id AS specialist_id, lm.slug, lm.title, lm.phase, lm.hours, lm.sort_order
       FROM module_certificates cert
       JOIN learning_modules lm ON lm.id = cert.module_id
       LEFT JOIN users issuer ON issuer.id = cert.issued_by
       WHERE cert.user_id = ?
         AND NOT EXISTS (SELECT 1 FROM elevate_module_assignments a
                         WHERE a.beneficiary_id = cert.user_id AND a.module_id = cert.module_id AND a.assignment_status = 'assigned')`,
      [beneficiaryId]
    ),
    pool.query('SELECT module_id, specialist_id, test_kind, score, total, taken_at FROM module_test_attempts WHERE beneficiary_id = ?', [beneficiaryId]),
    // Activities of the specialist who accepted them, and how many are done.
    pool.query(
      `SELECT act.module_id, COUNT(act.id) AS total,
              SUM(CASE WHEN (act.activity_type = 'multiple_choice' AND ans.is_correct = 1)
                         OR (act.activity_type <> 'multiple_choice' AND ans.id IS NOT NULL) THEN 1 ELSE 0 END) AS done
       FROM elevate_module_assignments a
       JOIN module_activities act ON act.module_id = a.module_id AND act.specialist_id = a.specialist_id
       LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = a.beneficiary_id
       WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'
       GROUP BY act.module_id`,
      [beneficiaryId]
    ),
    // Their written and file answers, with the specialist's replies.
    pool.query(
      `SELECT ans.id, act.module_id, act.activity_type, act.prompt, ans.answer_text,
              ans.file_original_name, ans.file_size, ans.file_mime_type, ans.feedback, ans.reviewed_at, ans.submitted_at,
              ans.rubric_content, ans.rubric_completeness, ans.rubric_effort, ans.reflection, ans.show_in_career
       FROM module_activity_answers ans
       JOIN module_activities act ON act.id = ans.activity_id AND act.activity_type <> 'multiple_choice'
       WHERE ans.beneficiary_id = ?
       ORDER BY act.module_id, act.sort_order, act.id`,
      [beneficiaryId]
    ),
    pool.query(
      // Online sessions, and face-to-face sessions they came to (one-on-one held, or an open one attended).
      `SELECT module_id, SUM(kind = 'online') AS online, SUM(kind = 'face') AS face FROM (
         SELECT module_id, 'online' AS kind FROM learning_sessions WHERE beneficiary_id = ?
         UNION ALL
         SELECT module_id, 'face' FROM module_sessions WHERE beneficiary_id = ? AND is_open = 0 AND status = 'completed'
         UNION ALL
         SELECT ms.module_id, 'face' FROM module_sessions ms
         JOIN module_session_attendees sa ON sa.session_id = ms.id AND sa.beneficiary_id = ? AND sa.attended = 1
         WHERE ms.is_open = 1 AND ms.status = 'completed'
       ) AS sessions GROUP BY module_id`,
      [beneficiaryId, beneficiaryId, beneficiaryId]
    ),
    pool.query(
      `SELECT lm.id AS module_id, lm.title, lm.phase, lm.sort_order, sa.test_kind, sa.band, sa.taken_at
       FROM elevate_skill_assessments sa
       JOIN module_skills ms ON ms.skill_id = sa.skill_id AND ms.is_primary = 1
       JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1
       WHERE sa.user_id = ?
       ORDER BY lm.sort_order, lm.id, sa.attempt`,
      [beneficiaryId]
    ),
    // Projects, awards and photos they added themselves.
    pool.query(
      `SELECT id, kind, title, description, show_in_career, DATE_FORMAT(item_date, '%Y-%m-%d') AS item_date,
              file_original_name, file_size, file_mime_type, created_at
       FROM portfolio_items WHERE user_id = ?
       ORDER BY COALESCE(item_date, DATE(created_at)) DESC, id DESC`,
      [beneficiaryId]
    ),
    pool.query('SELECT * FROM career_profiles WHERE user_id = ?', [beneficiaryId]),
    pool.query('SELECT id, kind, title, organization, period, description FROM career_entries WHERE user_id = ? ORDER BY id DESC', [beneficiaryId]),
    pool.query(
      `SELECT r.id, r.module_id, r.status, r.note, r.body, r.requested_at, r.written_at, lm.title AS topic, s.full_name AS specialist
       FROM career_recommendations r
       JOIN learning_modules lm ON lm.id = r.module_id
       JOIN users s ON s.id = r.specialist_id
       WHERE r.beneficiary_id = ?
       ORDER BY COALESCE(r.written_at, r.requested_at) DESC`,
      [beneficiaryId]
    ),
  ]).then((results) => results.map(([rows]) => rows));

  const activityBy = new Map(activityCounts.map((row) => [Number(row.module_id), { total: Number(row.total) || 0, done: Number(row.done) || 0 }]));
  const sessionsBy = new Map(sessions.map((row) => [Number(row.module_id), { online: Number(row.online) || 0, face: Number(row.face) || 0 }]));
  const testOf = (moduleId, specialistId, kind) => attempt(tests.find((row) => Number(row.module_id) === Number(moduleId)
    && Number(row.specialist_id) === Number(specialistId) && row.test_kind === kind));

  const topics = [...accepted, ...certificatesOnly.map((row) => ({ ...row, specialist_name: row.issuer_name, assigned_at: null }))]
    .sort((a, b) => (a.sort_order - b.sort_order) || (a.module_id - b.module_id))
    .map((row) => {
      const moduleId = Number(row.module_id);
      const pre = testOf(moduleId, row.specialist_id, 'pre');
      const post = testOf(moduleId, row.specialist_id, 'post');
      return {
        moduleId,
        slug: row.slug,
        title: row.title,
        phase: row.phase,
        hours: row.hours === null ? null : Number(row.hours),
        specialist: row.specialist_name || null,
        stage: row.certificate_id ? 'completed' : 'ongoing',
        acceptedAt: row.assigned_at,
        completedAt: row.issued_at || null,
        certificate: row.certificate_id ? { id: row.certificate_id, hasFile: Boolean(row.has_file), issuedBy: row.issuer_name || null } : null,
        tests: pre || post ? { pre, post } : null,
        activities: activityBy.get(moduleId) || { total: 0, done: 0 },
        onlineSessions: sessionsBy.get(moduleId)?.online || 0,
        faceToFaceSessions: sessionsBy.get(moduleId)?.face || 0,
        work: work.filter((item) => Number(item.module_id) === moduleId).map((item) => ({
          answerId: item.id,
          type: item.activity_type,
          prompt: item.prompt,
          text: item.answer_text || '',
          file: item.file_original_name ? { name: item.file_original_name, size: Number(item.file_size) || 0, mimeType: item.file_mime_type } : null,
          feedback: item.feedback || '',
          rubric: item.rubric_content === null ? null : {
            content: Number(item.rubric_content), completeness: Number(item.rubric_completeness), effort: Number(item.rubric_effort),
          },
          reflection: item.reflection || '',
          showInCareer: Boolean(item.show_in_career),
          reviewedAt: item.reviewed_at,
          submittedAt: item.submitted_at,
        })),
      };
    });

  // Skill profile: the band at the first skill check, and at the latest retake.
  const skillTopics = [];
  skills.forEach((row) => {
    let entry = skillTopics.find((item) => item.moduleId === Number(row.module_id));
    if (!entry) {
      entry = { moduleId: Number(row.module_id), title: row.title, phase: row.phase, startBand: null, latestBand: null };
      skillTopics.push(entry);
    }
    if (row.test_kind === 'pre' && !entry.startBand) entry.startBand = row.band;
    else if (row.test_kind === 'post') entry.latestBand = row.band;
  });
  const takenDates = skills.map((row) => new Date(row.taken_at).getTime());

  const completed = topics.filter((topic) => topic.stage === 'completed');
  const completedIds = new Set(completed.map((topic) => topic.moduleId));
  const careerProfile = careerProfiles[0] || {};
  return {
    // The Career tab. Skills list only what the beneficiary does well or was
    // certified in: beginner levels don't belong on a job application.
    career: {
      contact: { email: person.email, mobile: person.mobile_number || '', place: [person.barangay && `Brgy. ${person.barangay}`, person.city, person.province || person.state_region].filter(Boolean).join(', ') },
      profile: {
        objective: careerProfile.objective || '',
        otherSkills: careerProfile.other_skills || '',
        resumeMode: careerProfile.resume_mode || 'built',
        resumeFile: careerProfile.file_original_name
          ? { name: careerProfile.file_original_name, size: Number(careerProfile.file_size) || 0, mimeType: careerProfile.file_mime_type }
          : null,
      },
      entries: careerEntries.map((entry) => ({
        id: entry.id, kind: entry.kind, title: entry.title, organization: entry.organization || '', period: entry.period || '', description: entry.description || '',
      })),
      skills: skillTopics
        .map((item) => ({ moduleId: item.moduleId, title: item.title, band: item.latestBand || item.startBand, certified: completedIds.has(item.moduleId) }))
        .filter((item) => item.certified || ['proficient', 'strong'].includes(item.band)),
      recommendations: recommendations.map((row) => ({
        id: row.id, moduleId: Number(row.module_id), topic: row.topic, specialist: row.specialist, status: row.status,
        note: row.note || '', body: row.body || '', requestedAt: row.requested_at, writtenAt: row.written_at,
      })),
    },
    person: {
      id: person.id,
      name: person.full_name,
      place: [person.barangay && `Brgy. ${person.barangay}`, person.city, person.province || person.state_region].filter(Boolean).join(', '),
      joinedAt: person.created_at,
    },
    about: {
      avatarUrl: person.avatar_url || null,
      bio: person.bio || '',
      schoolOrOrg: person.school_or_org || '',
      education: person.education || null,
      goalTrack: person.goal_track || null,
    },
    items: ownItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description || '',
      itemDate: item.item_date,
      showInCareer: Boolean(item.show_in_career),
      file: item.file_original_name ? { name: item.file_original_name, size: Number(item.file_size) || 0, mimeType: item.file_mime_type } : null,
      addedAt: item.created_at,
    })),
    summary: {
      completed: completed.length,
      ongoing: topics.length - completed.length,
      certificates: topics.filter((topic) => topic.certificate).length,
      hoursCompleted: completed.reduce((sum, topic) => sum + (topic.hours || 0), 0),
      onlineSessions: topics.reduce((sum, topic) => sum + topic.onlineSessions, 0),
      faceToFaceSessions: topics.reduce((sum, topic) => sum + topic.faceToFaceSessions, 0),
    },
    skillProfile: {
      firstTakenAt: takenDates.length ? new Date(Math.min(...takenDates)) : null,
      lastTakenAt: takenDates.length ? new Date(Math.max(...takenDates)) : null,
      topics: skillTopics,
    },
    topics,
    generatedAt: new Date(),
  };
}

module.exports = { buildPortfolio };
