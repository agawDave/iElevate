const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { getMyModule, saveMyModule, submitMyModule } = require('../controllers/specialistModuleController');

// A specialist's own module for one ELEVATE topic (topicId = the topic's id).
const router = express.Router();

router.get('/:topicId', requireAuth, getMyModule);
router.put('/:topicId', requireAuth, saveMyModule);
router.post('/:topicId/submit', requireAuth, submitMyModule);

module.exports = router;
