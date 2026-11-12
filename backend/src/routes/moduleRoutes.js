const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  uploadModuleResources,
  handleUploadErrors,
  MAX_FILES_PER_UPLOAD,
} = require('../middleware/moduleResourceUpload');
const {
  createModuleResourceToken,
  streamModuleResource,
  addMaterialFiles,
  addMaterialLink,
  deleteMaterial,
} = require('../controllers/moduleResourceController');
const { completeLearner, replaceCertificate, reopenLearner } = require('../controllers/learnerProgressController');
const { uploadCertificate } = require('../middleware/certificateUpload');
const { listModules } = require('../controllers/moduleController');

const router = express.Router();

router.get('/', requireAuth, listModules);
router.get('/:moduleId/resources/:resourceId/token', requireAuth, createModuleResourceToken);
router.get('/:moduleId/resources/:resourceId/file', streamModuleResource);
router.post(
  '/:moduleId/resources/files',
  requireAuth,
  handleUploadErrors(uploadModuleResources.array('files', MAX_FILES_PER_UPLOAD)),
  addMaterialFiles
);
router.post('/:moduleId/resources/links', requireAuth, addMaterialLink);
router.delete('/:moduleId/resources/:resourceId', requireAuth, deleteMaterial);
router.post('/:moduleId/learners/:beneficiaryId/complete', requireAuth, uploadCertificate, completeLearner);
router.put('/:moduleId/learners/:beneficiaryId/certificate', requireAuth, uploadCertificate, replaceCertificate);
router.delete('/:moduleId/learners/:beneficiaryId/complete', requireAuth, reopenLearner);

module.exports = router;
