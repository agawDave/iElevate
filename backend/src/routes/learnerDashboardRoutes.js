const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { learnerDashboard } = require('../controllers/learnerDashboardController');

const router = express.Router();

// The beneficiary's dashboard: next step, numbers, topics, sessions, feedback.
router.get('/me', requireAuth, learnerDashboard);

module.exports = router;
