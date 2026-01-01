// ═══════════════════════════════════════════════════════════════
// JWT UTILITIES
// ═══════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate access token
const generateAccessToken = (userId, additionalData = {}) => {
  return jwt.sign(
    {
      userId,
      ...additionalData,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Generate refresh token (longer expiration)
const generateRefreshToken = (userId) => {
  return jwt.sign(
    {
      userId,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Generate script token (very short-lived)
const generateScriptAccessToken = (keyId, placeId) => {
  const expiresIn = parseInt(process.env.SCRIPT_TOKEN_EXPIRES_IN) || 60;
  return jwt.sign(
    {
      keyId,
      placeId,
      type: 'script'
    },
    JWT_SECRET,
    { expiresIn: `${expiresIn}s` }
  );
};

// Verify token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Decode token without verification (for debugging)
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateScriptAccessToken,
  verifyToken,
  decodeToken
};
