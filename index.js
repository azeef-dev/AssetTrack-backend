import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & core middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use(globalLimiter);

// Serve uploaded evidence files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'MaintainIQ API is running', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
    res.send('MaintainIQ API is running. See /api/health');
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();
    await seedSuperAdmin();
    app.listen(PORT, () => {
        console.log(`MaintainIQ backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
};

startServer();