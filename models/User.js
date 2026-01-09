import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    // Subscription fields
    subscriptionStatus: {
        type: String,
        enum: ['trial', 'active', 'expired', 'cancelled'],
        default: 'trial'
    },
    trialEndsAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    razorpayCustomerId: {
        type: String,
        default: null
    },
    razorpaySubscriptionId: {
        type: String,
        default: null
    },
    razorpayOrderId: {
        type: String,
        default: null
    },
    subscriptionEndsAt: {
        type: Date,
        default: null
    },
    lastLoginAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 8);
    }
    next();
});

// Method to check password
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// Method to check if trial is still active
userSchema.methods.isTrialActive = function () {
    return this.subscriptionStatus === 'trial' && this.trialEndsAt > new Date();
};

// Method to check if user has active subscription (trial or paid)
userSchema.methods.hasActiveSubscription = function () {
    if (this.subscriptionStatus === 'trial') {
        return this.trialEndsAt > new Date();
    }
    if (this.subscriptionStatus === 'active') {
        return !this.subscriptionEndsAt || this.subscriptionEndsAt > new Date();
    }
    return false;
};

const User = mongoose.model('User', userSchema);

export default User;
