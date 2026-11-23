const express = require('express');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const {
  updateUserStatus,
  analytics,
} = require('../controllers/adminController');
const { listActivity, getReport } = require('../controllers/reportController');
const {
  listBeneficiaries,
  getBeneficiary,
  listSpecialists,
  getSpecialist,
  listUsers,
  navCounts,
} = require('../controllers/adminDirectoryController');
const { listModulesForReview, getModuleForReview, reviewSpecialistModule } = require('../controllers/specialistModuleController');
const { beneficiaryPortfolio } = require('../controllers/portfolioController');
const { adminOverview } = require('../controllers/adminOverviewController');
const {
  getTrainingDesign,
  addPhase,
  updatePhase,
  deletePhase,
  addModule,
  updateModule,
  moveModule,
  setModuleHidden,
  removeModule,
} = require('../controllers/trainingDesignController');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'moderator'));

router.get('/overview', adminOverview);
router.get('/nav-counts', navCounts);
router.get('/analytics', analytics);
// Tracking and reporting: activity log, and participation / progress / completed reports.
router.get('/activity', listActivity);
router.get('/reports', getReport);

// Directories (search, filter, server-side pagination).
router.get('/beneficiaries', listBeneficiaries);
router.get('/beneficiaries/:id', getBeneficiary);
router.get('/beneficiaries/:id/portfolio', beneficiaryPortfolio);
router.get('/specialists', listSpecialists);
router.get('/specialists/:id', getSpecialist);
router.get('/users', listUsers);
router.patch('/users/:userId/status', updateUserStatus);

// Training design: the ELEVATE phases (each with its year) and their modules, managed by the project leader.
router.get('/training-design', getTrainingDesign);
router.post('/training-design/phases', addPhase);
router.patch('/training-design/phases/:number', updatePhase);
router.delete('/training-design/phases/:number', deletePhase);
router.post('/training-design/modules', addModule);
router.put('/training-design/modules/:moduleId', updateModule);
router.post('/training-design/modules/:moduleId/move', moveModule);
router.patch('/training-design/modules/:moduleId', setModuleHidden);
router.delete('/training-design/modules/:moduleId', removeModule);

// Module approval: the modules specialists create for ELEVATE topics.
router.get('/modules', listModulesForReview);
router.get('/modules/:moduleId', getModuleForReview);
router.patch('/modules/:moduleId', reviewSpecialistModule);

module.exports = router;
