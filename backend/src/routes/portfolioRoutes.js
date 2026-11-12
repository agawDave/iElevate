const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { uploadActivityFile } = require('../middleware/activityFileUpload');
const {
  myPortfolio, createItem, updateItem, deleteItem, saveReflection, showAnswerInCareer, showItemInCareer,
} = require('../controllers/portfolioController');
const {
  saveProfile, uploadResume, removeResume, createEntry, updateEntry, deleteEntry,
  requestRecommendation, removeRecommendation, writeRecommendation, declineRecommendation,
} = require('../controllers/careerController');
const { portfolioFileLink, resumeFileLink } = require('../controllers/activityFileController');

const router = express.Router();

// A beneficiary's learning and career portfolio (admins use /api/admin/beneficiaries/:id/portfolio).
router.get('/me', requireAuth, myPortfolio);
// Projects, awards, photos, licenses, trainings and letters they add themselves.
router.post('/items', requireAuth, uploadActivityFile, createItem);
router.put('/items/:itemId/career', requireAuth, showItemInCareer);
router.put('/items/:itemId', requireAuth, uploadActivityFile, updateItem);
router.delete('/items/:itemId', requireAuth, deleteItem);
router.get('/items/:itemId/file/link', requireAuth, portfolioFileLink);
// On a written or file-task answer: "What I learned", and the career-portfolio pick.
router.put('/reflections/:answerId', requireAuth, saveReflection);
router.put('/work/:answerId/career', requireAuth, showAnswerInCareer);
// The resume.
router.put('/career/profile', requireAuth, saveProfile);
router.put('/career/resume', requireAuth, uploadActivityFile, uploadResume);
router.delete('/career/resume', requireAuth, removeResume);
router.get('/career/resume/:userId/file/link', requireAuth, resumeFileLink);
router.post('/career/entries', requireAuth, createEntry);
router.put('/career/entries/:entryId', requireAuth, updateEntry);
router.delete('/career/entries/:entryId', requireAuth, deleteEntry);
// Recommendations: the beneficiary asks, the specialist writes or declines.
router.post('/recommendations', requireAuth, requestRecommendation);
router.delete('/recommendations/:id', requireAuth, removeRecommendation);
router.put('/recommendations/:id/write', requireAuth, writeRecommendation);
router.post('/recommendations/:id/decline', requireAuth, declineRecommendation);

module.exports = router;
