import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

export const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
        throw new ApiError(400, 'Name, email and password are required');
    }
    if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const user = await User.create({ name, email, password, phone, role: 'user' });
    const token = generateToken(user._id, user.role);

    res.status(201).json(new ApiResponse(201, { user: user.toSafeObject(), token }, 'Registration successful'));
});

export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, 'Email and password are required');

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
        throw new ApiError(401, 'Invalid email or password');
    }
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated. Contact an administrator.');

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, user.role);
    res.status(200).json(new ApiResponse(200, { user: user.toSafeObject(), token }, 'Login successful'));
});

export const getMe = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, req.user.toSafeObject()));
});

export const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone, department, avatar } = req.body;
    const user = await User.findById(req.user._id);
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (avatar !== undefined) user.avatar = avatar;
    await user.save();
    res.status(200).json(new ApiResponse(200, user.toSafeObject(), 'Profile updated'));
});

export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new ApiError(400, 'Current and new password are required');
    if (newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
        throw new ApiError(401, 'Current password is incorrect');
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json(new ApiResponse(200, null, 'Password changed successfully'));
});