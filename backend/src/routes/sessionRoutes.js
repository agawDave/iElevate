const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createSession,
  listMySessions,
  updateSessionStatus,
  createModuleSession,
  listMyModuleSessions,
  updateModuleSessionStatus,
} = require('../controllers/sessionController');

const router = express.Router();

router.get('/me', requireAuth, listMySessions);
router.get('/modules/me', requireAuth, listMyModuleSessions);
router.post('/modules/:moduleId', requireAuth, createModuleSession);
router.patch('/modules/:sessionId/status', requireAuth, updateModuleSessionStatus);
router.post('/', requireAuth, createSession);
router.patch('/:sessionId/status', requireAuth, updateSessionStatus);

module.exports = router;
