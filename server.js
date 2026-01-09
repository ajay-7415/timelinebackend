import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import timetableRoutes from './routes/timetable.js';
import trackingRoutes from './routes/tracking.js';
import targetRoutes from './routes/targets.js';
import audioRoutes from './routes/audio.js';
import subscriptionRoutes from './routes/subscription.js';
import './database.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://timelinebackend.onrender.com', 'https://timetable-frontend-zeta.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Timetable Tracker API is running' });
});

// Deployment: 2025-12-06 - Added audio routes

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
