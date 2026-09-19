import express from 'express';
import { triageIssue, generateMaintenanceSummary } from '../controllers/aiController.js';
import { protect, optionalAuth, authorize } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/triage', aiLimiter, optionalAuth, triageIssue);
router.post('/summary', protect, authorize('superadmin', 'technician'), aiLimiter, generateMaintenanceSummary);

export default router;