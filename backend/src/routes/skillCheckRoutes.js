const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getQuestionnaire,
  getMySkillCheck,
  submitSkillCheck,
} = require('../controllers/skillCheckController');

const router = express.Router();

router.get('/', requireAuth, getQuestionnaire);
router.get('/me', requireAuth, getMySkillCheck);
router.post('/me', requireAuth, submitSkillCheck);

module.exports = router;
