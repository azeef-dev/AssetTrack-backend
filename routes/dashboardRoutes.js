import express from 'express';
import { getAdminStats, getTechnicianStats } from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/stats', authorize('superadmin'), getAdminStats);
router.get('/technician', authorize('technician'), getTechnicianStats);

export default router;