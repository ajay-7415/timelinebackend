// Middleware to check if user has active subscription (trial or paid)
export const requireActiveSubscription = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Check if user has active subscription
        if (!req.user.hasActiveSubscription()) {
            const isTrialExpired = req.user.subscriptionStatus === 'trial' && req.user.trialEndsAt < new Date();

            return res.status(403).json({
                message: isTrialExpired
                    ? 'Your free trial has expired. Please subscribe to continue.'
                    : 'Active subscription required to access this feature.',
                subscriptionStatus: req.user.subscriptionStatus,
                trialEndsAt: req.user.trialEndsAt,
                subscriptionEndsAt: req.user.subscriptionEndsAt
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Error checking subscription status' });
    }
};

export default requireActiveSubscription;
