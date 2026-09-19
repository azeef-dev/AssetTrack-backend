import express from 'express';
import { getAssetHistory, getAllHistory } from '../controllers/historyController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/asset/:assetId', getAssetHistory);
router.get('/', authorize('superadmin'), getAllHistory);

export default router;