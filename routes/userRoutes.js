import express from 'express';
import { getUsers, getTechnicians, createUser, getUserById, updateUser, deleteUser } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/technicians', getTechnicians);
router.get('/', authorize('superadmin'), getUsers);
router.post('/', authorize('superadmin'), createUser);
router.get('/:id', authorize('superadmin'), getUserById);
router.put('/:id', authorize('superadmin'), updateUser);
router.delete('/:id', authorize('superadmin'), deleteUser);

export default router;