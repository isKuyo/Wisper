// ═══════════════════════════════════════════════════════════════
// CHECKPOINT ROUTES
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate } = require('../middleware/auth');
const { AuditEvents, logWithRequest } = require('../utils/audit');
const { AppError } = require('../middleware/errorHandler');
const { generateToken } = require('../utils/crypto');
const { verifyTurnstile } = require('../utils/turnstile');

// Validation schemas
const completeCheckpointSchema = z.object({
  token: z.string().optional(),
  turnstileToken: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════
// GET /checkpoints - List all checkpoints with user progress
// ═══════════════════════════════════════════════════════════════
router.get('/', authenticate, async (req, res, next) => {
  try {
    // Get all enabled checkpoints
    const checkpoints = await req.prisma.checkpoint.findMany({
      where: { enabled: true },
      orderBy: { order: 'asc' }
    });

    // Get user's completed checkpoints
    const completedCheckpoints = await req.prisma.checkpointProgress.findMany({
      where: { userId: req.user.id },
      select: { checkpointId: true, completedAt: true }
    });

    const completedIds = new Set(completedCheckpoints.map(c => c.checkpointId));

    // Build response with completion status
    const checkpointsWithStatus = checkpoints.map((checkpoint, index) => {
      const isCompleted = completedIds.has(checkpoint.id);
      const completedInfo = completedCheckpoints.find(c => c.checkpointId === checkpoint.id);
      
      // Only show URL if it's the next checkpoint to complete
      const previousCompleted = index === 0 || completedIds.has(checkpoints[index - 1]?.id);
      const canAccess = !isCompleted && previousCompleted;

      return {
        id: checkpoint.id,
        order: checkpoint.order,
        platform: checkpoint.platform,
        name: checkpoint.name || `Checkpoint ${checkpoint.order}`,
        url: canAccess ? checkpoint.url : null,
        completed: isCompleted,
        completedAt: completedInfo?.completedAt || null,
        canAccess
      };
    });

    res.json({
      success: true,
      checkpoints: checkpointsWithStatus,
      totalRequired: checkpoints.length,
      totalCompleted: completedCheckpoints.length,
      allCompleted: completedCheckpoints.length >= checkpoints.length
    });
  } catch (error) {
    next(error);
  }
});

// Minimum time (in seconds) user must spend on checkpoint before it can be completed
// Set to 38 seconds to prevent bypass tools while keeping UX reasonable
const MIN_CHECKPOINT_TIME_SECONDS = 38;

// Store pending checkpoint tokens with timestamps (in production, use Redis)
const pendingCheckpointTokens = new Map();

// Track failed attempts per user (anti-bypass rate limiting)
const userFailedAttempts = new Map(); // userId -> { count, lastAttempt }
const MAX_FAILED_ATTEMPTS = 3;
const FAILED_ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  const EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes
  for (const [key, data] of pendingCheckpointTokens.entries()) {
    if (now - data.startedAt > EXPIRY_TIME) {
      pendingCheckpointTokens.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// GET /checkpoints/:id/start - Get checkpoint URL with tracking token
// ═══════════════════════════════════════════════════════════════
router.get('/:id/start', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const checkpoint = await req.prisma.checkpoint.findUnique({
      where: { id }
    });

    if (!checkpoint || !checkpoint.enabled) {
      throw new AppError('Checkpoint not found', 404, 'CHECKPOINT_NOT_FOUND');
    }

    // Check if already completed
    const existing = await req.prisma.checkpointProgress.findUnique({
      where: {
        userId_checkpointId: {
          userId: req.user.id,
          checkpointId: id
        }
      }
    });

    if (existing) {
      throw new AppError('Checkpoint already completed', 400, 'ALREADY_COMPLETED');
    }

    // Check if previous checkpoints are completed
    const previousCheckpoints = await req.prisma.checkpoint.findMany({
      where: {
        enabled: true,
        order: { lt: checkpoint.order }
      }
    });

    const completedPrevious = await req.prisma.checkpointProgress.count({
      where: {
        userId: req.user.id,
        checkpointId: { in: previousCheckpoints.map(c => c.id) }
      }
    });

    if (completedPrevious < previousCheckpoints.length) {
      throw new AppError('Complete previous checkpoints first', 400, 'PREVIOUS_INCOMPLETE');
    }

    // Generate tracking token
    const trackingToken = generateToken(32);
    
    // Store token with user ID, checkpoint ID, and timestamp for validation
    const tokenKey = `${req.user.id}:${id}:${trackingToken}`;
    pendingCheckpointTokens.set(tokenKey, {
      userId: req.user.id,
      checkpointId: id,
      startedAt: Date.now(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Build URL with tracking (platform-specific)
    let finalUrl = checkpoint.url;
    
    // Add callback URL for validation - use query params for checkpoint ID
    const callbackUrl = `${process.env.FRONTEND_URL}/checkpoint/complete?checkpoint=${id}&token=${trackingToken}`;
    
    // Different platforms have different ways to handle callbacks
    if (checkpoint.platform === 'linkvertise') {
      finalUrl = `${checkpoint.url}?r=${encodeURIComponent(callbackUrl)}`;
    } else if (checkpoint.platform === 'lootlabs') {
      finalUrl = `${checkpoint.url}?destination=${encodeURIComponent(callbackUrl)}`;
    } else if (checkpoint.platform === 'workink') {
      // Work.ink: just redirect to the checkpoint URL, user will be redirected back
      // The destination URL should be set in Work.ink dashboard
      finalUrl = checkpoint.url;
    } else {
      // Generic - append as query param
      const separator = checkpoint.url.includes('?') ? '&' : '?';
      finalUrl = `${checkpoint.url}${separator}callback=${encodeURIComponent(callbackUrl)}`;
    }

    res.json({
      success: true,
      url: finalUrl,
      trackingToken,
      platform: checkpoint.platform,
      order: checkpoint.order
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /checkpoints/:id/complete - Mark checkpoint as complete
// ═══════════════════════════════════════════════════════════════
router.post('/:id/complete', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { token, turnstileToken } = completeCheckpointSchema.parse(req.body);

    // SECURITY: Verify Cloudflare Turnstile (human verification)
    if (!turnstileToken) {
      throw new AppError('Human verification required. Please complete the captcha.', 400, 'TURNSTILE_REQUIRED');
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
    
    if (!turnstileResult.success) {
      throw new AppError('Human verification failed. Please try again.', 400, 'TURNSTILE_FAILED');
    }

    // SECURITY: Check if user is temporarily blocked due to bypass attempts
    const userAttemptCheck = userFailedAttempts.get(req.user.id);
    if (userAttemptCheck && userAttemptCheck.count >= MAX_FAILED_ATTEMPTS) {
      const timeLeft = Math.ceil((FAILED_ATTEMPT_WINDOW_MS - (Date.now() - userAttemptCheck.lastAttempt)) / 60000);
      if (timeLeft > 0) {
        throw new AppError(
          `You are temporarily blocked due to bypass attempts. Try again in ${timeLeft} minutes.`,
          429,
          'BLOCKED_FOR_BYPASS'
        );
      } else {
        userFailedAttempts.delete(req.user.id);
      }
    }

    // SECURITY: Token is now REQUIRED
    if (!token) {
      throw new AppError('Invalid checkpoint token', 400, 'INVALID_TOKEN');
    }

    const checkpoint = await req.prisma.checkpoint.findUnique({
      where: { id }
    });

    if (!checkpoint || !checkpoint.enabled) {
      throw new AppError('Checkpoint not found', 404, 'CHECKPOINT_NOT_FOUND');
    }

    // SECURITY: Validate the token exists and belongs to this user/checkpoint
    const tokenKey = `${req.user.id}:${id}:${token}`;
    const pendingData = pendingCheckpointTokens.get(tokenKey);

    if (!pendingData) {
      throw new AppError('Invalid or expired checkpoint token. Please start the checkpoint again.', 400, 'INVALID_TOKEN');
    }

    // SECURITY: IMMEDIATELY delete token - one attempt only, no retries allowed
    pendingCheckpointTokens.delete(tokenKey);

    // SECURITY: Verify token belongs to this user
    if (pendingData.userId !== req.user.id || pendingData.checkpointId !== id) {
      throw new AppError('Token mismatch', 400, 'TOKEN_MISMATCH');
    }

    // SECURITY: Check minimum time elapsed (anti-bypass)
    const elapsedSeconds = (Date.now() - pendingData.startedAt) / 1000;
    if (elapsedSeconds < MIN_CHECKPOINT_TIME_SECONDS) {
      // Track failed attempt for this user
      const now = Date.now();
      const userAttempts = userFailedAttempts.get(req.user.id) || { count: 0, lastAttempt: 0 };
      
      // Reset count if window expired
      if (now - userAttempts.lastAttempt > FAILED_ATTEMPT_WINDOW_MS) {
        userAttempts.count = 0;
      }
      
      userAttempts.count++;
      userAttempts.lastAttempt = now;
      userFailedAttempts.set(req.user.id, userAttempts);
      
      // Log bypass attempt
      await logWithRequest(req.prisma, req, AuditEvents.CHECKPOINT_FAILED, {
        checkpointId: id,
        reason: 'bypass_attempt',
        elapsedSeconds: Math.round(elapsedSeconds),
        attemptCount: userAttempts.count
      });
      
      // Token already deleted above - user must start checkpoint again
      throw new AppError(
        `Bypass attempt detected. Please start the checkpoint again and complete it legitimately. Warning: ${userAttempts.count}/${MAX_FAILED_ATTEMPTS} attempts.`, 
        400, 
        'BYPASS_DETECTED'
      );
    }
    
    // SECURITY: Check if user has too many failed attempts (likely bypasser)
    const userAttempts = userFailedAttempts.get(req.user.id);
    if (userAttempts && userAttempts.count >= MAX_FAILED_ATTEMPTS) {
      const timeLeft = Math.ceil((FAILED_ATTEMPT_WINDOW_MS - (Date.now() - userAttempts.lastAttempt)) / 60000);
      if (timeLeft > 0) {
        throw new AppError(
          `Too many bypass attempts detected. You are temporarily blocked from completing checkpoints. Try again in ${timeLeft} minutes.`,
          429,
          'TOO_MANY_ATTEMPTS'
        );
      } else {
        // Window expired, reset
        userFailedAttempts.delete(req.user.id);
      }
    }

    // SECURITY: Check if request came from expected flow (has referrer from checkpoint platform)
    const referrer = req.headers['referer'] || req.headers['referrer'] || '';
    const userAgent = req.headers['user-agent'] || '';
    
    // Log suspicious activity if no referrer (could be direct API call)
    if (!referrer && !userAgent.includes('Mozilla')) {
      await logWithRequest(req.prisma, req, AuditEvents.CHECKPOINT_FAILED, {
        checkpointId: id,
        reason: 'suspicious_request',
        referrer,
        userAgent
      });
    }

    // Check if already completed
    const existing = await req.prisma.checkpointProgress.findUnique({
      where: {
        userId_checkpointId: {
          userId: req.user.id,
          checkpointId: id
        }
      }
    });

    if (existing) {
      throw new AppError('Checkpoint already completed', 400, 'ALREADY_COMPLETED');
    }

    // Check if previous checkpoints are completed
    const previousCheckpoints = await req.prisma.checkpoint.findMany({
      where: {
        enabled: true,
        order: { lt: checkpoint.order }
      }
    });

    const completedPrevious = await req.prisma.checkpointProgress.count({
      where: {
        userId: req.user.id,
        checkpointId: { in: previousCheckpoints.map(c => c.id) }
      }
    });

    if (completedPrevious < previousCheckpoints.length) {
      throw new AppError('Complete previous checkpoints first', 400, 'PREVIOUS_INCOMPLETE');
    }

    // Create progress record
    await req.prisma.checkpointProgress.create({
      data: {
        userId: req.user.id,
        checkpointId: id,
        token: token
      }
    });

    await logWithRequest(req.prisma, req, AuditEvents.CHECKPOINT_COMPLETED, {
      checkpointId: id,
      order: checkpoint.order
    });

    // Get updated counts
    const totalCheckpoints = await req.prisma.checkpoint.count({
      where: { enabled: true }
    });

    const completedCheckpoints = await req.prisma.checkpointProgress.count({
      where: { userId: req.user.id }
    });

    const allCompleted = completedCheckpoints >= totalCheckpoints;

    res.json({
      success: true,
      message: 'Checkpoint completed',
      checkpointsCompleted: completedCheckpoints,
      checkpointsRequired: totalCheckpoints,
      allCompleted
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /checkpoints/status - Get user's checkpoint status
// ═══════════════════════════════════════════════════════════════
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const totalCheckpoints = await req.prisma.checkpoint.count({
      where: { enabled: true }
    });

    const completedCheckpoints = await req.prisma.checkpointProgress.count({
      where: { userId: req.user.id }
    });

    res.json({
      success: true,
      completed: completedCheckpoints,
      required: totalCheckpoints,
      allCompleted: completedCheckpoints >= totalCheckpoints,
      percentage: totalCheckpoints > 0 
        ? Math.round((completedCheckpoints / totalCheckpoints) * 100) 
        : 100
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
