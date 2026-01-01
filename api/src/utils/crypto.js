// ═══════════════════════════════════════════════════════════════
// CRYPTOGRAPHIC UTILITIES
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Generate a secure random key
const generateKey = () => {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `WISPER-${segments.join('-')}`;
};

// Generate a random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash HWID with salt
const hashHwid = (hwid) => {
  const salt = process.env.HWID_SALT || 'default-salt';
  return crypto
    .createHash('sha256')
    .update(hwid + salt)
    .digest('hex');
};

// Verify HWID
const verifyHwid = (hwid, storedHash) => {
  const hash = hashHwid(hwid);
  return hash === storedHash;
};

// Hash password (for future use)
const hashPassword = async (password) => {
  return bcrypt.hash(password, 12);
};

// Verify password
const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Generate script token (temporary, short-lived)
const generateScriptToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Mask key for display (show only last 4 chars)
const maskKey = (key) => {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 7) + '-****-****-****-' + key.slice(-4);
};

// Mask HWID for display
const maskHwid = (hwid) => {
  if (!hwid || hwid.length < 8) return '***masked***';
  return hwid.slice(0, 4) + '...' + hwid.slice(-4);
};

module.exports = {
  generateKey,
  generateToken,
  hashHwid,
  verifyHwid,
  hashPassword,
  verifyPassword,
  generateScriptToken,
  maskKey,
  maskHwid
};
