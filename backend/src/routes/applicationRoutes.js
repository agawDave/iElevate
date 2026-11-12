const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  listOptions,
  applyToTopic,
  cancelApplication,
  listIncoming,
  acceptApplication,
  declineApplication,
} = require('../controllers/applicationController');

const router = express.Router();

router.get('/options', requireAuth, listOptions);
router.get('/incoming', requireAuth, listIncoming);
router.post('/:moduleId', requireAuth, applyToTopic);
router.delete('/:moduleId', requireAuth, cancelApplication);
router.post('/:moduleId/:beneficiaryId/accept', requireAuth, acceptApplication);
router.post('/:moduleId/:beneficiaryId/decline', requireAuth, declineApplication);

module.exports = router;
