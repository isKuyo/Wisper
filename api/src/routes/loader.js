// ═══════════════════════════════════════════════════════════════
// LOADER ROUTES V2 (Used by Roblox client)
// ═══════════════════════════════════════════════════════════════
//
// SECURITY FEATURES:
// ✅ Session-based authentication (no API secret exposed)
// ✅ HMAC signature verification
// ✅ Enterprise protection integration
// ✅ Rate limiting per HWID
// ✅ Audit logging
//
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { verifySignature, verifyOptionalSignature } = require('../middleware/signature');
const { loaderRateLimiter } = require('../middleware/rateLimiter');
const { hashHwid, verifyHwid } = require('../utils/crypto');
const { generateScriptAccessToken } = require('../utils/jwt');
const { AuditEvents, logWithRequest } = require('../utils/audit');
const { AppError } = require('../middleware/errorHandler');
const { 
  createSession, 
  getSession, 
  validateSession,
  generateSessionId 
} = require('../utils/session');

// Validation schemas
const validateKeySchema = z.object({
  key: z.string().regex(/^WISPER-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  hwid: z.string().min(16).max(128),
  placeId: z.number().int().positive()
});

const sessionSchema = z.object({
  hwid: z.string().min(16).max(128),
  placeId: z.number().int().positive(),
  executor: z.string().max(100).optional(),
  build: z.string().max(32).optional()
});

// ═══════════════════════════════════════════════════════════════
// POST /loader/session - Create a new session (no API secret needed)
// ═══════════════════════════════════════════════════════════════
router.post('/session', loaderRateLimiter, async (req, res, next) => {
  try {
    const { hwid, placeId, executor, build } = sessionSchema.parse(req.body);
    
    // Create a new session
    const session = createSession({
      hwid,
      placeId,
      executor: executor || 'Unknown',
      build: build || 'unknown'
    });
    
    // Log session creation
    console.log('[Session] Created:', session.id.substring(0, 16) + '...', 'HWID:', hwid.substring(0, 8) + '...');
    
    res.json({
      success: true,
      sessionId: session.id,
      expiresAt: session.expiresAt,
      buildId: session.buildId
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format'
      });
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /loader/validate - Validate key from Roblox client
// ═══════════════════════════════════════════════════════════════
router.post('/validate', loaderRateLimiter, verifyOptionalSignature, async (req, res, next) => {
  try {
    const { key, hwid, placeId } = validateKeySchema.parse(req.body);

    // Find key in database
    const keyRecord = await req.prisma.key.findUnique({
      where: { key },
      include: {
        user: {
          include: {
            checkpointProgress: true
          }
        }
      }
    });

    if (!keyRecord) {
      await logWithRequest(req.prisma, req, AuditEvents.KEY_VALIDATION_FAILED, {
        key: key.slice(0, 10) + '...',
        reason: 'key_not_found'
      }, false);

      return res.json({
        valid: false,
        status: 'invalid',
        message: 'Invalid key'
      });
    }

    // Check if key is active
    if (!keyRecord.isActive) {
      return res.json({
        valid: false,
        status: 'disabled',
        message: 'Key is disabled'
      });
    }

    // Check if key is expired
    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return res.json({
        valid: false,
        status: 'expired',
        message: 'Key has expired'
      });
    }

    // Check if user is banned
    if (keyRecord.user.isBanned) {
      return res.json({
        valid: false,
        status: 'banned',
        message: 'Account is banned'
      });
    }

    // Check HWID
    const hwidHash = hashHwid(hwid);
    
    // Check if this is an auto-validation attempt (has X-Auto-Validate header)
    const isAutoValidate = req.headers['x-auto-validate'] === 'true';

    if (keyRecord.hwidHash) {
      // HWID is bound, verify it matches
      if (keyRecord.hwidHash !== hwidHash) {
        await logWithRequest(req.prisma, req, AuditEvents.KEY_HWID_MISMATCH, {
          keyId: keyRecord.id,
          userId: keyRecord.userId
        }, false);

        return res.json({
          valid: false,
          status: 'hwid_mismatch',
          message: 'Key is bound to a different device. Reset HWID on the website.'
        });
      }
    } else {
      // HWID not bound - check if this was recently reset
      // If auto-validate and HWID was reset, require manual key entry
      if (isAutoValidate && keyRecord.lastHwidReset) {
        return res.json({
          valid: false,
          status: 'hwid_reset_pending',
          message: 'HWID was reset. Please enter your key manually to bind to this device.'
        });
      }
      
      // First use or manual entry after reset - bind HWID
      await req.prisma.key.update({
        where: { id: keyRecord.id },
        data: { 
          hwidHash,
          lastHwidReset: null // Clear the reset flag after binding
        }
      });
    }

    // Get executor info from request (sent by loader)
    const executor = req.body.executor || req.headers['x-executor'] || 'Unknown';

    // Update last used info
    await req.prisma.key.update({
      where: { id: keyRecord.id },
      data: {
        lastExecutor: executor,
        lastPlaceId: BigInt(placeId),
        lastUsedAt: new Date()
      }
    });

    // Check checkpoints
    const totalCheckpoints = await req.prisma.checkpoint.count({
      where: { enabled: true }
    });

    const completedCheckpoints = keyRecord.user.checkpointProgress.length;

    if (completedCheckpoints < totalCheckpoints) {
      // Get settings for website URL
      const settings = await req.prisma.systemSettings.findUnique({
        where: { id: 'default' }
      });

      return res.json({
        valid: false,
        status: 'checkpoints_pending',
        message: `Complete ${totalCheckpoints - completedCheckpoints} more checkpoint(s)`,
        checkpointsRequired: totalCheckpoints,
        checkpointsCompleted: completedCheckpoints,
        checkpointUrl: `${process.env.FRONTEND_URL}/checkpoints`
      });
    }

    // Check if script exists for this game
    const script = await req.prisma.gameScript.findFirst({
      where: {
        placeId: BigInt(placeId),
        enabled: true
      }
    });

    if (!script) {
      return res.json({
        valid: false,
        status: 'no_script',
        message: 'No script available for this game'
      });
    }

    // Check if game is in maintenance
    if (script.maintenance) {
      return res.json({
        valid: false,
        status: 'game_maintenance',
        message: script.maintenanceMessage || 'This game is currently under maintenance. Please try again later.'
      });
    }

    // Check if game is paused
    if (script.paused) {
      return res.json({
        valid: false,
        status: 'game_paused',
        message: 'This script is currently paused and unavailable for use.'
      });
    }

    // Generate temporary script token
    const scriptToken = generateScriptAccessToken(keyRecord.id, placeId);

    // Store token for one-time use
    const expiresIn = parseInt(process.env.SCRIPT_TOKEN_EXPIRES_IN) || 60;
    await req.prisma.scriptToken.create({
      data: {
        token: scriptToken,
        keyId: keyRecord.id,
        placeId: BigInt(placeId),
        expiresAt: new Date(Date.now() + expiresIn * 1000)
      }
    });

    await logWithRequest(req.prisma, req, AuditEvents.KEY_VALIDATED, {
      keyId: keyRecord.id,
      placeId,
      userId: keyRecord.userId
    });

    res.json({
      valid: true,
      status: 'active',
      message: 'Key validated successfully',
      scriptToken,
      scriptUrl: `/scripts/${placeId}`,
      gameName: script.name,
      version: script.version
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.json({
        valid: false,
        status: 'invalid_request',
        message: 'Invalid request format'
      });
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /loader/info - Get hub info (public)
// ═══════════════════════════════════════════════════════════════
router.get('/info', async (req, res, next) => {
  try {
    const settings = await req.prisma.systemSettings.findUnique({
      where: { id: 'default' }
    });

    // Check maintenance mode
    if (settings?.maintenanceMode) {
      return res.json({
        success: true,
        maintenance: true,
        message: settings.maintenanceMessage || 'Hub is under maintenance'
      });
    }

    // Get available games count
    const gamesCount = await req.prisma.gameScript.count({
      where: { enabled: true }
    });

    res.json({
      success: true,
      maintenance: false,
      hubName: settings?.hubName || 'Wisper Hub',
      version: settings?.loaderVersion || '1.0.0',
      gamesAvailable: gamesCount,
      checkpointsRequired: settings?.checkpointsRequired || 0,
      websiteUrl: process.env.FRONTEND_URL
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /loader/games - List supported games (public)
// ═══════════════════════════════════════════════════════════════
router.get('/games', async (req, res, next) => {
  try {
    const scripts = await req.prisma.gameScript.findMany({
      where: { enabled: true },
      select: {
        name: true,
        placeId: true,
        version: true
      }
    });

    const games = scripts.map(s => ({
      name: s.name,
      placeId: s.placeId.toString(),
      version: s.version
    }));

    res.json({
      success: true,
      games,
      count: games.length
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /loader/error - Log execution errors from Roblox client
// ═══════════════════════════════════════════════════════════════

// In-memory error log storage (last 100 errors)
const executionErrors = [];
const MAX_ERRORS = 100;

router.post('/error', async (req, res) => {
  try {
    const { error, stack, executor, placeId, userId, hwid, timestamp } = req.body;
    
    const errorLog = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      error: String(error || 'Unknown error').substring(0, 500),
      stack: String(stack || '').substring(0, 2000),
      executor: String(executor || 'Unknown').substring(0, 50),
      placeId: Number(placeId) || 0,
      userId: Number(userId) || 0,
      hwid: String(hwid || '').substring(0, 32),
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    executionErrors.unshift(errorLog);
    
    // Keep only last MAX_ERRORS
    if (executionErrors.length > MAX_ERRORS) {
      executionErrors.pop();
    }
    
    console.log('[Loader Error]', errorLog.error, '| Executor:', errorLog.executor, '| PlaceId:', errorLog.placeId);
    
    res.json({ success: true, logged: true });
  } catch (err) {
    res.json({ success: false, error: 'Failed to log error' });
  }
});

// GET /loader/errors - Get execution errors (for admin)
router.get('/errors', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, MAX_ERRORS);
  res.json({
    errors: executionErrors.slice(0, limit),
    total: executionErrors.length
  });
});

// DELETE /loader/errors - Clear execution errors (for admin)
router.delete('/errors', async (req, res) => {
  executionErrors.length = 0;
  res.json({ success: true, message: 'Errors cleared' });
});

// ═══════════════════════════════════════════════════════════════
// GET /loader/script - Serve the loader script (for testing)
// ═══════════════════════════════════════════════════════════════
router.get('/script', async (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const loaderPath = path.join(__dirname, '../../..', 'loader', 'loader.lua');
    
    if (!fs.existsSync(loaderPath)) {
      return res.status(404).send('-- Loader script not found');
    }
    
    const loaderContent = fs.readFileSync(loaderPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(loaderContent);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
