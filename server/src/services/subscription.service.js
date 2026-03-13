const crypto = require('crypto');
const db = require('../config/database');

/**
 * Generate a batch of subscription PINs.
 * Format: BIZPOS-XXXX-XXXX (16-char alphanumeric, easy to read/type)
 */
async function generatePins({ count = 10, days = 30, planType = 'premium', price = null, agentName = null, agentPhone = null }) {
  const batchId = `BATCH-${Date.now().toString(36).toUpperCase()}`;
  const pins = [];

  for (let i = 0; i < count; i++) {
    // Generate random 8-char alphanumeric (uppercase, no confusing chars like 0/O, 1/I/L)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length];
    }
    const pin = `BIZPOS-${code.slice(0, 4)}-${code.slice(4, 8)}`;

    pins.push({
      pin,
      days,
      plan_type: planType,
      status: 'unused',
      batch_id: batchId,
      agent_name: agentName,
      agent_phone: agentPhone,
      price,
    });
  }

  const inserted = await db('subscription_pins').insert(pins).returning('*');

  return {
    batchId,
    count: inserted.length,
    pins: inserted.map((p) => ({
      pin: p.pin,
      days: p.days,
      planType: p.plan_type,
      price: p.price,
    })),
  };
}

/**
 * Redeem a subscription PIN for a business.
 * Extends existing plan if already premium.
 */
async function redeemPin(businessId, pinCode) {
  const cleanPin = pinCode.trim().toUpperCase();

  return db.transaction(async (trx) => {
    // Find the PIN
    const pin = await trx('subscription_pins')
      .where({ pin: cleanPin, status: 'unused' })
      .first();

    if (!pin) {
      const used = await trx('subscription_pins').where({ pin: cleanPin, status: 'used' }).first();
      if (used) {
        const error = new Error('This PIN has already been used');
        error.status = 400;
        throw error;
      }
      const error = new Error('Invalid PIN. Check and try again');
      error.status = 404;
      throw error;
    }

    // Get current business plan
    const business = await trx('businesses').where({ id: businessId }).first();
    if (!business) {
      const error = new Error('Business not found');
      error.status = 404;
      throw error;
    }

    // Calculate new expiry
    let newExpiry;
    const now = new Date();
    if (business.plan === 'premium' && business.plan_expires_at && new Date(business.plan_expires_at) > now) {
      // Extend from current expiry
      newExpiry = new Date(business.plan_expires_at);
    } else {
      // Start fresh from now
      newExpiry = new Date(now);
    }
    newExpiry.setDate(newExpiry.getDate() + pin.days);

    // Update business plan
    await trx('businesses').where({ id: businessId }).update({
      plan: pin.plan_type,
      plan_expires_at: newExpiry,
      plan_pin_used: cleanPin,
      updated_at: now,
    });

    // Mark PIN as used
    await trx('subscription_pins').where({ id: pin.id }).update({
      status: 'used',
      redeemed_by: businessId,
      redeemed_at: now,
    });

    return {
      plan: pin.plan_type,
      daysAdded: pin.days,
      expiresAt: newExpiry.toISOString(),
      message: `Premium activated for ${pin.days} days`,
    };
  });
}

/**
 * Get current plan status for a business.
 */
async function getPlanStatus(businessId) {
  const business = await db('businesses')
    .where({ id: businessId })
    .select('plan', 'plan_expires_at')
    .first();

  if (!business) {
    return { plan: 'free', daysRemaining: 0, expired: false };
  }

  const now = new Date();
  const isPremium = business.plan === 'premium';
  const expiresAt = business.plan_expires_at ? new Date(business.plan_expires_at) : null;
  const expired = isPremium && expiresAt && expiresAt < now;
  const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))) : 0;

  return {
    plan: expired ? 'free' : business.plan,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    daysRemaining: expired ? 0 : daysRemaining,
    expired: !!expired,
  };
}

/**
 * List all PINs (admin/agent view).
 */
async function listPins({ batchId, status, limit = 50, offset = 0 }) {
  const query = db('subscription_pins').orderBy('created_at', 'desc');

  if (batchId) query.where({ batch_id: batchId });
  if (status) query.where({ status });

  const pins = await query.limit(limit).offset(offset);

  return pins.map((p) => ({
    id: p.id,
    pin: p.pin,
    days: p.days,
    planType: p.plan_type,
    status: p.status,
    price: p.price,
    batchId: p.batch_id,
    agentName: p.agent_name,
    redeemedBy: p.redeemed_by,
    redeemedAt: p.redeemed_at,
    createdAt: p.created_at,
  }));
}

module.exports = {
  generatePins,
  redeemPin,
  getPlanStatus,
  listPins,
};
