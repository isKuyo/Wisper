// ═══════════════════════════════════════════════════════════════
// KEY MANAGEMENT ROUTES
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate } = require('../middleware/auth');
const { generateKey, hashHwid, maskKey } = require('../utils/crypto');
const { AuditEvents, logWithRequest } = require('../utils/audit');
const { AppError } = require('../middleware/errorHandler');

// Configuration
const HWID_RESET_CONFIG = {
  MAX_RESETS_PER_WINDOW: 2,      // 2 resets per window
  WINDOW_HOURS: 12,              // 12 hour window
  COOLDOWN_MINUTES: 30           // 30 min cooldown between resets
};

// Validation schemas
const generateKeySchema = z.object({
  hwid: z.string().min(16).max(128).optional()
});

// ═══════════════════════════════════════════════════════════════
// POST /keys/generate - Generate a new key (requires checkpoints)
// ═══════════════════════════════════════════════════════════════
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    // Check if user already has a key
    const existingKey = await req.prisma.key.findUnique({
      where: { userId: req.user.id }
    });

    if (existingKey) {
      throw new AppError('You already have a key', 400, 'KEY_EXISTS');
    }

    // Get system settings
    const settings = await req.prisma.systemSettings.findUnique({
      where: { id: 'default' }
    });

    // Check if checkpoints are required
    const totalCheckpoints = await req.prisma.checkpoint.count({
      where: { enabled: true }
    });

    const completedCheckpoints = await req.prisma.checkpointProgress.count({
      where: { userId: req.user.id }
    });

    // MUST complete all checkpoints before generating key
    if (totalCheckpoints > 0 && completedCheckpoints < totalCheckpoints) {
      throw new AppError(
        `Complete all checkpoints first (${completedCheckpoints}/${totalCheckpoints})`,
        400,
        'CHECKPOINTS_INCOMPLETE'
      );
    }

    // Generate new key
    const newKey = generateKey();

    // Calculate expiration based on keyActivationHours
    let expiresAt = null;
    if (settings?.keyActivationHours) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + settings.keyActivationHours);
    } else if (settings?.keyExpirationDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + settings.keyExpirationDays);
    }

    // Create key in database (HWID will be bound on first use)
    const key = await req.prisma.key.create({
      data: {
        key: newKey,
        userId: req.user.id,
        hwidHash: null, // Will be bound on first use in executor
        expiresAt,
        activatedAt: new Date()
      }
    });

    await logWithRequest(req.prisma, req, AuditEvents.KEY_GENERATED, {
      keyId: key.id,
      maskedKey: maskKey(newKey)
    });

    res.json({
      success: true,
      key: newKey,
      expiresAt: key.expiresAt,
      activatedAt: key.activatedAt,
      message: 'Key generated! Use it in your executor.'
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /keys/my-key - Get user's key info with executor/time/hwid
// ═══════════════════════════════════════════════════════════════
router.get('/my-key', authenticate, async (req, res, next) => {
  try {
    const key = await req.prisma.key.findUnique({
      where: { userId: req.user.id },
      include: { user: true }
    });

    // Get checkpoint info
    const totalCheckpoints = await req.prisma.checkpoint.count({
      where: { enabled: true }
    });

    const completedCheckpoints = await req.prisma.checkpointProgress.count({
      where: { userId: req.user.id }
    });

    if (!key) {
      return res.json({
        success: true,
        hasKey: false,
        key: null,
        checkpointsRequired: totalCheckpoints,
        checkpointsCompleted: completedCheckpoints,
        canGenerateKey: completedCheckpoints >= totalCheckpoints || totalCheckpoints === 0
      });
    }

    const isOwner = key.user.role === 'owner';
    const now = new Date();

    // Calculate time remaining
    // Keys without expiresAt are permanent (old keys or owner keys)
    let timeRemaining = null;
    let isExpired = false;
    let isPermanent = !key.expiresAt;
    
    if (key.expiresAt) {
      const diff = key.expiresAt.getTime() - now.getTime();
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timeRemaining = { hours, minutes, totalMs: diff };
      } else {
        isExpired = true;
      }
    }

    // Calculate HWID reset availability
    let hwidResetAvailable = true;
    let hwidResetCooldownRemaining = null;
    let hwidResetsRemaining = HWID_RESET_CONFIG.MAX_RESETS_PER_WINDOW;
    let hwidWindowResetTime = null; // Time until window resets and user gets more resets

    if (isOwner) {
      // Owner has unlimited resets
      hwidResetsRemaining = 'unlimited';
      hwidResetAvailable = true;
    } else {
      // Check if we're in a reset window
      if (key.hwidResetWindowStart) {
        const windowEnd = new Date(key.hwidResetWindowStart);
        windowEnd.setHours(windowEnd.getHours() + HWID_RESET_CONFIG.WINDOW_HOURS);
        
        if (now < windowEnd) {
          // Still in window
          hwidResetsRemaining = Math.max(0, HWID_RESET_CONFIG.MAX_RESETS_PER_WINDOW - (key.hwidResetCount || 0));
          
          // Calculate time until window resets (user gets more resets)
          if (hwidResetsRemaining === 0) {
            const windowResetMs = windowEnd.getTime() - now.getTime();
            const hours = Math.floor(windowResetMs / (1000 * 60 * 60));
            const minutes = Math.floor((windowResetMs % (1000 * 60 * 60)) / (1000 * 60));
            hwidWindowResetTime = { hours, minutes, totalMs: windowResetMs };
          }
        } else {
          // Window expired, reset count
          hwidResetsRemaining = HWID_RESET_CONFIG.MAX_RESETS_PER_WINDOW;
        }
      }

      // Check cooldown
      if (key.lastHwidReset) {
        const cooldownEnd = new Date(key.lastHwidReset);
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + HWID_RESET_CONFIG.COOLDOWN_MINUTES);
        
        if (now < cooldownEnd) {
          const cooldownMs = cooldownEnd.getTime() - now.getTime();
          hwidResetCooldownRemaining = Math.ceil(cooldownMs / (1000 * 60)); // minutes
        }
      }

      hwidResetAvailable = hwidResetsRemaining > 0 && !hwidResetCooldownRemaining;
    }

    res.json({
      success: true,
      hasKey: true,
      isOwner,
      key: {
        key: key.key,
        isActive: key.isActive && !isExpired,
        isExpired,
        isPermanent,
        expiresAt: key.expiresAt,
        timeRemaining,
        activatedAt: key.activatedAt,
        createdAt: key.createdAt,
        
        // HWID info
        hwidBound: !!key.hwidHash,
        hwidHash: key.hwidHash ? key.hwidHash.substring(0, 8) + '...' : null,
        
        // Executor/Device info
        lastExecutor: key.lastExecutor,
        lastPlaceId: key.lastPlaceId ? key.lastPlaceId.toString() : null,
        lastUsedAt: key.lastUsedAt,
        
        // HWID reset info
        hwidResetAvailable,
        hwidResetsRemaining,
        hwidResetCooldownRemaining,
        hwidWindowResetTime,
        hwidResetConfig: isOwner ? null : {
          maxResetsPerWindow: HWID_RESET_CONFIG.MAX_RESETS_PER_WINDOW,
          windowHours: HWID_RESET_CONFIG.WINDOW_HOURS,
          cooldownMinutes: HWID_RESET_CONFIG.COOLDOWN_MINUTES
        }
      },
      checkpointsRequired: totalCheckpoints,
      checkpointsCompleted: completedCheckpoints,
      allCheckpointsCompleted: completedCheckpoints >= totalCheckpoints
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /keys/reset-hwid - Reset HWID (2 per 12h, 30min cooldown)
// Owner has unlimited resets with no cooldown
// ═══════════════════════════════════════════════════════════════
router.post('/reset-hwid', authenticate, async (req, res, next) => {
  try {
    const key = await req.prisma.key.findUnique({
      where: { userId: req.user.id },
      include: { user: true }
    });

    if (!key) {
      throw new AppError('No key found', 404, 'KEY_NOT_FOUND');
    }

    const now = new Date();
    const isOwner = key.user.role === 'owner';

    // Owner bypasses all limits
    if (!isOwner) {
      // Check cooldown (30 minutes between resets)
      if (key.lastHwidReset) {
        const cooldownEnd = new Date(key.lastHwidReset);
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + HWID_RESET_CONFIG.COOLDOWN_MINUTES);
        
        if (now < cooldownEnd) {
          const remainingMs = cooldownEnd.getTime() - now.getTime();
          const remainingMins = Math.ceil(remainingMs / (1000 * 60));
          throw new AppError(
            `Please wait ${remainingMins} minutes before resetting again`,
            429,
            'COOLDOWN_ACTIVE'
          );
        }
      }

      // Check reset window (2 resets per 12 hours)
      let resetCount = key.hwidResetCount || 0;
      let windowStart = key.hwidResetWindowStart;

      if (windowStart) {
        const windowEnd = new Date(windowStart);
        windowEnd.setHours(windowEnd.getHours() + HWID_RESET_CONFIG.WINDOW_HOURS);
        
        if (now >= windowEnd) {
          // Window expired, start new window
          resetCount = 0;
          windowStart = now;
        }
      } else {
        // First reset ever, start window
        windowStart = now;
        resetCount = 0;
      }

      if (resetCount >= HWID_RESET_CONFIG.MAX_RESETS_PER_WINDOW) {
        // Calculate when window resets
        const windowEnd = new Date(windowStart);
        windowEnd.setHours(windowEnd.getHours() + HWID_RESET_CONFIG.WINDOW_HOURS);
        const hoursRemaining = Math.ceil((windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60));
        
        throw new AppError(
          `Maximum resets reached. Try again in ${hoursRemaining} hours`,
          429,
          'MAX_RESETS_REACHED'
        );
      }

      // Perform reset for regular users
      await req.prisma.key.update({
        where: { id: key.id },
        data: {
          hwidHash: null,
          hwidResetCount: resetCount + 1,
          hwidResetWindowStart: windowStart,
          lastHwidReset: now
        }
      });

      await logWithRequest(req.prisma, req, AuditEvents.KEY_HWID_RESET, {
        keyId: key.id,
        resetCount: resetCount + 1
      });

      res.json({
        success: true,
        message: 'HWID reset successfully. You can now use your key on a new device.',
        resetsRemaining: HWID_RESET_CONFIG.MAX_RESETS_PER_WINDOW - (resetCount + 1),
        cooldownMinutes: HWID_RESET_CONFIG.COOLDOWN_MINUTES
      });
    } else {
      // Owner: unlimited resets, no cooldown
      await req.prisma.key.update({
        where: { id: key.id },
        data: {
          hwidHash: null,
          lastHwidReset: now
        }
      });

      await logWithRequest(req.prisma, req, AuditEvents.KEY_HWID_RESET, {
        keyId: key.id,
        isOwner: true
      });

      res.json({
        success: true,
        message: 'HWID reset successfully (Owner - unlimited).',
        resetsRemaining: 'unlimited',
        cooldownMinutes: 0
      });
    }
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /keys/extend - Extend key time by completing checkpoints again
// ═══════════════════════════════════════════════════════════════
router.post('/extend', authenticate, async (req, res, next) => {
  try {
    const key = await req.prisma.key.findUnique({
      where: { userId: req.user.id }
    });

    if (!key) {
      throw new AppError('No key found', 404, 'KEY_NOT_FOUND');
    }

    // Check if key is permanent (no extension needed)
    if (!key.expiresAt) {
      throw new AppError('Your key is already permanent', 400, 'KEY_PERMANENT');
    }

    // Get system settings for extension hours
    const settings = await req.prisma.systemSettings.findUnique({
      where: { id: 'default' }
    });

    const extensionHours = settings?.keyActivationHours || 6;

    // Check if all checkpoints are completed
    const totalCheckpoints = await req.prisma.checkpoint.count({
      where: { enabled: true }
    });

    const completedCheckpoints = await req.prisma.checkpointProgress.count({
      where: { userId: req.user.id }
    });

    if (totalCheckpoints > 0 && completedCheckpoints < totalCheckpoints) {
      throw new AppError(
        `Complete all checkpoints first (${completedCheckpoints}/${totalCheckpoints})`,
        400,
        'CHECKPOINTS_INCOMPLETE'
      );
    }

    // Calculate new expiration
    const now = new Date();
    let newExpiresAt;
    
    if (key.expiresAt && key.expiresAt > now) {
      // Key not expired yet, add time to current expiration
      newExpiresAt = new Date(key.expiresAt);
    } else {
      // Key expired, start from now
      newExpiresAt = now;
    }
    newExpiresAt.setHours(newExpiresAt.getHours() + extensionHours);

    // Update key expiration
    await req.prisma.key.update({
      where: { id: key.id },
      data: { expiresAt: newExpiresAt }
    });

    // Clear checkpoint progress so user can do them again next time
    await req.prisma.checkpointProgress.deleteMany({
      where: { userId: req.user.id }
    });

    await logWithRequest(req.prisma, req, AuditEvents.KEY_EXTENDED, {
      keyId: key.id,
      extensionHours,
      newExpiresAt
    });

    res.json({
      success: true,
      message: `Key extended by ${extensionHours} hours!`,
      expiresAt: newExpiresAt,
      extensionHours
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /keys/bind-hwid - Bind new HWID to key
// ═══════════════════════════════════════════════════════════════
router.post('/bind-hwid', authenticate, async (req, res, next) => {
  try {
    const { hwid } = generateKeySchema.parse(req.body);

    const key = await req.prisma.key.findUnique({
      where: { userId: req.user.id }
    });

    if (!key) {
      throw new AppError('No key found', 404, 'KEY_NOT_FOUND');
    }

    if (key.hwidHash) {
      throw new AppError('HWID already bound. Reset first.', 400, 'HWID_ALREADY_BOUND');
    }

    const hwidHash = hashHwid(hwid);

    await req.prisma.key.update({
      where: { id: key.id },
      data: { hwidHash }
    });

    res.json({
      success: true,
      message: 'HWID bound successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
