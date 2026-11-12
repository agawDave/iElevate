const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { createCertificateLink, streamCertificate } = require('../controllers/certificateController');

const router = express.Router();

router.get('/:certificateId/link', requireAuth, createCertificateLink);
// Opened in a new tab, so it carries a short-lived token instead of a header.
router.get('/:certificateId/file', streamCertificate);

module.exports = router;
