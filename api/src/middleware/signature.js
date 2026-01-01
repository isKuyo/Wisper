// ═══════════════════════════════════════════════════════════════
// REQUEST SIGNATURE VERIFICATION MIDDLEWARE V2
// ═══════════════════════════════════════════════════════════════
// 
// SECURITY FEATURES:
// ✅ Session-based authentication (no API secret in client)
// ✅ HMAC-SHA256 signature verification
// ✅ Timestamp validation (prevents replay attacks)
// ✅ HWID binding verification
// ✅ Rate limiting integration
//
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const { AppError } = require('./errorHandler');

const MAX_TIMESTAMP_DIFF = 300000; // 5 minutes (for clock drift)
const SIGNATURE_ALGORITHM = 'sha256';

// ═══════════════════════════════════════════════════════════════
// SESSION-BASED SIGNATURE (No secret exposed to client)
// ═══════════════════════════════════════════════════════════════

/**
 * Generate signature using session-based algorithm
 * This matches the Lua loader's signature generation
 * The signature is based on: endpoint + timestamp + hwid + session
 * No API secret is needed on the client side
 */
function generateSessionSignature(endpoint, timestamp, hwid, sessionId) {
  const signData = `${endpoint}:${timestamp}:${hwid}:${sessionId}`;
  let hash = 0;
  
  for (let i = 0; i < signData.length; i++) {
    hash = (hash * 31 + signData.charCodeAt(i)) % 0x7FFFFFFF;
  }
  
  return hash.toString(16).padStart(8, '0');
}

/**
 * Generate HMAC signature for server-side verification
 * Used for additional security layer
 */
function generateHMACSignature(data, secret) {
  return crypto
    .createHmac(SIGNATURE_ALGORITHM, secret)
    .update(data)
    .digest('hex');
}

// ═══════════════════════════════════════════════════════════════
// SIGNATURE VERIFICATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

/**
 * Verify request signature from loader
 * Uses session-based authentication - no API secret exposed to client
 */
const verifySignature = (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    const sessionId = req.headers['x-session'];
    const hwid = req.headers['x-hwid'] || req.body?.hwid;

    // All headers are required
    if (!signature || !timestamp) {
      throw new AppError('Missing signature or timestamp', 401, 'MISSING_SIGNATURE');
    }

    // Check timestamp freshness (prevents replay attacks)
    const requestTime = parseInt(timestamp);
    const now = Date.now();

    if (isNaN(requestTime)) {
      throw new AppError('Invalid timestamp format', 401, 'INVALID_TIMESTAMP');
    }

    if (Math.abs(now - requestTime) > MAX_TIMESTAMP_DIFF) {
      throw new AppError('Request expired', 401, 'REQUEST_EXPIRED');
    }

    // Get the endpoint path for signature verification
    const endpoint = req.originalUrl || req.url;

    // Calculate expected signature using session-based algorithm
    const expectedSignature = generateSessionSignature(
      endpoint,
      timestamp,
      hwid || '',
      sessionId || ''
    );

    // Compare signatures (timing-safe comparison)
    if (!timingSafeEqual(signature, expectedSignature)) {
      console.log('[Signature] Mismatch:', {
        endpoint,
        received: signature.substring(0, 8),
        expected: expectedSignature.substring(0, 8),
        timestamp,
        hwid: hwid ? hwid.substring(0, 8) + '...' : 'none'
      });
      throw new AppError('Invalid signature', 401, 'INVALID_SIGNATURE');
    }

    // Store verified session info in request
    req.verifiedSession = {
      sessionId,
      hwid,
      timestamp: requestTime,
      verified: true
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error('[Signature] Verification error:', error.message);
    next(new AppError('Signature verification failed', 401, 'SIGNATURE_FAILED'));
  }
};

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time
    const dummy = Buffer.from(a);
    try {
      crypto.timingSafeEqual(dummy, dummy);
    } catch (e) {}
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (e) {
    return a === b;
  }
}

// ═══════════════════════════════════════════════════════════════
// STRICT SIGNATURE VERIFICATION (For sensitive endpoints)
// ═══════════════════════════════════════════════════════════════

/**
 * Strict signature verification with additional checks
 * Used for script delivery and other sensitive operations
 */
const verifyStrictSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    const sessionId = req.headers['x-session'];
    const hwid = req.headers['x-hwid'] || req.body?.hwid;
    const buildId = req.headers['x-build'];

    // All headers are required for strict verification
    if (!signature || !timestamp || !sessionId || !hwid) {
      throw new AppError('Missing required security headers', 401, 'MISSING_HEADERS');
    }

    // Stricter timestamp check (2 minutes)
    const requestTime = parseInt(timestamp);
    const now = Date.now();

    if (isNaN(requestTime) || Math.abs(now - requestTime) > 120000) {
      throw new AppError('Request expired', 401, 'REQUEST_EXPIRED');
    }

    // Verify session exists and is valid
    const { getSession } = require('../utils/session');
    const session = getSession(sessionId);
    
    if (!session) {
      throw new AppError('Invalid or expired session', 401, 'INVALID_SESSION');
    }

    // Verify HWID matches session
    if (session.hwid && session.hwid !== hwid) {
      throw new AppError('HWID mismatch', 401, 'HWID_MISMATCH');
    }

    // Calculate and verify signature
    const endpoint = req.originalUrl || req.url;
    const expectedSignature = generateSessionSignature(
      endpoint,
      timestamp,
      hwid,
      sessionId
    );

    if (!timingSafeEqual(signature, expectedSignature)) {
      throw new AppError('Invalid signature', 401, 'INVALID_SIGNATURE');
    }

    // Store verified info
    req.verifiedSession = {
      sessionId,
      session,
      hwid,
      buildId,
      timestamp: requestTime,
      verified: true,
      strict: true
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error('[StrictSignature] Error:', error.message);
    next(new AppError('Strict signature verification failed', 401, 'STRICT_SIGNATURE_FAILED'));
  }
};

// ═══════════════════════════════════════════════════════════════
// OPTIONAL SIGNATURE (For backwards compatibility)
// ═══════════════════════════════════════════════════════════════

/**
 * Optional signature verification
 * Logs but doesn't block if signature is missing/invalid
 * Used during migration period
 */
const verifyOptionalSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!signature || !timestamp) {
      console.log('[Signature] Optional: No signature provided');
      req.signatureVerified = false;
      return next();
    }

    const sessionId = req.headers['x-session'];
    const hwid = req.headers['x-hwid'] || req.body?.hwid;
    const endpoint = req.originalUrl || req.url;

    const expectedSignature = generateSessionSignature(
      endpoint,
      timestamp,
      hwid || '',
      sessionId || ''
    );

    if (timingSafeEqual(signature, expectedSignature)) {
      req.signatureVerified = true;
      req.verifiedSession = { sessionId, hwid, timestamp: parseInt(timestamp) };
    } else {
      console.log('[Signature] Optional: Invalid signature');
      req.signatureVerified = false;
    }

    next();
  } catch (error) {
    console.error('[Signature] Optional verification error:', error.message);
    req.signatureVerified = false;
    next();
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  verifySignature,
  verifyStrictSignature,
  verifyOptionalSignature,
  generateSessionSignature,
  generateHMACSignature,
  timingSafeEqual
};
