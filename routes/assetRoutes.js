import express from 'express';
import {
    createAsset, getAssets, getAssetById, getPublicAsset, updateAsset,
    retireAsset, regenerateQRCode, getAssetHistory, getBulkQRCodes,
} from '../controllers/assetController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/public/:assetCode', getPublicAsset);

router.use(protect);

router.get('/', getAssets);
router.post('/', authorize('superadmin'), createAsset);
router.post('/bulk-qrcodes', authorize('superadmin'), getBulkQRCodes);
router.get('/:id', getAssetById);
router.put('/:id', authorize('superadmin'), updateAsset);
router.delete('/:id', authorize('superadmin'), retireAsset);
router.get('/:id/qrcode', authorize('superadmin'), regenerateQRCode);
router.get('/:id/history', getAssetHistory);

export default router;