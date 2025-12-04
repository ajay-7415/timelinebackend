import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import timetableRoutes from './routes/timetable.js';
import trackingRoutes from './routes/tracking.js';
import targetRoutes from './routes/targets.js';
import './database.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/targets', targetRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Timetable Tracker API is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
