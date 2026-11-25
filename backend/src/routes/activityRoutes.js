const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { specialistSummary, learnerModule, learnerProgress } = require('../controllers/activityController');
const { answerFileLink, streamActivityFile } = require('../controllers/activityFileController');

const router = express.Router();

// Files (past module answers in the portfolio, portfolio items, résumés),
// opened through a short-lived link (the token is the auth).
router.get('/files/:kind(answer|portfolio|resume)/:id', streamActivityFile);
router.get('/answers/:answerId/file/link', requireAuth, answerFileLink);
// Specialists: their learners' test scores and face-to-face hours.
router.get('/summary', requireAuth, specialistSummary);
// Learners: progress on their topics, and the module page.
router.get('/progress', requireAuth, learnerProgress);
router.get('/module/:moduleId', requireAuth, learnerModule);

module.exports = router;
