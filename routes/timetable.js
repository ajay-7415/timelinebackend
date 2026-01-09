import express from 'express';
import jwt from 'jsonwebtoken';
import { TimetableEntry } from '../database.js';
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

// Get all timetable entries
router.get('/', async (req, res) => {
    try {
        const entries = await TimetableEntry.find({ user: req.userId }).sort({ start_time: 1 });
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get today's schedule
router.get('/today', async (req, res) => {
    try {
        const today = new Date().getDay();
        // Get all entries that don't exclude today
        const entries = await TimetableEntry.find({
            user: req.userId,
            exclude_days: { $ne: today }
        }).sort({ start_time: 1 });
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get week's schedule
router.get('/week', async (req, res) => {
    try {
        const entries = await TimetableEntry.find({ user: req.userId }).sort({ start_time: 1 });

        // Group by day of week (excluding holidays)
        const weekSchedule = {};
        for (let i = 0; i < 7; i++) {
            weekSchedule[i] = entries.filter(e => !e.exclude_days.includes(i));
        }

        res.json(weekSchedule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new timetable entry
router.post('/', async (req, res) => {
    try {
        const { title, description, start_time, end_time, is_recurring, exclude_days } = req.body;

        if (!title || !start_time || !end_time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newEntry = new TimetableEntry({
            user: req.userId,
            title,
            description,
            start_time,
            end_time,
            is_recurring,
            exclude_days: exclude_days || []
        });

        await newEntry.save();
        res.status(201).json(newEntry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update timetable entry
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, start_time, end_time, is_recurring, exclude_days } = req.body;

        const updatedEntry = await TimetableEntry.findOneAndUpdate(
            { _id: id, user: req.userId },
            { title, description, start_time, end_time, is_recurring, exclude_days },
            { new: true, runValidators: true }
        );

        if (!updatedEntry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json(updatedEntry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete timetable entry
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedEntry = await TimetableEntry.findOneAndDelete({ _id: id, user: req.userId });

        if (!deletedEntry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
