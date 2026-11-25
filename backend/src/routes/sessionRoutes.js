const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createModuleSession,
  getBookingFreeTimes,
  listMyModuleSessions,
  updateModuleSessionStatus,
  listMyLearningSessions,
  createOpenSession,
  listOpenSessions,
  joinOpenSession,
  leaveOpenSession,
} = require('../controllers/sessionController');

const router = express.Router();

router.get('/modules/me', requireAuth, listMyModuleSessions);
router.get('/learning/me', requireAuth, listMyLearningSessions);
// Open face-to-face sessions: a specialist posts one, beneficiaries who need the topic join.
router.get('/open', requireAuth, listOpenSessions);
router.post('/open', requireAuth, createOpenSession);
router.post('/open/:sessionId/join', requireAuth, joinOpenSession);
router.delete('/open/:sessionId/join', requireAuth, leaveOpenSession);
router.get('/modules/:moduleId/free-times', requireAuth, getBookingFreeTimes);
router.post('/modules/:moduleId', requireAuth, createModuleSession);
router.patch('/modules/:sessionId/status', requireAuth, updateModuleSessionStatus);

module.exports = router;
