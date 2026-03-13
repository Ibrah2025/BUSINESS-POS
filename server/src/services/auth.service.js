const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const env = require('../config/env');

const SALT_ROUNDS = 12;

/**
 * Hash a PIN using bcrypt.
 * @param {string} pin - Raw PIN string
 * @returns {Promise<string>} Bcrypt hash
 */
async function hashPin(pin) {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Compare a raw PIN against a bcrypt hash.
 * @param {string} pin - Raw PIN
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>}
 */
async function verifyPin(pin, hash) {
  return bcrypt.compare(pin, hash);
}

/**
 * Generate JWT access token and refresh token for a user.
 * @param {object} user - User record with id, business_id, name, role
 * @returns {{ token: string, refreshToken: string }}
 */
function generateTokens(user) {
  const payload = {
    id: user.id,
    businessId: user.business_id,
    name: user.name,
    role: user.role,
  };

  const token = jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(
    { id: user.id, businessId: user.business_id, type: 'refresh' },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn }
  );

  return { token, refreshToken };
}

/**
 * Register a new business and owner user.
 * @param {object} body - { businessName, businessType, name, phone, pin }
 * @returns {Promise<{ user: object, business: object, token: string, refreshToken: string }>}
 */
async function register(body) {
  const { businessName, businessType, name, ownerName, phone, pin } = body;
  const userName = name || ownerName;

  const pinHash = await hashPin(pin);

  const result = await db.transaction(async (trx) => {
    const [business] = await trx('businesses')
      .insert({
        name: businessName,
        type: businessType || 'retail',
      })
      .returning('*');

    const [user] = await trx('users')
      .insert({
        business_id: business.id,
        name: userName,
        phone,
        pin_hash: pinHash,
        role: 'owner',
      })
      .returning('*');

    // Create default settings
    await trx('settings').insert({
      business_id: business.id,
    });

    return { user, business };
  });

  const tokens = generateTokens(result.user);

  // Store refresh token hash
  const refreshHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
  await db('users').where({ id: result.user.id }).update({ refresh_token_hash: refreshHash });

  const { pin_hash, ...safeUser } = result.user;

  return {
    user: safeUser,
    business: result.business,
    ...tokens,
  };
}

/**
 * Authenticate a user by phone and PIN.
 * @param {object} body - { phone, pin, businessId? }
 * @returns {Promise<{ user: object, token: string, refreshToken: string }>}
 */
async function login(body) {
  const { phone, pin, businessId } = body;

  const query = db('users').where({ phone, is_active: true });
  if (businessId) {
    query.andWhere({ business_id: businessId });
  }

  const user = await query.first();
  if (!user) {
    const error = new Error('Invalid phone number or PIN');
    error.status = 401;
    throw error;
  }

  const valid = await verifyPin(pin, user.pin_hash);
  if (!valid) {
    const error = new Error('Invalid phone number or PIN');
    error.status = 401;
    throw error;
  }

  const tokens = generateTokens(user);

  // Store refresh token hash
  const refreshHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
  await db('users').where({ id: user.id }).update({ refresh_token_hash: refreshHash });

  const { pin_hash, ...safeUser } = user;

  return { user: safeUser, ...tokens };
}

/**
 * Refresh an expired access token using a valid refresh token.
 * @param {object} body - { refreshToken }
 * @returns {Promise<{ token: string, refreshToken: string }>}
 */
async function refresh(body) {
  const { refreshToken } = body;

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    throw error;
  }

  if (payload.type !== 'refresh') {
    const error = new Error('Invalid token type');
    error.status = 401;
    throw error;
  }

  // Validate refresh token hash against stored value
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const user = await db('users')
    .where({ id: payload.id, is_active: true })
    .first();

  if (!user) {
    const error = new Error('User not found');
    error.status = 401;
    throw error;
  }

  // If stored hash exists and doesn't match, token was already rotated (possible reuse attack)
  if (user.refresh_token_hash && user.refresh_token_hash !== tokenHash) {
    // Invalidate all tokens for this user (potential token theft)
    await db('users').where({ id: user.id }).update({ refresh_token_hash: null });
    const error = new Error('Token reuse detected, please login again');
    error.status = 401;
    throw error;
  }

  // Issue new tokens (rotation)
  const tokens = generateTokens(user);

  // Store hash of new refresh token
  const newTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
  await db('users').where({ id: user.id }).update({ refresh_token_hash: newTokenHash });

  return tokens;
}

/**
 * Logout a user. Placeholder for token blacklisting via Redis.
 * @param {object} user - Decoded JWT payload
 * @returns {Promise<void>}
 */
async function logout(user) {
  // Invalidate refresh token on logout
  if (user?.id) {
    await db('users').where({ id: user.id }).update({ refresh_token_hash: null });
  }
}

/**
 * List all staff for a business.
 */
async function listStaff(businessId) {
  const rows = await db('users')
    .where({ business_id: businessId })
    .select('id', 'name', 'phone', 'role', 'is_active', 'created_at', 'updated_at')
    .orderBy('created_at', 'asc');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    role: r.role,
    active: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Create a new staff member for a business.
 */
async function createStaff(businessId, data) {
  const { name, phone, role, pin } = data;

  // Check phone uniqueness within business
  const existing = await db('users')
    .where({ business_id: businessId, phone })
    .first();
  if (existing) {
    const error = new Error('A staff member with this phone number already exists');
    error.status = 409;
    throw error;
  }

  const pinHash = await hashPin(pin);

  const [user] = await db('users')
    .insert({
      business_id: businessId,
      name,
      phone,
      pin_hash: pinHash,
      role: role || 'attendant',
    })
    .returning('*');

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    active: user.is_active,
    createdAt: user.created_at,
  };
}

/**
 * Update a staff member.
 */
async function updateStaff(businessId, staffId, data) {
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.role !== undefined) updates.role = data.role;
  if (data.active !== undefined) updates.is_active = data.active;
  if (data.pin) updates.pin_hash = await hashPin(data.pin);
  updates.updated_at = db.fn.now();

  const [user] = await db('users')
    .where({ id: staffId, business_id: businessId })
    .update(updates)
    .returning('*');

  if (!user) {
    const error = new Error('Staff member not found');
    error.status = 404;
    throw error;
  }

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    active: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  hashPin,
  verifyPin,
  generateTokens,
  listStaff,
  createStaff,
  updateStaff,
};
