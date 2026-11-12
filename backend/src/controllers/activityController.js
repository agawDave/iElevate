const { pool } = require('../config/db');
const { logActivity } = require('../lib/activityLog');
const { checkActivityFile, removeActivityFile, TYPE_MESSAGE } = require('../middleware/activityFileUpload');
const { loadTestState, attemptDto, attemptReview } = require('../lib/moduleTests');

// Specialist-made module activities (see module_activities_migration.sql and
// file_task_migration.sql). A learner answers the activities of the specialist
// who accepted them for that topic; the correct choice of a multiple-choice
// question never leaves the server for learners.
//   multiple_choice - checked at once, try again until right
//   written         - a typed answer the specialist reads and replies to
//   file            - the specialist's file (a worksheet); the learner answers
//                     with a file, a photo, typed text, or several of these
const TYPES = ['multiple_choice', 'written', 'file'];
const TYPE_LABELS = { multiple_choice: 'Multiple choice', written: 'Written task', file: 'File task' };
const MAX_ACTIVITIES = 50;
const MAX_PROMPT = 1000;
const MAX_CHOICE = 190;
const MAX_ANSWER = 5000;
const MAX_FEEDBACK = 2000;
const BAD_FILE = `That file couldn't be read as what its name says. ${TYPE_MESSAGE}`;

function parseOptions(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Multiple choice is done once it's right; the others once anything was sent.
function isDone(row) {
  return row.activity_type === 'multiple_choice' ? Number(row.is_correct) === 1 : Boolean(row.answer_id);
}

function fileMeta(name, size, mimeType) {
  return name ? { name, size: Number(size) || 0, mimeType } : null;
}

// The specialist's optional rubric on a written or file-task answer: three
// scores from 1 to 4, all or none.
function rubricOf(row) {
  return row.rubric_content === null || row.rubric_content === undefined ? null : {
    content: Number(row.rubric_content), completeness: Number(row.rubric_completeness), effort: Number(row.rubric_effort),
  };
}

function readRubric(value) {
  if (!value || typeof value !== 'object') return { value: [null, null, null] };
  const scores = [value.content, value.completeness, value.effort].map((score) => (score === null || score === undefined || score === '' ? null : Number(score)));
  if (scores.every((score) => score === null)) return { value: scores };
  if (scores.some((score) => !Number.isInteger(score) || score < 1 || score > 4)) return { error: 'Score all three rubric items from 1 to 4, or leave them all empty.' };
  return { value: scores };
}

async function notify(app, userId, payload) {
  const io = app.get('io');
  if (io && userId) io.to(`user:${userId}`).emit('notification:new', { type: 'module_activity', ...payload });
}

// Runs a handler that may receive an uploaded file. The file is deleted
// afterwards unless the handler saved it (req.keepUpload = true).
function withUpload(handler) {
  return async (req, res) => {
    req.keepUpload = false;
    try {
      await handler(req, res);
    } finally {
      if (req.file && !req.keepUpload) await removeActivityFile(req.file.filename);
    }
  };
}

// The specialist teaches the topic, or still has accepted learners in it.
async function canAuthor(specialistId, moduleId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM module_skills ms
     JOIN user_skills us ON us.skill_id = ms.skill_id AND us.relation_type = 'teaches' AND us.user_id = ?
     JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1
     WHERE ms.module_id = ? AND ms.is_primary = 1
     UNION
     SELECT 1 FROM elevate_module_assignments
     WHERE specialist_id = ? AND module_id = ? AND assignment_status = 'assigned'
     LIMIT 1`,
    [specialistId, moduleId, specialistId, moduleId]
  );
  return rows.length > 0;
}

function readActivity(body = {}) {
  if (!TYPES.includes(body.type)) return { error: 'Choose multiple choice, written task or file task.' };
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: body.type === 'file' ? 'Write the instructions for the file.' : 'Write the question or task.' };
  if (prompt.length > MAX_PROMPT) return { error: `Keep it under ${MAX_PROMPT} characters.` };
  if (body.type !== 'multiple_choice') return { value: { type: body.type, prompt, options: null, correct: null } };
  const options = parseOptions(body.options).map((option) => String(option ?? '').trim());
  if (options.length < 2 || options.length > 4 || options.some((option) => !option)) return { error: 'Give 2 to 4 choices, none of them empty.' };
  if (options.some((option) => option.length > MAX_CHOICE)) return { error: `Keep each choice under ${MAX_CHOICE} characters.` };
  const correct = Number(body.correctOption);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return { error: 'Mark which choice is correct.' };
  return { value: { type: body.type, prompt, options, correct } };
}

function toAuthorDto(row) {
  return {
    id: row.id,
    moduleId: row.module_id,
    type: row.activity_type,
    prompt: row.prompt,
    options: row.activity_type === 'multiple_choice' ? parseOptions(row.options) : [],
    correctOption: row.correct_option,
    file: fileMeta(row.file_original_name, row.file_size, row.file_mime_type),
    answers: Number(row.answers) || 0,
  };
}

// ------------------------------------------------------------ specialists

async function listMine(req, res) {
  const moduleId = Number(req.query.moduleId);
  if (!moduleId || !await canAuthor(req.user.id, moduleId)) return res.status(403).json({ success: false, message: "You don't teach this topic." });
  const [rows] = await pool.query(
    `SELECT a.*, (SELECT COUNT(*) FROM module_activity_answers x WHERE x.activity_id = a.id) AS answers
     FROM module_activities a WHERE a.module_id = ? AND a.specialist_id = ?
     ORDER BY a.sort_order, a.id`,
    [moduleId, req.user.id]
  );
  res.json({ success: true, data: rows.map(toAuthorDto) });
}

const createActivity = withUpload(async (req, res) => {
  const moduleId = Number(req.body?.moduleId);
  if (!moduleId || !await canAuthor(req.user.id, moduleId)) return res.status(403).json({ success: false, message: "You don't teach this topic." });
  const input = readActivity(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const { type, prompt, options, correct } = input.value;
  let file = null;
  if (type === 'file') {
    if (!req.file) return res.status(400).json({ success: false, message: 'Attach the file learners will download.' });
    file = await checkActivityFile(req.file);
    if (!file) return res.status(400).json({ success: false, message: BAD_FILE });
  }
  const [[count]] = await pool.query(
    'SELECT COUNT(*) AS total, COALESCE(MAX(sort_order), 0) AS last FROM module_activities WHERE module_id = ? AND specialist_id = ?',
    [moduleId, req.user.id]
  );
  if (Number(count.total) >= MAX_ACTIVITIES) return res.status(400).json({ success: false, message: `A topic can have up to ${MAX_ACTIVITIES} activities.` });
  const [result] = await pool.query(
    `INSERT INTO module_activities
       (module_id, specialist_id, activity_type, prompt, options, correct_option,
        file_storage_name, file_original_name, file_mime_type, file_size, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [moduleId, req.user.id, type, prompt, options ? JSON.stringify(options) : null, correct,
      file?.storageName || null, file?.originalName || null, file?.mimeType || null, file?.size || null, Number(count.last) + 1]
  );
  req.keepUpload = Boolean(file);
  await logActivity({ userId: req.user.id, action: 'activity_created', moduleId, details: TYPE_LABELS[type] });
  res.status(201).json({ success: true, message: 'Activity added.', data: { id: result.insertId } });
});

async function findOwnActivity(req) {
  const [rows] = await pool.query('SELECT * FROM module_activities WHERE id = ? AND specialist_id = ?', [req.params.activityId, req.user.id]);
  return rows[0] || null;
}

const updateActivity = withUpload(async (req, res) => {
  const activity = await findOwnActivity(req);
  if (!activity) return res.status(404).json({ success: false, message: 'Activity not found.' });
  const input = readActivity(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const { type, prompt, options, correct } = input.value;

  // A file task keeps its file unless a new one is attached.
  let newFile = null;
  if (type === 'file' && req.file) {
    newFile = await checkActivityFile(req.file);
    if (!newFile) return res.status(400).json({ success: false, message: BAD_FILE });
  }
  const keepsOldFile = type === 'file' && !newFile && activity.activity_type === 'file' && activity.file_storage_name;
  if (type === 'file' && !newFile && !keepsOldFile) return res.status(400).json({ success: false, message: 'Attach the file learners will download.' });
  const file = newFile
    ? newFile
    : keepsOldFile
      ? { storageName: activity.file_storage_name, originalName: activity.file_original_name, mimeType: activity.file_mime_type, size: activity.file_size }
      : null;

  const kindChanged = type !== activity.activity_type;
  let answerFiles = [];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE module_activities SET activity_type = ?, prompt = ?, options = ?, correct_option = ?,
         file_storage_name = ?, file_original_name = ?, file_mime_type = ?, file_size = ?
       WHERE id = ?`,
      [type, prompt, options ? JSON.stringify(options) : null, correct,
        file?.storageName || null, file?.originalName || null, file?.mimeType || null, file?.size || null, activity.id]
    );
    if (kindChanged) {
      // Old answers don't fit the new kind of activity.
      const [rows] = await connection.query('SELECT file_storage_name FROM module_activity_answers WHERE activity_id = ? AND file_storage_name IS NOT NULL', [activity.id]);
      answerFiles = rows.map((row) => row.file_storage_name);
      await connection.query('DELETE FROM module_activity_answers WHERE activity_id = ?', [activity.id]);
    } else if (type === 'multiple_choice') {
      // Re-check earlier answers against the (possibly new) correct choice.
      await connection.query(
        'UPDATE module_activity_answers SET is_correct = (selected_option = ?) WHERE activity_id = ?',
        [correct, activity.id]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  req.keepUpload = Boolean(newFile);
  // The replaced (or no longer needed) worksheet, and answers that were cleared.
  if (activity.file_storage_name && activity.file_storage_name !== file?.storageName) await removeActivityFile(activity.file_storage_name);
  await Promise.all(answerFiles.map(removeActivityFile));
  res.json({ success: true, message: 'Activity saved.' });
});

async function deleteActivity(req, res) {
  const activity = await findOwnActivity(req);
  if (!activity) return res.status(404).json({ success: false, message: 'Activity not found.' });
  const [answers] = await pool.query('SELECT file_storage_name FROM module_activity_answers WHERE activity_id = ? AND file_storage_name IS NOT NULL', [activity.id]);
  await pool.query('DELETE FROM module_activities WHERE id = ?', [activity.id]);
  await Promise.all([activity.file_storage_name, ...answers.map((row) => row.file_storage_name)].map(removeActivityFile));
  res.json({ success: true, message: 'Activity removed.' });
}

// Progress of each accepted learner, and how many activities each topic has.
async function specialistSummary(req, res) {
  const [learners] = await pool.query(
    `SELECT a.module_id, a.beneficiary_id, COUNT(act.id) AS total,
            SUM(CASE WHEN (act.activity_type = 'multiple_choice' AND ans.is_correct = 1)
                       OR (act.activity_type <> 'multiple_choice' AND ans.id IS NOT NULL) THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN act.activity_type <> 'multiple_choice' AND ans.id IS NOT NULL AND ans.reviewed_at IS NULL THEN 1 ELSE 0 END) AS to_review
     FROM elevate_module_assignments a
     LEFT JOIN module_activities act ON act.module_id = a.module_id AND act.specialist_id = a.specialist_id
     LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = a.beneficiary_id
     WHERE a.specialist_id = ? AND a.assignment_status = 'assigned'
     GROUP BY a.module_id, a.beneficiary_id`,
    [req.user.id]
  );
  const [counts] = await pool.query(
    'SELECT module_id, COUNT(*) AS total FROM module_activities WHERE specialist_id = ? GROUP BY module_id',
    [req.user.id]
  );
  const [questionCounts] = await pool.query(
    'SELECT module_id, COUNT(*) AS total FROM module_test_questions WHERE specialist_id = ? GROUP BY module_id',
    [req.user.id]
  );
  const [attempts] = await pool.query(
    'SELECT module_id, beneficiary_id, test_kind, score, total, taken_at FROM module_test_attempts WHERE specialist_id = ?',
    [req.user.id]
  );
  const attemptOf = (row, kind) => attemptDto(attempts.find((attempt) => Number(attempt.module_id) === Number(row.module_id)
    && Number(attempt.beneficiary_id) === Number(row.beneficiary_id) && attempt.test_kind === kind));
  const [recommendations] = await pool.query(
    'SELECT id, module_id, beneficiary_id, status, note, body, requested_at, written_at FROM career_recommendations WHERE specialist_id = ?',
    [req.user.id]
  );
  const recommendationOf = (row) => {
    const found = recommendations.find((item) => Number(item.module_id) === Number(row.module_id) && Number(item.beneficiary_id) === Number(row.beneficiary_id));
    return found ? { id: found.id, status: found.status, note: found.note || '', body: found.body || '', requestedAt: found.requested_at, writtenAt: found.written_at } : null;
  };
  res.json({
    success: true,
    data: {
      learners: learners.map((row) => ({
        moduleId: row.module_id, beneficiaryId: row.beneficiary_id,
        total: Number(row.total) || 0, done: Number(row.done) || 0, toReview: Number(row.to_review) || 0,
        preTest: attemptOf(row, 'pre'), postTest: attemptOf(row, 'post'),
        recommendation: recommendationOf(row),
      })),
      activityCounts: Object.fromEntries(counts.map((row) => [row.module_id, Number(row.total)])),
      testQuestionCounts: Object.fromEntries(questionCounts.map((row) => [row.module_id, Number(row.total)])),
    },
  });
}

async function acceptedLearner(specialistId, moduleId, beneficiaryId) {
  const [rows] = await pool.query(
    `SELECT u.full_name FROM elevate_module_assignments a JOIN users u ON u.id = a.beneficiary_id
     WHERE a.specialist_id = ? AND a.module_id = ? AND a.beneficiary_id = ? AND a.assignment_status = 'assigned'`,
    [specialistId, moduleId, beneficiaryId]
  );
  return rows[0] || null;
}

// One learner's answers to the specialist's activities for a topic.
async function learnerAnswers(req, res) {
  const moduleId = Number(req.query.moduleId);
  const beneficiaryId = Number(req.query.beneficiaryId);
  const learner = await acceptedLearner(req.user.id, moduleId, beneficiaryId);
  if (!learner) return res.status(404).json({ success: false, message: 'This learner is not in your topic.' });
  const [rows] = await pool.query(
    `SELECT act.id, act.activity_type, act.prompt, act.options, act.correct_option,
            act.file_original_name, act.file_size, act.file_mime_type,
            ans.id AS answer_id, ans.selected_option, ans.answer_text, ans.is_correct, ans.attempts,
            ans.file_original_name AS answer_file_name, ans.file_size AS answer_file_size, ans.file_mime_type AS answer_file_type,
            ans.feedback, ans.rubric_content, ans.rubric_completeness, ans.rubric_effort, ans.reviewed_at, ans.submitted_at
     FROM module_activities act
     LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = ?
     WHERE act.module_id = ? AND act.specialist_id = ?
     ORDER BY act.sort_order, act.id`,
    [beneficiaryId, moduleId, req.user.id]
  );
  const tests = await loadTestState(beneficiaryId, moduleId, req.user.id);
  const testResult = (attempt) => (attempt ? { ...attemptDto(attempt), questions: attemptReview(attempt) } : null);
  res.json({
    success: true,
    data: {
      learnerName: learner.full_name,
      // The pre-test and post-test, each question with what the learner picked.
      tests: { questionCount: tests.questions.length, pre: testResult(tests.pre), post: testResult(tests.post) },
      activities: rows.map((row) => ({
        id: row.id,
        type: row.activity_type,
        prompt: row.prompt,
        options: row.activity_type === 'multiple_choice' ? parseOptions(row.options) : [],
        correctOption: row.correct_option,
        file: fileMeta(row.file_original_name, row.file_size, row.file_mime_type),
        done: isDone(row),
        answer: row.answer_id ? {
          id: row.answer_id,
          selectedOption: row.selected_option,
          text: row.answer_text,
          file: fileMeta(row.answer_file_name, row.answer_file_size, row.answer_file_type),
          correct: row.is_correct === null ? null : Boolean(row.is_correct),
          attempts: row.attempts,
          feedback: row.feedback,
          rubric: rubricOf(row),
          reviewedAt: row.reviewed_at,
          submittedAt: row.submitted_at,
        } : null,
      })),
    },
  });
}

// The specialist replies to a written or file-task answer.
async function reviewAnswer(req, res) {
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim() : '';
  if (feedback.length > MAX_FEEDBACK) return res.status(400).json({ success: false, message: `Keep your reply under ${MAX_FEEDBACK} characters.` });
  const rubric = readRubric(req.body?.rubric);
  if (rubric.error) return res.status(400).json({ success: false, message: rubric.error });
  const [rows] = await pool.query(
    `SELECT ans.id, ans.beneficiary_id, act.module_id, act.activity_type, lm.title
     FROM module_activity_answers ans
     JOIN module_activities act ON act.id = ans.activity_id AND act.specialist_id = ?
     JOIN learning_modules lm ON lm.id = act.module_id
     WHERE ans.id = ?`,
    [req.user.id, req.params.answerId]
  );
  const answer = rows[0];
  if (!answer || answer.activity_type === 'multiple_choice' || !await acceptedLearner(req.user.id, answer.module_id, answer.beneficiary_id)) {
    return res.status(404).json({ success: false, message: 'Answer not found.' });
  }
  await pool.query(
    'UPDATE module_activity_answers SET feedback = ?, rubric_content = ?, rubric_completeness = ?, rubric_effort = ?, reviewed_at = NOW() WHERE id = ?',
    [feedback || null, ...rubric.value, answer.id]
  );
  await logActivity({ userId: req.user.id, action: 'answer_reviewed', moduleId: answer.module_id, targetUserId: answer.beneficiary_id });
  const [[me]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  await notify(req.app, answer.beneficiary_id, {
    kind: 'reviewed', moduleId: answer.module_id, moduleTitle: answer.title, senderName: me.full_name,
    body: `${me.full_name} replied to your answer in ${answer.title}`,
  });
  res.json({ success: true, message: 'Reply sent.' });
}

// ---------------------------------------------------------------- learners

async function learnerAssignment(beneficiaryId, moduleId) {
  const [rows] = await pool.query(
    `SELECT a.specialist_id, specialist.full_name AS specialist_name, specialist.avatar_url AS specialist_avatar,
            lm.id, lm.slug, lm.title, lm.phase, lm.description, lm.hours,
            sm.title AS module_title, sm.overview AS module_overview, sm.hours AS module_hours,
            cert.id AS certificate_id, cert.issued_at AS certificate_issued_at,
            cert.file_storage_name IS NOT NULL AS certificate_has_file, issuer.full_name AS certificate_issuer,
            (SELECT c.id FROM conversations c WHERE c.module_id = a.module_id
               AND c.user_a_id = LEAST(a.beneficiary_id, a.specialist_id)
               AND c.user_b_id = GREATEST(a.beneficiary_id, a.specialist_id)) AS conversation_id
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     JOIN users specialist ON specialist.id = a.specialist_id
     LEFT JOIN specialist_modules sm ON sm.topic_id = a.module_id AND sm.specialist_id = a.specialist_id
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
     LEFT JOIN users issuer ON issuer.id = cert.issued_by
     WHERE a.beneficiary_id = ? AND a.module_id = ? AND a.assignment_status = 'assigned'`,
    [beneficiaryId, moduleId]
  );
  return rows[0] || null;
}

// What the module page shows about the pre-test and post-test. The questions
// (without the correct choices) are sent only when a test can be taken now;
// the correct answers only after the post-test. null when there's no test.
async function learnerTestView(beneficiaryId, assignment, progress, completed) {
  const state = await loadTestState(beneficiaryId, assignment.id, assignment.specialist_id);
  if (!state.questions.length && !state.pre && !state.post) return null;
  const preOpen = !completed && !state.pre && state.questions.length > 0;
  const postOpen = !completed && Boolean(state.pre) && !state.post && state.questions.length > 0 && progress.done >= progress.total;
  return {
    questionCount: state.questions.length,
    pre: attemptDto(state.pre),
    post: attemptDto(state.post),
    preOpen,
    postOpen,
    questions: preOpen || postOpen ? state.questions.map(({ id, prompt, options }) => ({ id, prompt, options })) : [],
    review: state.post ? attemptReview(state.post) : null,
  };
}

// After a topic is completed: the one topic to go to next. A topic in progress
// comes first, then one they can apply to, one waiting to be accepted, then
// the rest of their plan, each in curriculum order. null when nothing is left.
const NEXT_ORDER = ['assigned', 'suggested', 'pending', 'queued', 'waiting'];
async function nextTopicFor(beneficiaryId, finishedModuleId) {
  const [rows] = await pool.query(
    `SELECT a.module_id, a.assignment_status, lm.title, s.full_name AS specialist_name
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     LEFT JOIN users s ON s.id = a.specialist_id
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
     WHERE a.beneficiary_id = ? AND a.module_id <> ? AND cert.id IS NULL
       AND a.assignment_status IN (?)
     ORDER BY FIELD(a.assignment_status, ?), lm.sort_order, lm.id
     LIMIT 1`,
    [beneficiaryId, finishedModuleId, NEXT_ORDER, NEXT_ORDER]
  );
  const row = rows[0];
  return row ? { id: row.module_id, title: row.title, status: row.assignment_status, specialist: row.specialist_name || null } : null;
}

// The module page: the topic, the specialist's activities, and the learner's answers.
async function learnerModule(req, res) {
  const assignment = await learnerAssignment(req.user.id, Number(req.params.moduleId));
  if (!assignment) return res.status(403).json({ success: false, message: 'This module opens once a specialist accepts your application.' });
  const [rows] = await pool.query(
    `SELECT act.id, act.activity_type, act.prompt, act.options,
            act.file_original_name, act.file_size, act.file_mime_type,
            ans.id AS answer_id, ans.selected_option, ans.answer_text, ans.is_correct,
            ans.file_original_name AS answer_file_name, ans.file_size AS answer_file_size, ans.file_mime_type AS answer_file_type,
            ans.feedback, ans.rubric_content, ans.rubric_completeness, ans.rubric_effort, ans.reviewed_at, ans.submitted_at
     FROM module_activities act
     LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = ?
     WHERE act.module_id = ? AND act.specialist_id = ?
     ORDER BY act.sort_order, act.id`,
    [req.user.id, assignment.id, assignment.specialist_id]
  );
  const activities = rows.map((row) => ({
    id: row.id,
    type: row.activity_type,
    prompt: row.prompt,
    options: row.activity_type === 'multiple_choice' ? parseOptions(row.options) : [],
    file: fileMeta(row.file_original_name, row.file_size, row.file_mime_type),
    done: isDone(row),
    // A multiple-choice answer is shown back only once it's right.
    selectedOption: Number(row.is_correct) === 1 ? row.selected_option : null,
    answerId: row.answer_id || null,
    answerText: row.answer_text || '',
    answerFile: fileMeta(row.answer_file_name, row.answer_file_size, row.answer_file_type),
    feedback: row.feedback || '',
    rubric: rubricOf(row),
    reviewedAt: row.reviewed_at,
    submittedAt: row.submitted_at,
  }));
  const completed = Boolean(assignment.certificate_id);
  const progress = { total: activities.length, done: activities.filter((activity) => activity.done).length };
  res.json({
    success: true,
    data: {
      // The specialist's own module for the topic (title, overview, hours), with
      // the training-design topic as the fallback.
      module: {
        id: assignment.id,
        slug: assignment.slug,
        title: assignment.module_title || assignment.title,
        topic: assignment.title,
        phase: assignment.phase,
        description: assignment.module_overview || assignment.description,
        hours: assignment.module_hours || assignment.hours,
      },
      specialist: { id: assignment.specialist_id, name: assignment.specialist_name, avatar: assignment.specialist_avatar || null },
      conversationId: assignment.conversation_id,
      completed,
      certificate: completed ? {
        id: assignment.certificate_id,
        issuedAt: assignment.certificate_issued_at,
        issuedBy: assignment.certificate_issuer || assignment.specialist_name,
        hasFile: Boolean(Number(assignment.certificate_has_file)),
      } : null,
      nextTopic: completed ? await nextTopicFor(req.user.id, assignment.id) : null,
      test: await learnerTestView(req.user.id, assignment, progress, completed),
      activities,
      progress,
    },
  });
}

const answerActivity = withUpload(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM module_activities WHERE id = ?', [req.params.activityId]);
  const activity = rows[0];
  const assignment = activity && await learnerAssignment(req.user.id, activity.module_id);
  if (!activity || !assignment || Number(assignment.specialist_id) !== Number(activity.specialist_id)) {
    return res.status(404).json({ success: false, message: 'Activity not found.' });
  }
  if (assignment.certificate_id) return res.status(409).json({ success: false, message: 'This topic is completed, so answers can no longer change.' });
  // With a pre-test, the activities open once it's taken.
  const tests = await loadTestState(req.user.id, activity.module_id, activity.specialist_id);
  if (tests.questions.length && !tests.pre) return res.status(409).json({ success: false, message: 'Take the pre-test first. The activities open after it.' });

  if (activity.activity_type === 'multiple_choice') {
    const selected = Number(req.body?.selectedOption);
    const options = parseOptions(activity.options);
    if (!Number.isInteger(selected) || selected < 0 || selected >= options.length) return res.status(400).json({ success: false, message: 'Choose an answer.' });
    const correct = selected === Number(activity.correct_option);
    await pool.query(
      `INSERT INTO module_activity_answers (activity_id, beneficiary_id, selected_option, is_correct)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option), is_correct = VALUES(is_correct),
         attempts = attempts + 1, submitted_at = NOW()`,
      [activity.id, req.user.id, selected, correct]
    );
    await logActivity({ userId: req.user.id, action: 'activity_answered', moduleId: activity.module_id, targetUserId: activity.specialist_id, details: correct ? 'Correct' : 'Not correct' });
    return res.json({ success: true, data: { correct } });
  }

  const text = typeof req.body?.answerText === 'string' ? req.body.answerText.trim() : '';
  if (text.length > MAX_ANSWER) return res.status(400).json({ success: false, message: `Keep your answer under ${MAX_ANSWER} characters.` });
  let file = null;
  let oldFile = null;
  if (activity.activity_type === 'written') {
    if (!text) return res.status(400).json({ success: false, message: 'Write your answer first.' });
  } else {
    // File task: a new file replaces the old one; keepFile=1 keeps the old one.
    const [[previous]] = await pool.query(
      'SELECT file_storage_name, file_original_name, file_mime_type, file_size FROM module_activity_answers WHERE activity_id = ? AND beneficiary_id = ?',
      [activity.id, req.user.id]
    );
    if (req.file) {
      file = await checkActivityFile(req.file);
      if (!file) return res.status(400).json({ success: false, message: BAD_FILE });
    } else if (req.body?.keepFile === '1' && previous?.file_storage_name) {
      file = { storageName: previous.file_storage_name, originalName: previous.file_original_name, mimeType: previous.file_mime_type, size: previous.file_size };
    }
    if (!file && !text) return res.status(400).json({ success: false, message: 'Attach your file or a photo of your answer, or type your answer.' });
    if (previous?.file_storage_name && previous.file_storage_name !== file?.storageName) oldFile = previous.file_storage_name;
  }

  // A new or changed answer waits for the specialist again.
  await pool.query(
    `INSERT INTO module_activity_answers
       (activity_id, beneficiary_id, answer_text, file_storage_name, file_original_name, file_mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text),
       file_storage_name = VALUES(file_storage_name), file_original_name = VALUES(file_original_name),
       file_mime_type = VALUES(file_mime_type), file_size = VALUES(file_size),
       feedback = NULL, rubric_content = NULL, rubric_completeness = NULL, rubric_effort = NULL,
       reviewed_at = NULL, attempts = attempts + 1, submitted_at = NOW()`,
    [activity.id, req.user.id, text || null, file?.storageName || null, file?.originalName || null, file?.mimeType || null, file?.size || null]
  );
  req.keepUpload = Boolean(req.file && file);
  await removeActivityFile(oldFile);
  const label = TYPE_LABELS[activity.activity_type].toLowerCase();
  await logActivity({ userId: req.user.id, action: 'activity_answered', moduleId: activity.module_id, targetUserId: activity.specialist_id, details: TYPE_LABELS[activity.activity_type] });
  const [[me]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  await notify(req.app, activity.specialist_id, {
    kind: 'answered', moduleId: activity.module_id, moduleTitle: assignment.title, senderName: me.full_name,
    body: `${me.full_name} answered a ${label} in ${assignment.title}`,
  });
  res.json({ success: true, data: { submitted: true } });
});

// Progress on each accepted topic, for the learner's module cards.
async function learnerProgress(req, res) {
  const [rows] = await pool.query(
    `SELECT a.module_id, COUNT(act.id) AS total,
            SUM(CASE WHEN (act.activity_type = 'multiple_choice' AND ans.is_correct = 1)
                       OR (act.activity_type <> 'multiple_choice' AND ans.id IS NOT NULL) THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN ans.reviewed_at IS NOT NULL AND ans.feedback IS NOT NULL THEN 1 ELSE 0 END) AS replies
     FROM elevate_module_assignments a
     LEFT JOIN module_activities act ON act.module_id = a.module_id AND act.specialist_id = a.specialist_id
     LEFT JOIN module_activity_answers ans ON ans.activity_id = act.id AND ans.beneficiary_id = a.beneficiary_id
     WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'
     GROUP BY a.module_id`,
    [req.user.id]
  );
  // Whether a pre-test or post-test is waiting, so the card's main button can say so.
  const [questionRows] = await pool.query(
    `SELECT a.module_id, COUNT(tq.id) AS n FROM elevate_module_assignments a
     JOIN module_test_questions tq ON tq.module_id = a.module_id AND tq.specialist_id = a.specialist_id
     WHERE a.beneficiary_id = ? AND a.assignment_status = 'assigned'
     GROUP BY a.module_id`,
    [req.user.id]
  );
  const [attemptRows] = await pool.query(
    `SELECT t.module_id, t.test_kind FROM module_test_attempts t
     JOIN elevate_module_assignments a ON a.beneficiary_id = t.beneficiary_id AND a.module_id = t.module_id
      AND a.specialist_id = t.specialist_id AND a.assignment_status = 'assigned'
     WHERE t.beneficiary_id = ?`,
    [req.user.id]
  );
  const hasTest = new Set(questionRows.filter((row) => Number(row.n) > 0).map((row) => Number(row.module_id)));
  const took = (moduleId, kind) => attemptRows.some((row) => Number(row.module_id) === Number(moduleId) && row.test_kind === kind);
  res.json({
    success: true,
    data: Object.fromEntries(rows.map((row) => {
      const total = Number(row.total) || 0;
      const done = Number(row.done) || 0;
      const test = hasTest.has(Number(row.module_id));
      return [row.module_id, {
        total, done, replies: Number(row.replies) || 0,
        preTestOpen: test && !took(row.module_id, 'pre'),
        postTestOpen: test && took(row.module_id, 'pre') && !took(row.module_id, 'post') && done >= total,
      }];
    })),
  });
}

module.exports = {
  withUpload,
  canAuthor,
  learnerAssignment,
  notify,
  listMine,
  createActivity,
  updateActivity,
  deleteActivity,
  specialistSummary,
  learnerAnswers,
  reviewAnswer,
  learnerModule,
  answerActivity,
  learnerProgress,
};
