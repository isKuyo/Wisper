// ═══════════════════════════════════════════════════════════════
// RATE LIMITER MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

const rateLimit = require('express-rate-limit');

// Skip rate limit for owner users
const skipForOwner = (req) => {
  // Check if user is authenticated and is owner
  if (req.user && req.user.role === 'owner') {
    return true;
  }
  return false;
};

// Default rate limiter
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  },
  skip: skipForOwner
});

// Strict rate limiter for sensitive endpoints
const strictRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: {
      message: 'Too many attempts, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForOwner
});

// Rate limiter for key validation (loader)
const loaderRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30,
  message: {
    success: false,
    error: {
      message: 'Too many validation attempts',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use HWID if available, otherwise IP
    return req.body?.hwid || req.ip || 'unknown';
  },
  skip: skipForOwner
});

// Admin rate limiter (more permissive) - Owner has no limit
const adminRateLimiter = rateLimit({
  windowMs: 60000,
  max: 200,
  message: {
    success: false,
    error: {
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForOwner
});

module.exports = {
  rateLimiter,
  strictRateLimiter,
  loaderRateLimiter,
  adminRateLimiter
};
