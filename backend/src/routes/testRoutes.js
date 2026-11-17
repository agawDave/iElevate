const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { listQuestions, createQuestion, createQuestions, updateQuestion, deleteQuestion, takeTest } = require('../controllers/testController');

const router = express.Router();

// Specialists: the pre-test / post-test questions for a topic they teach.
// /bulk adds many at once (a pasted quiz).
router.get('/', requireAuth, listQuestions);
router.post('/', requireAuth, createQuestion);
router.post('/bulk', requireAuth, createQuestions);
router.put('/:questionId', requireAuth, updateQuestion);
router.delete('/:questionId', requireAuth, deleteQuestion);
// Learners: take the pre-test or the post-test (kind = pre | post).
router.post('/module/:moduleId/:kind', requireAuth, takeTest);

module.exports = router;
