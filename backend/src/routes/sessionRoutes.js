const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createModuleSession,
  listMyModuleSessions,
  updateModuleSessionStatus,
} = require('../controllers/sessionController');

const router = express.Router();

router.get('/modules/me', requireAuth, listMyModuleSessions);
router.post('/modules/:moduleId', requireAuth, createModuleSession);
router.patch('/modules/:sessionId/status', requireAuth, updateModuleSessionStatus);

module.exports = router;
