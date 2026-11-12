const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { getLearnerForSpecialist } = require('../controllers/learnerProfileController');

const router = express.Router();

// A beneficiary's information, for the specialist they applied to or learn with.
router.get('/:beneficiaryId', requireAuth, getLearnerForSpecialist);

module.exports = router;
