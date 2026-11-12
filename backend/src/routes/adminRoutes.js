const express = require('express');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const {
  updateUserStatus,
  listDisputes,
  resolveDispute,
  systemStats,
  listPendingModules,
  reviewModule,
  analytics,
} = require('../controllers/adminController');
const { listActivity, getReport } = require('../controllers/reportController');
const {
  listBeneficiaries,
  getBeneficiary,
  listSpecialists,
  getSpecialist,
  listModulesForReview,
  listUsers,
  navCounts,
} = require('../controllers/adminDirectoryController');
const { beneficiaryPortfolio } = require('../controllers/portfolioController');
const { adminOverview } = require('../controllers/adminOverviewController');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'moderator'));

router.get('/overview', adminOverview);
router.get('/stats', systemStats);
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

router.get('/modules', listModulesForReview);
router.get('/modules/pending', listPendingModules);
router.patch('/modules/:moduleId', reviewModule);

router.get('/disputes', listDisputes);
router.patch('/disputes/:disputeId', resolveDispute);

module.exports = router;
