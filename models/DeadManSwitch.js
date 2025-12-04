import mongoose from 'mongoose';

const deadManSwitchSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    fileName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    whatsappNumbers: [{
        type: String,
        required: true,
        trim: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    triggeredAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const DeadManSwitch = mongoose.model('DeadManSwitch', deadManSwitchSchema);

export default DeadManSwitch;
