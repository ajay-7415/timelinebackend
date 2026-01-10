import express from 'express';
import jwt from 'jsonwebtoken';
import { TimetableEntry, CompletionTracking } from '../database.js';
import User from '../models/User.js';
import { requireActiveSubscription } from '../middleware/subscription.js';

const router = express.Router();

// Middleware to authenticate user and attach user object
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Please authenticate' });
    }
};

// Apply authentication and subscription check to all routes
router.use(auth);
router.use(requireActiveSubscription);

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
        // Get completion status for this specific date AND these tasks
        const taskIds = tasks.map(t => t._id);
        const completions = await CompletionTracking.find({
            completion_date: new Date(date),
            timetable_id: { $in: taskIds }
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
            const taskIds = tasks.map(t => t._id);
            const completions = await CompletionTracking.find({
                completion_date: currentDate,
                timetable_id: { $in: taskIds }
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
            const taskIds = tasks.map(t => t._id);
            const completions = await CompletionTracking.find({
                completion_date: currentDate,
                timetable_id: { $in: taskIds }
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

// Get gamification stats (streaks, badges)
router.get('/stats', async (req, res) => {
    try {
        // 1. Get all completions sorted by date
        // 1. Find all timetable entries for this user first
        const userTasks = await TimetableEntry.find({ user: req.userId }).select('_id');
        const userTaskIds = userTasks.map(t => t._id);

        // 2. Get all completions for these tasks sorted by date
        const userCompletions = await CompletionTracking.find({
            timetable_id: { $in: userTaskIds }
        }).populate('timetable_id', 'title')
            .sort({ completion_date: -1 });

        const completedTasks = userCompletions.filter(c => c.status === 'completed');
        const missedTasks = userCompletions.filter(c => c.status === 'missed');

        // 2. Calculate Streak
        let currentStreak = 0;
        let longestStreak = 0; // To be implemented with more complex logic if needed

        if (completedTasks.length > 0) {
            // Get unique dates
            const uniqueDates = [...new Set(completedTasks.map(c => c.completion_date.toISOString().split('T')[0]))].sort().reverse();

            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            // Check if streak is active (completed today or yesterday)
            if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
                currentStreak = 1;
                let currentDate = new Date(uniqueDates[0]);

                for (let i = 1; i < uniqueDates.length; i++) {
                    const prevDate = new Date(uniqueDates[i]);
                    const diffTime = Math.abs(currentDate - prevDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 1) {
                        currentStreak++;
                        currentDate = prevDate;
                    } else {
                        break;
                    }
                }
            }
        }

        // 3. Define Badges
        const badges = [];
        const totalCompleted = completedTasks.length;

        // Streak Badges
        if (currentStreak >= 3) badges.push({ id: 'streak_3', icon: '🔥', name: '3 Day Streak', description: 'Consistency is key!' });
        if (currentStreak >= 7) badges.push({ id: 'streak_7', icon: '⚡', name: '7 Day Streak', description: 'Unstoppable force!' });
        if (currentStreak >= 30) badges.push({ id: 'streak_30', icon: '👑', name: 'Monthly Master', description: '30 days of greatness' });

        // Completion Badges
        if (totalCompleted >= 1) badges.push({ id: 'first_win', icon: '🌱', name: 'First Step', description: 'Completed your first task' });
        if (totalCompleted >= 10) badges.push({ id: 'completed_10', icon: '🥉', name: 'Getting Started', description: '10 tasks completed' });
        if (totalCompleted >= 50) badges.push({ id: 'completed_50', icon: '🥈', name: 'Productivity Pro', description: '50 tasks completed' });
        if (totalCompleted >= 100) badges.push({ id: 'completed_100', icon: '🥇', name: 'Grand Master', description: '100 tasks completed' });

        // Perfect Day Logic (Optional - simple check if yesterday was perfect)
        // This requires more queries, keeping it simple for now or checking only recent history

        res.json({
            streak: currentStreak,
            totalCompleted,
            totalMissed: missedTasks.length,
            badges
        });

    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
