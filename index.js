import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { seedSuperAdmin } from './utils/seedAdmin.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

dotenv.config();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use(globalLimiter);

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        next(err);
    }
});

// NOTE: evidence files now live on Cloudinary (see middleware/uploadMiddleware.js),
// so there is no local /uploads static route anymore — nothing to serve.

app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'AssetTrack API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
    res.send('AssetTrack API is running. See /api/health');
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (!process.env.VERCEL) {
    connectDB()
        .then(() => seedSuperAdmin())
        .then(() => {
            app.listen(PORT, () => {
                console.log(`AssetTrack backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
            });
        })
        .catch((err) => {
            console.error('Failed to start server:', err.message);
            process.exit(1);
        });
} else {
    connectDB().then(() => seedSuperAdmin()).catch((err) => console.error('Seed error:', err.message));
}

export default app;