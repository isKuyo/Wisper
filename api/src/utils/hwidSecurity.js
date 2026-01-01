// ═══════════════════════════════════════════════════════════════
// HWID SECURITY - Enhanced HWID validation and anti-spoof
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');

// Generate server-side challenge for HWID verification
function generateHwidChallenge() {
  const challenge = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  const expiresAt = timestamp + 30000; // 30 seconds
  
  return {
    challenge,
    timestamp,
    expiresAt,
    signature: signChallenge(challenge, timestamp),
  };
}

// Sign challenge with server secret
function signChallenge(challenge, timestamp) {
  const secret = process.env.HWID_SALT || 'hwid_secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${challenge}:${timestamp}`)
    .digest('hex');
}

// Verify challenge response from client
function verifyChallengeResponse(challenge, timestamp, signature, response) {
  // Check if challenge is expired
  if (Date.now() > timestamp + 30000) {
    return { valid: false, reason: 'challenge_expired' };
  }
  
  // Verify signature
  const expectedSig = signChallenge(challenge, timestamp);
  if (signature !== expectedSig) {
    return { valid: false, reason: 'invalid_signature' };
  }
  
  // Verify response format
  if (!response || typeof response !== 'string' || response.length < 32) {
    return { valid: false, reason: 'invalid_response' };
  }
  
  return { valid: true };
}

// Generate dynamic HWID components that client must compute
function generateHwidRequirements() {
  const components = [
    'UserId',
    'PlaceId', 
    'JobId',
    'ExecutorName',
    'ExecutorVersion',
    'GameId',
    'CreatorId',
  ];
  
  // Randomly select which components to use (makes it harder to predict)
  const selected = components.filter(() => Math.random() > 0.3);
  if (selected.length < 3) {
    selected.push('UserId', 'PlaceId', 'ExecutorName');
  }
  
  return {
    components: [...new Set(selected)],
    salt: crypto.randomBytes(8).toString('hex'),
    algorithm: 'sha256',
  };
}

// Compute expected HWID hash on server (for verification)
function computeExpectedHwid(components, values, salt) {
  const data = components.map(c => values[c] || '').join(':');
  const secret = process.env.HWID_SALT || 'hwid_secret';
  
  return crypto
    .createHmac('sha256', secret)
    .update(`${data}:${salt}`)
    .digest('hex');
}

// Validate HWID structure
function validateHwidStructure(hwid) {
  if (!hwid || typeof hwid !== 'string') {
    return { valid: false, reason: 'missing_hwid' };
  }
  
  if (hwid.length < 32 || hwid.length > 128) {
    return { valid: false, reason: 'invalid_length' };
  }
  
  // Check for common spoof patterns
  const spoofPatterns = [
    /^0+$/, // All zeros
    /^f+$/i, // All F's
    /^(.)\1+$/, // Repeated character
    /^[0-9]+$/, // Only numbers (suspicious)
    /test|fake|spoof|bypass/i, // Obvious keywords
  ];
  
  for (const pattern of spoofPatterns) {
    if (pattern.test(hwid)) {
      return { valid: false, reason: 'suspicious_pattern' };
    }
  }
  
  return { valid: true };
}

// Generate fingerprint from request metadata
function generateRequestFingerprint(req) {
  const components = [
    req.ip,
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join(':'))
    .digest('hex')
    .substring(0, 16);
}

// Check for HWID anomalies
function checkHwidAnomalies(hwid, requestFingerprint, previousFingerprints = []) {
  const anomalies = [];
  
  // Check if fingerprint changed drastically
  if (previousFingerprints.length > 0) {
    const lastFingerprint = previousFingerprints[previousFingerprints.length - 1];
    if (lastFingerprint !== requestFingerprint) {
      anomalies.push('fingerprint_changed');
    }
  }
  
  // Check entropy of HWID (should be high for real HWIDs)
  const entropy = calculateEntropy(hwid);
  if (entropy < 3.0) {
    anomalies.push('low_entropy');
  }
  
  return anomalies;
}

// Calculate Shannon entropy
function calculateEntropy(str) {
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

// Rate limit HWID changes
const hwidChangeHistory = new Map(); // keyId -> [{ hwid, timestamp }]

function canChangeHwid(keyId, newHwid, maxChangesPerDay = 3) {
  const history = hwidChangeHistory.get(keyId) || [];
  const oneDayAgo = Date.now() - 86400000;
  
  // Filter to last 24 hours
  const recentChanges = history.filter(h => h.timestamp > oneDayAgo);
  
  if (recentChanges.length >= maxChangesPerDay) {
    return { allowed: false, reason: 'too_many_changes', nextAllowed: recentChanges[0].timestamp + 86400000 };
  }
  
  return { allowed: true };
}

function recordHwidChange(keyId, hwid) {
  const history = hwidChangeHistory.get(keyId) || [];
  history.push({ hwid, timestamp: Date.now() });
  
  // Keep only last 10 entries
  if (history.length > 10) {
    history.shift();
  }
  
  hwidChangeHistory.set(keyId, history);
}

module.exports = {
  generateHwidChallenge,
  verifyChallengeResponse,
  generateHwidRequirements,
  computeExpectedHwid,
  validateHwidStructure,
  generateRequestFingerprint,
  checkHwidAnomalies,
  canChangeHwid,
  recordHwidChange,
};
