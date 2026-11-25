const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { listMyNotifications, markNotificationsRead } = require('../controllers/notificationController');

const router = express.Router();

router.get('/', requireAuth, listMyNotifications);
router.post('/read', requireAuth, markNotificationsRead);

module.exports = router;
