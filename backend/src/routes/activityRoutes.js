const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { uploadActivityFile } = require('../middleware/activityFileUpload');
const {
  listMine,
  createActivity,
  createMultipleChoiceActivities,
  updateActivity,
  deleteActivity,
  specialistSummary,
  learnerAnswers,
  reviewAnswer,
  learnerModule,
  answerActivity,
  learnerProgress,
} = require('../controllers/activityController');
const { taskFileLink, answerFileLink, streamActivityFile } = require('../controllers/activityFileController');

const router = express.Router();

// File-task files, opened through a short-lived link (the token is the auth).
router.get('/files/:kind(task|answer|portfolio|resume)/:id', streamActivityFile);
router.get('/answers/:answerId/file/link', requireAuth, answerFileLink);
router.get('/:activityId/file/link', requireAuth, taskFileLink);
// Specialists: their activities for a topic, learners' progress and answers.
// Creating and editing take JSON, or a form with a file for file tasks.
// /bulk adds many multiple-choice activities at once (a pasted quiz).
router.get('/', requireAuth, listMine);
router.post('/', requireAuth, uploadActivityFile, createActivity);
router.post('/bulk', requireAuth, createMultipleChoiceActivities);
router.get('/summary', requireAuth, specialistSummary);
router.get('/answers', requireAuth, learnerAnswers);
router.post('/answers/:answerId/review', requireAuth, reviewAnswer);
// Learners: progress on their topics, the module page, answering.
router.get('/progress', requireAuth, learnerProgress);
router.get('/module/:moduleId', requireAuth, learnerModule);
router.post('/:activityId/answer', requireAuth, uploadActivityFile, answerActivity);
router.put('/:activityId', requireAuth, uploadActivityFile, updateActivity);
router.delete('/:activityId', requireAuth, deleteActivity);

module.exports = router;
