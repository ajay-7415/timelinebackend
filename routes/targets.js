import express from 'express';
import Target from '../models/Target.js';
import jwt from 'jsonwebtoken';

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

// Get all targets
router.get('/', async (req, res) => {
    try {
        const targets = await Target.find({ user: req.userId }).sort({ deadline: 1 });
        res.json(targets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a target
router.post('/', async (req, res) => {
    try {
        const target = new Target({
            ...req.body,
            user: req.userId
        });
        await target.save();
        res.status(201).json(target);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Toggle completion status
router.patch('/:id/toggle', async (req, res) => {
    try {
        const target = await Target.findOne({ _id: req.params.id, user: req.userId });
        if (!target) {
            return res.status(404).json({ message: 'Target not found' });
        }
        target.isCompleted = !target.isCompleted;
        await target.save();
        res.json(target);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete a target
router.delete('/:id', async (req, res) => {
    try {
        const target = await Target.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!target) {
            return res.status(404).json({ message: 'Target not found' });
        }
        res.json({ message: 'Target deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;