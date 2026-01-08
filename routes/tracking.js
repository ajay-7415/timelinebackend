import express from 'express';
import jwt from 'jsonwebtoken';
import { TimetableEntry, CompletionTracking } from '../database.js';

const router = express.Router();

// Middleware to authenticate user
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Please authenticate' });
    }
};

router.use(auth);

// Mark task as completed or missed
router.post('/mark', async (req, res) => {
    try {
        const { timetable_id, completion_date, status, notes } = req.body;

        if (!timetable_id || !completion_date || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (status !== 'completed' && status !== 'missed') {
            return res.status(400).json({ error: 'Status must be "completed" or "missed"' });
        }

        // Use findOneAndUpdate with upsert to handle duplicates
        const tracking = await CompletionTracking.findOneAndUpdate(
            { timetable_id, completion_date: new Date(completion_date) },
            { status, notes },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(201).json(tracking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get daily statistics
router.get('/daily/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const dayOfWeek = new Date(date).getDay();

        // Get all tasks that don't exclude this day
        const tasks = await TimetableEntry.find({
            user: req.userId,
            exclude_days: { $ne: dayOfWeek }
        });

        // Get completion status for this specific date
        const completions = await CompletionTracking.find({
            completion_date: new Date(date)
        }).populate('timetable_id', 'title');

        const total = tasks.length;
        const completed = completions.filter(c => c.status === 'completed').length;
        const missed = completions.filter(c => c.status === 'missed').length;
        const pending = total - completed - missed;

        res.json({
            date,
            total,
            completed,
            missed,
            pending,
            completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
            tasks,
            completions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get weekly statistics
router.get('/weekly/:startDate', async (req, res) => {
    try {
        const { startDate } = req.params;
        const start = new Date(startDate);
        const weekStats = [];

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayOfWeek = currentDate.getDay();

            const tasks = await TimetableEntry.find({
                user: req.userId,
                exclude_days: { $ne: dayOfWeek }
            });
            const completions = await CompletionTracking.find({
                completion_date: currentDate
            });

            const total = tasks.length;
            const completed = completions.filter(c => c.status === 'completed').length;
            const missed = completions.filter(c => c.status === 'missed').length;

            weekStats.push({
                date: dateStr,
                dayOfWeek,
                total,
                completed,
                missed,
                pending: total - completed - missed,
                completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
            });
        }

        const weekTotal = weekStats.reduce((sum, day) => sum + day.total, 0);
        const weekCompleted = weekStats.reduce((sum, day) => sum + day.completed, 0);
        const weekMissed = weekStats.reduce((sum, day) => sum + day.missed, 0);

        res.json({
            startDate,
            days: weekStats,
            summary: {
                total: weekTotal,
                completed: weekCompleted,
                missed: weekMissed,
                pending: weekTotal - weekCompleted - weekMissed,
                completionRate: weekTotal > 0 ? ((weekCompleted / weekTotal) * 100).toFixed(1) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get monthly statistics
router.get('/monthly/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const daysInMonth = endDate.getDate();

        const monthStats = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month - 1, day);
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayOfWeek = currentDate.getDay();

            const tasks = await TimetableEntry.find({
                user: req.userId,
                exclude_days: { $ne: dayOfWeek }
            });
            const completions = await CompletionTracking.find({
                completion_date: currentDate
            });

            const total = tasks.length;
            const completed = completions.filter(c => c.status === 'completed').length;
            const missed = completions.filter(c => c.status === 'missed').length;

            monthStats.push({
                date: dateStr,
                day,
                dayOfWeek,
                total,
                completed,
                missed,
                pending: total - completed - missed,
                completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
            });
        }

        const monthTotal = monthStats.reduce((sum, day) => sum + day.total, 0);
        const monthCompleted = monthStats.reduce((sum, day) => sum + day.completed, 0);
        const monthMissed = monthStats.reduce((sum, day) => sum + day.missed, 0);

        res.json({
            year: parseInt(year),
            month: parseInt(month),
            days: monthStats,
            summary: {
                total: monthTotal,
                completed: monthCompleted,
                missed: monthMissed,
                pending: monthTotal - monthCompleted - monthMissed,
                completionRate: monthTotal > 0 ? ((monthCompleted / monthTotal) * 100).toFixed(1) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get completion history for specific task
router.get('/history/:timetableId', async (req, res) => {
    try {
        const { timetableId } = req.params;

        const history = await CompletionTracking.find({ timetable_id: timetableId })
            .sort({ completion_date: -1 });

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
