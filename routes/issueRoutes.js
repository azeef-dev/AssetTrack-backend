import express from 'express';
import {
    createIssue, getIssues, getIssueById, trackIssue, assignIssue,
    updateIssueStatus, reopenIssue, getCriticalIssues,
} from '../controllers/issueController.js';
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';
import { publicReportLimiter } from '../middleware/rateLimiter.js';
import upload, { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', publicReportLimiter, optionalAuth, upload.array('evidence', 5), uploadToCloudinary('maintainiq/issues'), createIssue);
router.get('/track/:issueNumber', trackIssue);

router.use(protect);

router.get('/critical', getCriticalIssues);
router.get('/', getIssues);
router.get('/:id', getIssueById);
router.put('/:id/assign', authorize('superadmin'), assignIssue);
router.put('/:id/status', authorize('superadmin', 'technician'), updateIssueStatus);
router.put('/:id/reopen', authorize('superadmin'), reopenIssue);

export default router;