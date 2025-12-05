import mongoose from 'mongoose';

const audioSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    originalLink: {
        type: String,
        required: true
    },
    fileId: {
        type: String,
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export default mongoose.model('Audio', audioSchema);
