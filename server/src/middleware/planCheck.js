const db = require('../config/database');
const { FREE_TIER_LIMITS } = require('../../../shared/constants');

/**
 * Middleware that attaches plan info to req.plan.
 * NEVER blocks sales — only sets limits for feature gating.
 */
async function attachPlan(req, res, next) {
  try {
    if (!req.user?.businessId) {
      req.plan = { plan: 'free', isPremium: false, limits: FREE_TIER_LIMITS };
      return next();
    }

    const business = await db('businesses')
      .where({ id: req.user.businessId })
      .select('plan', 'plan_expires_at')
      .first();

    if (!business) {
      req.plan = { plan: 'free', isPremium: false, limits: FREE_TIER_LIMITS };
      return next();
    }

    const now = new Date();
    const expiresAt = business.plan_expires_at ? new Date(business.plan_expires_at) : null;
    const isPremium = business.plan === 'premium' && expiresAt && expiresAt > now;

    req.plan = {
      plan: isPremium ? 'premium' : 'free',
      isPremium,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      limits: isPremium ? null : FREE_TIER_LIMITS,
    };

    next();
  } catch (err) {
    // On error, default to free — never crash the request
    req.plan = { plan: 'free', isPremium: false, limits: FREE_TIER_LIMITS };
    next();
  }
}

/**
 * Soft gate: returns 403 with upgrade message for premium features.
 * Use on specific routes that require premium (reports, exports, etc.)
 * NEVER use on sales, inventory, or auth routes.
 */
function requirePremium(req, res, next) {
  if (req.plan?.isPremium) {
    return next();
  }
  return res.status(403).json({
    error: {
      message: 'Premium feature — activate with a subscription PIN',
      code: 'PREMIUM_REQUIRED',
      plan: req.plan?.plan || 'free',
    },
  });
}

module.exports = { attachPlan, requirePremium };
