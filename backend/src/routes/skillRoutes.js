const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  searchSkills,
  listElevateTopics,
  listMySkills,
  addSkillToProfile,
  replaceLearningGoals,
  replaceTeachingTopics,
  updateTeachingDetails,
  removeSkillFromProfile,
} = require('../controllers/skillController');

const router = express.Router();

router.get('/search', searchSkills);
router.get('/elevate-topics', requireAuth, listElevateTopics);
router.get('/me', requireAuth, listMySkills);
router.post('/me', requireAuth, addSkillToProfile);
router.put('/me/learning-goals', requireAuth, replaceLearningGoals);
router.put('/me/teaching-topics', requireAuth, replaceTeachingTopics);
router.put('/me/teaching-details', requireAuth, updateTeachingDetails);
router.delete('/me/:id', requireAuth, removeSkillFromProfile);

module.exports = router;
