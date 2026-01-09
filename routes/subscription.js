import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';

const router = express.Router();

// Initialize Razorpay instance (will work with or without keys)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

// Get subscription status
router.get('/status', authenticate, async (req, res) => {
    try {
        const user = req.user;

        // Calculate days remaining in trial
        let daysRemaining = 0;
        if (user.subscriptionStatus === 'trial' && user.trialEndsAt) {
            const now = new Date();
            const diffTime = user.trialEndsAt - now;
            daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        res.json({
            subscriptionStatus: user.subscriptionStatus,
            isActive: user.hasActiveSubscription(),
            trial: {
                isTrialActive: user.isTrialActive(),
                trialEndsAt: user.trialEndsAt,
                daysRemaining: daysRemaining
            },
            subscription: {
                razorpaySubscriptionId: user.razorpaySubscriptionId,
                subscriptionEndsAt: user.subscriptionEndsAt
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching subscription status', error: error.message });
    }
});

// Create Razorpay subscription order
router.post('/create-order', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const planId = process.env.RAZORPAY_PLAN_ID || 'plan_placeholder';

        // Check if Razorpay is configured
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({
                message: 'Payment system not configured yet. Please contact administrator.',
                note: 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env file'
            });
        }

        // Create subscription
        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            customer_notify: 1,
            total_count: 12, // 12 months
            notes: {
                userId: user._id.toString(),
                email: user.email
            }
        });

        // Update user with subscription details
        user.razorpaySubscriptionId = subscription.id;
        await user.save();

        res.json({
            subscriptionId: subscription.id,
            planId: subscription.plan_id,
            status: subscription.status,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            message: 'Subscription order created successfully'
        });
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        res.status(500).json({
            message: 'Error creating subscription order',
            error: error.message
        });
    }
});

// Verify payment signature
router.post('/verify-payment', authenticate, async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
        const user = req.user;

        if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'placeholder_secret') {
            return res.status(503).json({
                message: 'Payment verification not available. Razorpay not configured.'
            });
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        // Update user subscription status
        user.subscriptionStatus = 'active';
        user.razorpaySubscriptionId = razorpay_subscription_id;
        user.subscriptionEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await user.save();

        res.json({
            message: 'Payment verified successfully',
            subscriptionStatus: user.subscriptionStatus,
            subscriptionEndsAt: user.subscriptionEndsAt
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ message: 'Error verifying payment', error: error.message });
    }
});

// Webhook handler for Razorpay events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret || webhookSecret === 'placeholder_secret') {
            console.log('Webhook received but secret not configured');
            return res.status(200).json({ received: true });
        }

        const signature = req.headers['x-razorpay-signature'];

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(400).json({ message: 'Invalid webhook signature' });
        }

        const event = req.body.event;
        const payload = req.body.payload;

        console.log('Razorpay webhook event:', event);

        // Handle different webhook events
        switch (event) {
            case 'subscription.activated':
                // Subscription activated
                const subId = payload.subscription.entity.id;
                const userId = payload.subscription.entity.notes?.userId;

                if (userId) {
                    const user = await User.findById(userId);
                    if (user) {
                        user.subscriptionStatus = 'active';
                        user.razorpaySubscriptionId = subId;
                        user.subscriptionEndsAt = new Date(payload.subscription.entity.current_end * 1000);
                        await user.save();
                    }
                }
                break;

            case 'subscription.charged':
                // Subscription payment successful
                const chargedSubId = payload.subscription.entity.id;
                const user = await User.findOne({ razorpaySubscriptionId: chargedSubId });

                if (user) {
                    user.subscriptionStatus = 'active';
                    user.subscriptionEndsAt = new Date(payload.subscription.entity.current_end * 1000);
                    await user.save();
                }
                break;

            case 'subscription.cancelled':
            case 'subscription.completed':
                // Subscription cancelled or completed
                const cancelledSubId = payload.subscription.entity.id;
                const cancelledUser = await User.findOne({ razorpaySubscriptionId: cancelledSubId });

                if (cancelledUser) {
                    cancelledUser.subscriptionStatus = 'cancelled';
                    await cancelledUser.save();
                }
                break;

            case 'subscription.payment_failed':
                // Payment failed
                console.log('Subscription payment failed:', payload.subscription.entity.id);
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
});

// Cancel subscription
router.post('/cancel', authenticate, async (req, res) => {
    try {
        const user = req.user;

        if (!user.razorpaySubscriptionId) {
            return res.status(400).json({ message: 'No active subscription found' });
        }

        if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'placeholder_secret') {
            return res.status(503).json({
                message: 'Subscription cancellation not available. Razorpay not configured.'
            });
        }

        // Cancel subscription in Razorpay
        await razorpay.subscriptions.cancel(user.razorpaySubscriptionId);

        // Update user status
        user.subscriptionStatus = 'cancelled';
        await user.save();

        res.json({
            message: 'Subscription cancelled successfully',
            subscriptionStatus: user.subscriptionStatus
        });
    } catch (error) {
        console.error('Subscription cancellation error:', error);
        res.status(500).json({ message: 'Error cancelling subscription', error: error.message });
    }
});

export default router;
