const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { getSummary, getSpecialistAnalytics } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', requireAuth, getSummary);
router.get('/specialist-analytics', requireAuth, getSpecialistAnalytics);

module.exports = router;
