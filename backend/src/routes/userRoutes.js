const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { requireAuth } = require('../middleware/authMiddleware');
const {
	getMyProfile,
	updateMyProfile,
	getPublicProfile,
	getMyCircumstances,
	updateMyCircumstances,
} = require('../controllers/userController');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
	storage: multer.diskStorage({
		destination: uploadDirectory,
		filename: (req, file, callback) => {
			callback(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
		},
	}),
	fileFilter: (req, file, callback) => callback(null, file.mimetype.startsWith('image/')),
	limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, upload.single('avatar'), updateMyProfile);
router.get('/me/circumstances', requireAuth, getMyCircumstances);
router.put('/me/circumstances', requireAuth, updateMyCircumstances);
router.get('/:id', getPublicProfile);

module.exports = router;
