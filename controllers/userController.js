import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import User from '../models/User.js';

export const getUsers = asyncHandler(async (req, res) => {
    const { role, search, isActive, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
        User.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
        User.countDocuments(query),
    ]);
    res.status(200).json(new ApiResponse(200, { users, total, page: Number(page), pages: Math.ceil(total / limit) || 1 }));
});

export const getTechnicians = asyncHandler(async (req, res) => {
    const technicians = await User.find({ role: 'technician', isActive: true }).select('name email phone department');
    res.status(200).json(new ApiResponse(200, technicians));
});

export const createUser = asyncHandler(async (req, res) => {
    const { name, email, password, role, phone, department } = req.body;
    if (!name || !email || !password || !role) throw new ApiError(400, 'Name, email, password and role are required');
    if (!['superadmin', 'technician', 'user'].includes(role)) throw new ApiError(400, 'Invalid role');
    if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new ApiError(409, 'A user with this email already exists');

    const user = await User.create({ name, email, password, role, phone, department });
    res.status(201).json(new ApiResponse(201, user.toSafeObject(), 'User created successfully'));
});

export const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.status(200).json(new ApiResponse(200, user.toSafeObject()));
});

export const updateUser = asyncHandler(async (req, res) => {
    const { name, role, phone, department, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) {
        if (!['superadmin', 'technician', 'user'].includes(role)) throw new ApiError(400, 'Invalid role');
        user.role = role;
    }
    await user.save();
    res.status(200).json(new ApiResponse(200, user.toSafeObject(), 'User updated successfully'));
});

export const deleteUser = asyncHandler(async (req, res) => {
    if (req.params.id === String(req.user._id)) throw new ApiError(400, 'You cannot deactivate your own account');
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    user.isActive = false;
    await user.save();
    res.status(200).json(new ApiResponse(200, null, 'User deactivated successfully'));
});