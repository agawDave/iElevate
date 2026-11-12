const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { getSpecialistAnalytics } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/specialist-analytics', requireAuth, getSpecialistAnalytics);

module.exports = router;
