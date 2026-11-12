const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getMessageNotifications,
  getModuleConversations,
  getMessages,
  markConversationRead,
  getInbox,
} = require('../controllers/messageController');

const router = express.Router();

router.get('/notifications', requireAuth, getMessageNotifications);
router.get('/inbox', requireAuth, getInbox);
router.get('/modules/:moduleId/conversations', requireAuth, getModuleConversations);
router.patch('/conversations/:conversationId/read', requireAuth, markConversationRead);
router.get('/conversations/:conversationId/messages', requireAuth, getMessages);

module.exports = router;
