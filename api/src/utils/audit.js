// ═══════════════════════════════════════════════════════════════
// AUDIT LOG UTILITIES
// ═══════════════════════════════════════════════════════════════

// Audit event types
const AuditEvents = {
  // Auth events
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  
  // Key events
  KEY_GENERATED: 'key_generated',
  KEY_VALIDATED: 'key_validated',
  KEY_VALIDATION_FAILED: 'key_validation_failed',
  KEY_HWID_MISMATCH: 'key_hwid_mismatch',
  KEY_HWID_RESET: 'key_hwid_reset',
  KEY_EXTENDED: 'key_extended',
  
  // Checkpoint events
  CHECKPOINT_COMPLETED: 'checkpoint_completed',
  CHECKPOINT_FAILED: 'checkpoint_failed',
  
  // Script events
  SCRIPT_DOWNLOADED: 'script_downloaded',
  SCRIPT_CREATED: 'script_created',
  SCRIPT_UPDATED: 'script_updated',
  SCRIPT_DELETED: 'script_deleted',
  
  // Admin events
  ADMIN_USER_BANNED: 'admin_user_banned',
  ADMIN_USER_UNBANNED: 'admin_user_unbanned',
  ADMIN_HWID_RESET: 'admin_hwid_reset',
  ADMIN_KEY_UPDATED: 'admin_key_updated',
  ADMIN_CHECKPOINT_CREATED: 'admin_checkpoint_created',
  ADMIN_CHECKPOINT_UPDATED: 'admin_checkpoint_updated',
  ADMIN_CHECKPOINT_DELETED: 'admin_checkpoint_deleted',
  ADMIN_SETTINGS_UPDATED: 'admin_settings_updated',
  
  // Security events
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_SIGNATURE: 'invalid_signature',
  UNAUTHORIZED_ACCESS: 'unauthorized_access'
};

// Create audit log entry
const createAuditLog = async (prisma, {
  userId = null,
  event,
  details = null,
  ipAddress = null,
  userAgent = null,
  success = true
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        event,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent,
        success
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

// Get client info from request
const getClientInfo = (req) => {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent']
  };
};

// Helper to log with request context
const logWithRequest = async (prisma, req, event, details = null, success = true) => {
  const { ipAddress, userAgent } = getClientInfo(req);
  await createAuditLog(prisma, {
    userId: req.user?.id || null,
    event,
    details,
    ipAddress,
    userAgent,
    success
  });
};

module.exports = {
  AuditEvents,
  createAuditLog,
  getClientInfo,
  logWithRequest
};
