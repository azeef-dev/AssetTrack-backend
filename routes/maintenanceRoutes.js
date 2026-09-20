import express from 'express';
import {
    createMaintenanceRecord, getMaintenanceByIssue, getMaintenanceById,
    updateMaintenanceRecord, getAllMaintenanceRecords,
} from '../controllers/maintenanceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload, { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('superadmin'), getAllMaintenanceRecords);
router.post('/', authorize('superadmin', 'technician'), upload.array('evidence', 5), uploadToCloudinary('maintainiq/maintenance'), createMaintenanceRecord);
router.get('/issue/:issueId', getMaintenanceByIssue);
router.get('/:id', getMaintenanceById);
router.put('/:id', authorize('superadmin', 'technician'), updateMaintenanceRecord);

export default router;