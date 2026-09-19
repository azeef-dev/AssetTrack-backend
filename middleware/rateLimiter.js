import rateLimit from 'express-rate-limit';

export const publicReportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many issue reports from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const aiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    message: { success: false, message: 'AI request limit reached, please try again in a few minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});