/**
 * Wisper Hub - Session Management
 * Simple in-memory session storage for loader authentication
 */

const crypto = require('crypto');

// In-memory session store (use Redis in production)
const sessions = new Map();

// Session expiry time (10 minutes)
const SESSION_EXPIRY = 10 * 60 * 1000;

/**
 * Generate a unique session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session
 * @param {object} data - Session data (hwid, placeId, etc.)
 * @returns {object} Session object with id
 */
function createSession(data) {
  const sessionId = generateSessionId();
  const session = {
    id: sessionId,
    ...data,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY
  };
  
  sessions.set(sessionId, session);
  
  // Auto-cleanup expired sessions
  cleanupExpiredSessions();
  
  return session;
}

/**
 * Get a session by ID
 * @param {string} sessionId - Session ID
 * @returns {object|null} Session object or null if not found/expired
 */
function getSession(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  // Check if expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

/**
 * Validate a session
 * @param {string} sessionId - Session ID
 * @param {string} hwid - HWID to validate against
 * @returns {boolean} True if valid
 */
function validateSession(sessionId, hwid) {
  const session = getSession(sessionId);
  
  if (!session) {
    return false;
  }
  
  // Verify HWID matches
  if (session.hwid !== hwid) {
    return false;
  }
  
  return true;
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID
 */
function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Cleanup expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(id);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

module.exports = {
  generateSessionId,
  createSession,
  getSession,
  validateSession,
  deleteSession
};
