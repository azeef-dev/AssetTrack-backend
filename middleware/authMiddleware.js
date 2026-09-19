import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';

export const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        throw new ApiError(401, 'Not authorized, no token provided');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) throw new ApiError(401, 'User no longer exists');
        if (!user.isActive) throw new ApiError(403, 'Account has been deactivated');
        req.user = user;
        next();
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(401, 'Not authorized, token invalid or expired');
    }
});

// Attaches req.user if a valid token is present, but never blocks the request.
export const optionalAuth = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user && user.isActive) req.user = user;
        } catch (err) {
            // invalid/expired token on an optional route - just proceed as guest
        }
    }
    next();
});

export const authorize = (...roles) => (req, res, next) => {
    if (!req.user) throw new ApiError(401, 'Not authorized');
    if (!roles.includes(req.user.role)) {
        throw new ApiError(403, `Role '${req.user.role}' is not allowed to perform this action`);
    }
    next();
};