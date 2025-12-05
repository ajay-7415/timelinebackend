import express from 'express';
import Audio from '../models/Audio.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get all audio links for the logged-in user
router.get('/', auth, async (req, res) => {
    try {
        const audioLinks = await Audio.find({ user: req.userId })
            .sort({ addedAt: -1 });
        res.json(audioLinks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new audio link
router.post('/', auth, async (req, res) => {
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
router.patch('/:id', auth, async (req, res) => {
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
