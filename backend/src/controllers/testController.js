const { pool } = require('../config/db');
const { logActivity } = require('../lib/activityLog');
const { recordLearningSession } = require('../lib/learningSessions');
const { loadTestState, loadActivityProgress, attemptDto, parseJson } = require('../lib/moduleTests');
const { canAuthor, learnerAssignment, notify } = require('./activityController');

// Pre-test and post-test for a module (tables module_test_questions and module_test_attempts).
// The specialist writes multiple-choice questions; the learner answers the
// same questions before the activities and after them. The correct choices
// never reach the learner until their post-test is done.
const MAX_QUESTIONS = 30;
const MAX_PROMPT = 1000;
const MAX_CHOICE = 190;
const KIND_LABELS = { pre: 'Pre-test', post: 'Post-test' };

function readQuestion(body = {}) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Write the question.' };
  if (prompt.length > MAX_PROMPT) return { error: `Keep the question under ${MAX_PROMPT} characters.` };
  const options = (Array.isArray(body.options) ? body.options : []).map((option) => String(option ?? '').trim());
  if (options.length < 2 || options.length > 4 || options.some((option) => !option)) return { error: 'Give 2 to 4 choices, none of them empty.' };
  if (options.some((option) => option.length > MAX_CHOICE)) return { error: `Keep each choice under ${MAX_CHOICE} characters.` };
  const correct = Number(body.correctOption);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return { error: 'Mark which choice is correct.' };
  return { value: { prompt, options, correct } };
}

// ------------------------------------------------------------ specialists

async function listQuestions(req, res) {
  const moduleId = Number(req.query.moduleId);
  if (!moduleId || !await canAuthor(req.user.id, moduleId)) return res.status(403).json({ success: false, message: "You don't teach this topic." });
  const [rows] = await pool.query(
    'SELECT id, prompt, options, correct_option FROM module_test_questions WHERE module_id = ? AND specialist_id = ? ORDER BY sort_order, id',
    [moduleId, req.user.id]
  );
  const [taken] = await pool.query(
    'SELECT test_kind, COUNT(*) AS n FROM module_test_attempts WHERE module_id = ? AND specialist_id = ? GROUP BY test_kind',
    [moduleId, req.user.id]
  );
  const count = (kind) => Number(taken.find((row) => row.test_kind === kind)?.n) || 0;
  res.json({
    success: true,
    data: {
      questions: rows.map((row) => ({ id: row.id, prompt: row.prompt, options: parseJson(row.options, []), correctOption: Number(row.correct_option) })),
      taken: { pre: count('pre'), post: count('post') },
    },
  });
}

async function createQuestion(req, res) {
  const moduleId = Number(req.body?.moduleId);
  if (!moduleId || !await canAuthor(req.user.id, moduleId)) return res.status(403).json({ success: false, message: "You don't teach this topic." });
  const input = readQuestion(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const [[count]] = await pool.query(
    'SELECT COUNT(*) AS total, COALESCE(MAX(sort_order), 0) AS last FROM module_test_questions WHERE module_id = ? AND specialist_id = ?',
    [moduleId, req.user.id]
  );
  if (Number(count.total) >= MAX_QUESTIONS) return res.status(400).json({ success: false, message: `A test can have up to ${MAX_QUESTIONS} questions.` });
  const { prompt, options, correct } = input.value;
  const [result] = await pool.query(
    'INSERT INTO module_test_questions (module_id, specialist_id, prompt, options, correct_option, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [moduleId, req.user.id, prompt, JSON.stringify(options), correct, Number(count.last) + 1]
  );
  res.status(201).json({ success: true, message: 'Question added.', data: { id: result.insertId } });
}

// Many questions at once (the specialist pasted a quiz). All are added, or none.
async function createQuestions(req, res) {
  const moduleId = Number(req.body?.moduleId);
  if (!moduleId || !await canAuthor(req.user.id, moduleId)) return res.status(403).json({ success: false, message: "You don't teach this topic." });
  const list = Array.isArray(req.body?.questions) ? req.body.questions : [];
  if (!list.length) return res.status(400).json({ success: false, message: 'Paste at least one question.' });
  if (list.length > MAX_QUESTIONS) return res.status(400).json({ success: false, message: `A test can have up to ${MAX_QUESTIONS} questions.` });
  const values = [];
  for (const [index, item] of list.entries()) {
    const input = readQuestion(item);
    if (input.error) return res.status(400).json({ success: false, message: `Question ${index + 1}: ${input.error}` });
    values.push(input.value);
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS total, COALESCE(MAX(sort_order), 0) AS last FROM module_test_questions WHERE module_id = ? AND specialist_id = ?',
      [moduleId, req.user.id]
    );
    const total = Number(count.total);
    const room = MAX_QUESTIONS - total;
    if (values.length > room) {
      await connection.rollback();
      const message = room > 0
        ? `A test can have up to ${MAX_QUESTIONS} questions. You have ${total}, so you can add ${room} more.`
        : `Your test already has ${MAX_QUESTIONS} questions, the most it can have.`;
      return res.status(400).json({ success: false, message });
    }
    const rows = values.map(({ prompt, options, correct }, index) => [moduleId, req.user.id, prompt, JSON.stringify(options), correct, Number(count.last) + 1 + index]);
    await connection.query('INSERT INTO module_test_questions (module_id, specialist_id, prompt, options, correct_option, sort_order) VALUES ?', [rows]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const added = values.length;
  res.status(201).json({ success: true, message: `${added} question${added === 1 ? '' : 's'} added.`, data: { added } });
}

async function findOwnQuestion(req) {
  const [rows] = await pool.query('SELECT * FROM module_test_questions WHERE id = ? AND specialist_id = ?', [req.params.questionId, req.user.id]);
  return rows[0] || null;
}

// Changing questions doesn't change scores already given: each attempt keeps
// a copy of the questions as they were.
async function updateQuestion(req, res) {
  const question = await findOwnQuestion(req);
  if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });
  const input = readQuestion(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const { prompt, options, correct } = input.value;
  await pool.query('UPDATE module_test_questions SET prompt = ?, options = ?, correct_option = ? WHERE id = ?', [prompt, JSON.stringify(options), correct, question.id]);
  res.json({ success: true, message: 'Question saved.' });
}

async function deleteQuestion(req, res) {
  const question = await findOwnQuestion(req);
  if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });
  await pool.query('DELETE FROM module_test_questions WHERE id = ?', [question.id]);
  res.json({ success: true, message: 'Question removed.' });
}

// ---------------------------------------------------------------- learners

async function takeTest(req, res) {
  const { kind } = req.params;
  if (!KIND_LABELS[kind]) return res.status(404).json({ success: false, message: 'Test not found.' });
  const assignment = await learnerAssignment(req.user.id, Number(req.params.moduleId));
  if (!assignment) return res.status(403).json({ success: false, message: 'This module opens once a specialist accepts your application.' });
  if (assignment.certificate_id) return res.status(409).json({ success: false, message: 'This topic is completed, so the tests are closed.' });

  const state = await loadTestState(req.user.id, assignment.id, assignment.specialist_id);
  if (!state.questions.length) return res.status(404).json({ success: false, message: 'This topic has no test.' });
  if (state[kind]) return res.status(409).json({ success: false, message: `You already took the ${KIND_LABELS[kind].toLowerCase()}.` });
  if (kind === 'post') {
    if (!state.pre) return res.status(409).json({ success: false, message: 'Take the pre-test first.' });
    const progress = await loadActivityProgress(req.user.id, assignment.id, assignment.specialist_id);
    if (progress.done < progress.total) return res.status(409).json({ success: false, message: 'Finish all the activities first, then take the post-test.' });
  }

  const picks = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const review = [];
  for (const question of state.questions) {
    const selected = Number(picks[question.id]);
    if (!Number.isInteger(selected) || selected < 0 || selected >= question.options.length) {
      return res.status(400).json({ success: false, message: 'Answer every question before you submit.' });
    }
    review.push({ questionId: question.id, prompt: question.prompt, options: question.options, correctOption: question.correctOption, selected, correct: selected === question.correctOption });
  }
  const score = review.filter((item) => item.correct).length;
  const total = review.length;
  try {
    await pool.query(
      `INSERT INTO module_test_attempts (module_id, specialist_id, beneficiary_id, test_kind, score, total, answers)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [assignment.id, assignment.specialist_id, req.user.id, kind, score, total, JSON.stringify(review)]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: `You already took the ${KIND_LABELS[kind].toLowerCase()}.` });
    throw error;
  }
  await recordLearningSession({
    moduleId: assignment.id, beneficiaryId: req.user.id, specialistId: assignment.specialist_id, preTest: kind === 'pre', postTest: kind === 'post',
  });
  await logActivity({ userId: req.user.id, action: 'module_test', moduleId: assignment.id, targetUserId: assignment.specialist_id, details: `${KIND_LABELS[kind]} · ${score} of ${total}` });
  const [[me]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  const before = kind === 'post' && state.pre ? ` (pre-test: ${state.pre.score} of ${state.pre.total})` : '';
  await notify(req.app, assignment.specialist_id, {
    kind: 'test', moduleId: assignment.id, moduleTitle: assignment.title, senderName: me.full_name,
    body: `${me.full_name} took the ${KIND_LABELS[kind].toLowerCase()} in ${assignment.title}: ${score} of ${total}${before}`,
  });
  res.status(201).json({
    success: true,
    data: {
      score,
      total,
      // The correct answers are shown only after the post-test.
      review: kind === 'post' ? review : null,
      pre: kind === 'post' ? attemptDto(state.pre) : null,
    },
  });
}

module.exports = { listQuestions, createQuestion, createQuestions, updateQuestion, deleteQuestion, takeTest };
