import express from 'express';
import Audio from '../models/Audio.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
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

// Get all audio links for the logged-in user
router.get('/', async (req, res) => {
    try {
        const audioLinks = await Audio.find({ user: req.userId })
            .sort({ addedAt: -1 });
        res.json(audioLinks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new audio link
router.post('/', async (req, res) => {
    try {
        const { title, originalLink, fileId } = req.body;

        const audio = new Audio({
            user: req.userId,
            title,
            originalLink,
            fileId
        });

        const savedAudio = await audio.save();
        res.status(201).json(savedAudio);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update audio title
router.patch('/:id', async (req, res) => {
    try {
        const { title } = req.body;

        const audio = await Audio.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!audio) {
            return res.status(404).json({ message: 'Audio not found' });
        }

        audio.title = title;
        const updatedAudio = await audio.save();
        res.json(updatedAudio);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Note: No delete route since audio links are permanent

export default router;
