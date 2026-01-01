// ═══════════════════════════════════════════════════════════════
// LOADER SECURITY MIDDLEWARE
// Rate limiting, IP logging, blacklist, executor validation
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');

// In-memory stores (use Redis in production)
const ipRequests = new Map(); // IP -> { count, firstRequest, lastRequest }
const ipBlacklist = new Set(); // Permanently blocked IPs
const suspiciousIPs = new Map(); // IP -> { violations, lastViolation }
const accessLogs = []; // Recent access attempts

// Configuration
const CONFIG = {
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 5,
  MAX_REQUESTS_PER_HOUR: 20,
  MAX_REQUESTS_PER_DAY: 50,
  
  // Blacklist thresholds
  VIOLATIONS_TO_BLACKLIST: 10,
  SUSPICIOUS_THRESHOLD: 3,
  
  // Cleanup intervals
  CLEANUP_INTERVAL: 60000, // 1 minute
  LOG_RETENTION: 3600000, // 1 hour
  
  // Known executor signatures (User-Agents that are likely executors)
  EXECUTOR_SIGNATURES: [
    'synapse',
    'script-ware',
    'krnl',
    'fluxus',
    'oxygen',
    'electron',
    'jjsploit',
    'comet',
    'trigon',
    'arceus',
    'delta',
    'hydrogen',
    'evon',
    'roblox',
    // Generic HTTP clients (could be executors)
    'curl',
    'wget',
    'httpie',
    'insomnia',
    'postman'
  ],
  
  // Browser signatures to block
  BROWSER_SIGNATURES: [
    'mozilla',
    'chrome',
    'safari',
    'firefox',
    'edge',
    'opera',
    'msie',
    'trident'
  ]
};

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Cleanup IP requests older than 1 day
  for (const [ip, data] of ipRequests) {
    if (now - data.lastRequest > 86400000) {
      ipRequests.delete(ip);
    }
  }
  
  // Cleanup old access logs
  while (accessLogs.length > 0 && now - accessLogs[0].timestamp > CONFIG.LOG_RETENTION) {
    accessLogs.shift();
  }
  
  // Decay suspicious scores
  for (const [ip, data] of suspiciousIPs) {
    if (now - data.lastViolation > 3600000) { // 1 hour decay
      data.violations = Math.max(0, data.violations - 1);
      if (data.violations === 0) {
        suspiciousIPs.delete(ip);
      }
    }
  }
}, CONFIG.CLEANUP_INTERVAL);

// Get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

// Log access attempt
function logAccess(ip, userAgent, allowed, reason) {
  const entry = {
    timestamp: Date.now(),
    ip,
    userAgent: userAgent?.substring(0, 100) || 'none',
    allowed,
    reason
  };
  
  accessLogs.push(entry);
  
  // Keep only last 1000 entries
  if (accessLogs.length > 1000) {
    accessLogs.shift();
  }
  
  return entry;
}

// Add violation to IP
function addViolation(ip, reason) {
  const data = suspiciousIPs.get(ip) || { violations: 0, reasons: [] };
  data.violations++;
  data.lastViolation = Date.now();
  data.reasons.push(reason);
  
  if (data.reasons.length > 10) {
    data.reasons.shift();
  }
  
  suspiciousIPs.set(ip, data);
  
  // Auto-blacklist if too many violations
  if (data.violations >= CONFIG.VIOLATIONS_TO_BLACKLIST) {
    ipBlacklist.add(ip);
    console.log(`[Security] IP blacklisted: ${ip} (${data.violations} violations)`);
  }
  
  return data.violations;
}

// Check if request is from browser
function isBrowserRequest(req) {
  const userAgent = (req.get('User-Agent') || '').toLowerCase();
  const accept = (req.get('Accept') || '').toLowerCase();
  
  // Check Accept header for HTML
  if (accept.includes('text/html')) {
    return true;
  }
  
  // Check User-Agent for browser signatures
  for (const sig of CONFIG.BROWSER_SIGNATURES) {
    if (userAgent.includes(sig)) {
      return true;
    }
  }
  
  return false;
}

// Check if request might be from executor
function isLikelyExecutor(req) {
  const userAgent = (req.get('User-Agent') || '').toLowerCase();
  
  // Empty User-Agent is common for executors
  if (!userAgent || userAgent === '') {
    return true;
  }
  
  // Check for known executor signatures
  for (const sig of CONFIG.EXECUTOR_SIGNATURES) {
    if (userAgent.includes(sig)) {
      return true;
    }
  }
  
  // Generic HTTP client without browser features
  if (!userAgent.includes('mozilla') && !userAgent.includes('chrome')) {
    return true;
  }
  
  return false;
}

// Check rate limit
function checkRateLimit(ip) {
  const now = Date.now();
  const data = ipRequests.get(ip) || {
    count: 0,
    minuteCount: 0,
    hourCount: 0,
    firstRequest: now,
    lastRequest: now,
    minuteStart: now,
    hourStart: now
  };
  
  // Reset minute counter
  if (now - data.minuteStart > 60000) {
    data.minuteCount = 0;
    data.minuteStart = now;
  }
  
  // Reset hour counter
  if (now - data.hourStart > 3600000) {
    data.hourCount = 0;
    data.hourStart = now;
  }
  
  // Reset day counter
  if (now - data.firstRequest > 86400000) {
    data.count = 0;
    data.firstRequest = now;
  }
  
  // Increment counters
  data.count++;
  data.minuteCount++;
  data.hourCount++;
  data.lastRequest = now;
  
  ipRequests.set(ip, data);
  
  // Check limits
  if (data.minuteCount > CONFIG.MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, reason: 'rate_limit_minute', remaining: 0 };
  }
  
  if (data.hourCount > CONFIG.MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, reason: 'rate_limit_hour', remaining: 0 };
  }
  
  if (data.count > CONFIG.MAX_REQUESTS_PER_DAY) {
    return { allowed: false, reason: 'rate_limit_day', remaining: 0 };
  }
  
  return {
    allowed: true,
    remaining: CONFIG.MAX_REQUESTS_PER_MINUTE - data.minuteCount
  };
}

// Generate error page HTML
function generateErrorPage(title, message, code) {
  const iconSvg = code >= 500 
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
    : code >= 429 
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
    }
    .card {
      text-align: center;
      padding: 48px 40px;
      max-width: 400px;
      background: #111;
      border: 1px solid #222;
      border-radius: 16px;
      margin: 20px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #1a1a1a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      color: #666;
    }
    .icon.error { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
    .icon.warning { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }
    p {
      color: #666;
      line-height: 1.6;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .code {
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: 'SF Mono', Monaco, monospace;
      color: #444;
      font-size: 11px;
    }
    .divider {
      width: 40px;
      height: 1px;
      background: #222;
      margin: 0 auto 24px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${code >= 500 ? 'error' : code >= 400 ? 'warning' : ''}">${iconSvg}</div>
    <h1>${title}</h1>
    <div class="divider"></div>
    <p>${message}</p>
    <div class="code">${code} • ${crypto.randomBytes(4).toString('hex').toUpperCase()}</div>
  </div>
</body>
</html>
  `;
}

// Main middleware
function loaderSecurityMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const userAgent = req.get('User-Agent') || '';
  
  // Skip security checks in development mode
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Check blacklist first (always check, even in dev)
  if (ipBlacklist.has(ip)) {
    logAccess(ip, userAgent, false, 'blacklisted');
    res.status(403);
    res.setHeader('Content-Type', 'text/html');
    return res.send(generateErrorPage(
      'Permanently Blocked',
      'Your IP has been permanently blocked due to suspicious activity. This action cannot be reversed.',
      403
    ));
  }
  
  // Check if browser (skip in development for testing)
  if (!isDev && isBrowserRequest(req)) {
    const violations = addViolation(ip, 'browser_access');
    logAccess(ip, userAgent, false, 'browser_detected');
    
    res.status(403);
    res.setHeader('Content-Type', 'text/html');
    return res.send(generateErrorPage(
      'Access Denied',
      'This endpoint is restricted to Roblox script executors only. Browser access is not permitted. Continued attempts will result in your IP being blocked.',
      403
    ));
  }
  
  // Check rate limit
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    addViolation(ip, rateCheck.reason);
    logAccess(ip, userAgent, false, rateCheck.reason);
    
    res.status(429);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Retry-After', '60');
    return res.send(generateErrorPage(
      'Too Many Requests',
      'You have exceeded the rate limit. Please wait before trying again. Excessive requests may result in a permanent ban.',
      429
    ));
  }
  
  // Check if likely executor (warning only, don't block)
  if (!isLikelyExecutor(req)) {
    // Suspicious but not blocking - just log
    const suspicious = suspiciousIPs.get(ip);
    if (suspicious && suspicious.violations >= CONFIG.SUSPICIOUS_THRESHOLD) {
      addViolation(ip, 'suspicious_client');
    }
  }
  
  // Log successful access
  logAccess(ip, userAgent, true, 'allowed');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Requests-Remaining', rateCheck.remaining.toString());
  
  next();
}

// Admin functions
function getAccessLogs(limit = 100) {
  return accessLogs.slice(-limit).reverse();
}

function getBlacklist() {
  return Array.from(ipBlacklist);
}

function getSuspiciousIPs() {
  const result = [];
  for (const [ip, data] of suspiciousIPs) {
    result.push({ ip, ...data });
  }
  return result.sort((a, b) => b.violations - a.violations);
}

function addToBlacklist(ip) {
  ipBlacklist.add(ip);
  return true;
}

function removeFromBlacklist(ip) {
  return ipBlacklist.delete(ip);
}

function getStats() {
  return {
    totalRequests: accessLogs.length,
    allowedRequests: accessLogs.filter(l => l.allowed).length,
    blockedRequests: accessLogs.filter(l => !l.allowed).length,
    blacklistedIPs: ipBlacklist.size,
    suspiciousIPs: suspiciousIPs.size,
    activeIPs: ipRequests.size
  };
}

module.exports = {
  loaderSecurityMiddleware,
  getAccessLogs,
  getBlacklist,
  getSuspiciousIPs,
  addToBlacklist,
  removeFromBlacklist,
  getStats,
  CONFIG
};
