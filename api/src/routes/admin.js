// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate, requireAdmin, requireOwner } = require('../middleware/auth');
const { adminRateLimiter } = require('../middleware/rateLimiter');
const { maskKey, maskHwid } = require('../utils/crypto');
const { AuditEvents, logWithRequest } = require('../utils/audit');
const { AppError } = require('../middleware/errorHandler');
const { getGameInfo } = require('../utils/roblox');

// Apply admin middleware to all routes
router.use(authenticate, requireAdmin, adminRateLimiter);

// Validation schemas
const createScriptSchema = z.object({
  name: z.string().min(1).max(100),
  placeId: z.number().int().positive(),
  gameId: z.number().int().positive().optional(),
  content: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  iconUrl: z.string().url().optional().nullable()
});

const updateScriptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  version: z.string().optional(),
  iconUrl: z.string().optional().nullable(),
  maintenance: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional().nullable()
});

const createCheckpointSchema = z.object({
  order: z.number().int().positive(),
  platform: z.enum(['linkvertise', 'lootlabs', 'workink', 'other']),
  url: z.string().url(),
  name: z.string().max(100).optional(),
  enabled: z.boolean().optional().default(true)
});

const updateCheckpointSchema = z.object({
  order: z.number().int().positive().optional(),
  platform: z.enum(['linkvertise', 'lootlabs', 'workink', 'other']).optional(),
  url: z.string().url().optional(),
  name: z.string().max(100).optional(),
  enabled: z.boolean().optional()
});

const updateSettingsSchema = z.object({
  hubName: z.string().min(1).max(100).optional(),
  hubDescription: z.string().max(500).nullable().optional(),
  checkpointsRequired: z.number().int().min(0).optional(),
  keyActivationHours: z.number().int().min(1).optional(),
  maxHwidResets: z.number().int().min(0).optional(),
  keyExpirationDays: z.number().int().min(1).nullable().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).nullable().optional(),
  loaderVersion: z.string().max(20).nullable().optional()
});

// ═══════════════════════════════════════════════════════════════
// USERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /admin/users - List all users
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { username: { contains: search } },
            { discordId: { contains: search } }
          ]
        }
      : {};

    const [users, total] = await Promise.all([
      req.prisma.user.findMany({
        where,
        include: {
          key: {
            select: {
              key: true,
              isActive: true,
              hwidHash: true,
              hwidResetCount: true,
              createdAt: true
            }
          },
          _count: {
            select: { checkpointProgress: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      req.prisma.user.count({ where })
    ]);

    const formattedUsers = users.map(user => ({
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      isOwner: user.isOwner,
      isBanned: user.isBanned,
      createdAt: user.createdAt,
      key: user.key ? {
        key: maskKey(user.key.key),
        isActive: user.key.isActive,
        hwidBound: !!user.key.hwidHash,
        hwidResetCount: user.key.hwidResetCount,
        createdAt: user.key.createdAt
      } : null,
      checkpointsCompleted: user._count.checkpointProgress
    }));

    res.json({
      success: true,
      users: formattedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/users/:id - Get user details (FULL INFO for admin)
router.get('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({
      where: { id },
      include: {
        key: true,
        checkpointProgress: {
          include: { checkpoint: true }
        }
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Calculate time remaining for key
    let keyInfo = null;
    if (user.key) {
      const now = new Date();
      let timeRemaining = null;
      let isExpired = false;
      const isPermanent = !user.key.expiresAt;

      if (user.key.expiresAt) {
        const diff = user.key.expiresAt.getTime() - now.getTime();
        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = { days, hours, minutes, totalMs: diff };
        } else {
          isExpired = true;
        }
      }

      keyInfo = {
        id: user.key.id,
        key: user.key.key, // FULL KEY for admin
        isActive: user.key.isActive,
        isExpired,
        isPermanent,
        expiresAt: user.key.expiresAt,
        timeRemaining,
        activatedAt: user.key.activatedAt,
        createdAt: user.key.createdAt,
        
        // FULL HWID for admin
        hwidHash: user.key.hwidHash,
        hwidBound: !!user.key.hwidHash,
        hwidResetCount: user.key.hwidResetCount || 0,
        hwidResetWindowStart: user.key.hwidResetWindowStart,
        lastHwidReset: user.key.lastHwidReset,
        
        // Executor/Device info
        lastExecutor: user.key.lastExecutor,
        lastPlaceId: user.key.lastPlaceId ? user.key.lastPlaceId.toString() : null,
        lastUsedAt: user.key.lastUsedAt
      };
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        key: keyInfo,
        checkpointProgress: user.checkpointProgress
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:id/reset-hwid - Reset user's HWID
router.post('/users/:id/reset-hwid', async (req, res, next) => {
  try {
    const { id } = req.params;

    const key = await req.prisma.key.findUnique({
      where: { userId: id }
    });

    if (!key) {
      throw new AppError('User has no key', 404, 'KEY_NOT_FOUND');
    }

    await req.prisma.key.update({
      where: { id: key.id },
      data: {
        hwidHash: null,
        lastHwidReset: new Date()
      }
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_HWID_RESET, {
      targetUserId: id,
      keyId: key.id
    });

    res.json({
      success: true,
      message: 'HWID reset successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:id/update-key - Update user's key (time, permanent, etc)
router.post('/users/:id/update-key', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, hours, days } = req.body;
    // action: 'add_hours', 'add_days', 'set_permanent', 'set_expiration', 'revoke'

    const key = await req.prisma.key.findUnique({
      where: { userId: id }
    });

    if (!key) {
      throw new AppError('User has no key', 404, 'KEY_NOT_FOUND');
    }

    let updateData = {};
    let message = '';

    switch (action) {
      case 'add_hours':
        if (!hours || hours < 1) {
          throw new AppError('Hours must be at least 1', 400, 'INVALID_HOURS');
        }
        const newExpiresHours = key.expiresAt 
          ? new Date(Math.max(key.expiresAt.getTime(), Date.now()) + hours * 60 * 60 * 1000)
          : new Date(Date.now() + hours * 60 * 60 * 1000);
        updateData = { expiresAt: newExpiresHours };
        message = `Added ${hours} hours to key`;
        break;

      case 'add_days':
        if (!days || days < 1) {
          throw new AppError('Days must be at least 1', 400, 'INVALID_DAYS');
        }
        const newExpiresDays = key.expiresAt 
          ? new Date(Math.max(key.expiresAt.getTime(), Date.now()) + days * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        updateData = { expiresAt: newExpiresDays };
        message = `Added ${days} days to key`;
        break;

      case 'set_permanent':
        updateData = { expiresAt: null };
        message = 'Key set to permanent (never expires)';
        break;

      case 'set_expiration':
        if (!hours && !days) {
          throw new AppError('Specify hours or days', 400, 'INVALID_PARAMS');
        }
        const totalMs = (hours || 0) * 60 * 60 * 1000 + (days || 0) * 24 * 60 * 60 * 1000;
        updateData = { expiresAt: new Date(Date.now() + totalMs) };
        message = `Key expiration set to ${days || 0}d ${hours || 0}h from now`;
        break;

      case 'revoke':
        updateData = { isActive: false };
        message = 'Key revoked';
        break;

      case 'activate':
        updateData = { isActive: true };
        message = 'Key activated';
        break;

      default:
        throw new AppError('Invalid action', 400, 'INVALID_ACTION');
    }

    await req.prisma.key.update({
      where: { id: key.id },
      data: updateData
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_KEY_UPDATED, {
      targetUserId: id,
      keyId: key.id,
      action,
      hours,
      days
    });

    res.json({
      success: true,
      message
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/users/:id/delete-key - Delete user's key entirely
router.delete('/users/:id/delete-key', async (req, res, next) => {
  try {
    const { id } = req.params;

    const key = await req.prisma.key.findUnique({
      where: { userId: id }
    });

    if (!key) {
      throw new AppError('User has no key', 404, 'KEY_NOT_FOUND');
    }

    // Delete checkpoint progress for this user
    await req.prisma.checkpointProgress.deleteMany({
      where: { userId: id }
    });

    // Delete the key
    await req.prisma.key.delete({
      where: { id: key.id }
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_KEY_DELETED, {
      targetUserId: id,
      keyId: key.id
    });

    res.json({
      success: true,
      message: 'Key deleted successfully. User will need to complete checkpoints and generate a new key.'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:id/ban - Ban user
router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.isOwner) {
      throw new AppError('Cannot ban owner', 403, 'CANNOT_BAN_OWNER');
    }

    if (user.isAdmin && !req.user.isOwner) {
      throw new AppError('Only owner can ban admins', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    await req.prisma.user.update({
      where: { id },
      data: { isBanned: true }
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_USER_BANNED, {
      targetUserId: id,
      targetUsername: user.username
    });

    res.json({
      success: true,
      message: 'User banned successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:id/unban - Unban user
router.post('/users/:id/unban', async (req, res, next) => {
  try {
    const { id } = req.params;

    await req.prisma.user.update({
      where: { id },
      data: { isBanned: false }
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_USER_UNBANNED, {
      targetUserId: id
    });

    res.json({
      success: true,
      message: 'User unbanned successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:id/make-admin - Make user admin (owner only)
router.post('/users/:id/make-admin', requireOwner, async (req, res, next) => {
  try {
    const { id } = req.params;

    await req.prisma.user.update({
      where: { id },
      data: { isAdmin: true }
    });

    res.json({
      success: true,
      message: 'User is now an admin'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:id/remove-admin - Remove admin (owner only)
router.post('/users/:id/remove-admin', requireOwner, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({ where: { id } });

    if (user?.isOwner) {
      throw new AppError('Cannot remove owner admin status', 403, 'CANNOT_MODIFY_OWNER');
    }

    await req.prisma.user.update({
      where: { id },
      data: { isAdmin: false }
    });

    res.json({
      success: true,
      message: 'Admin status removed'
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// SCRIPTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /admin/scripts - List all scripts
router.get('/scripts', async (req, res, next) => {
  try {
    const scripts = await req.prisma.gameScript.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const formattedScripts = scripts.map(s => ({
      ...s,
      placeId: s.placeId.toString(),
      gameId: s.gameId?.toString() || null,
      contentPreview: s.content.substring(0, 200) + (s.content.length > 200 ? '...' : '')
    }));

    res.json({
      success: true,
      scripts: formattedScripts
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/scripts/:id - Get script details
router.get('/scripts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const script = await req.prisma.gameScript.findUnique({
      where: { id }
    });

    if (!script) {
      throw new AppError('Script not found', 404, 'SCRIPT_NOT_FOUND');
    }

    res.json({
      success: true,
      script: {
        ...script,
        placeId: script.placeId.toString(),
        gameId: script.gameId?.toString() || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/scripts/:id/preview - Preview obfuscated script
router.get('/scripts/:id/preview', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { level = 'medium' } = req.query;
    const crypto = require('crypto');

    const script = await req.prisma.gameScript.findUnique({
      where: { id }
    });

    if (!script) {
      throw new AppError('Script not found', 404, 'SCRIPT_NOT_FOUND');
    }

    // Import obfuscator
    const { obfuscate } = require('../utils/Obfuscator');

    // Generate unique session ID for each preview (ensures different obfuscation each time)
    const uniqueSessionId = crypto.randomBytes(32).toString('hex');

    // Apply obfuscation with unique session
    const obfuscationResult = obfuscate(script.content, {
      level: level,
      userId: 'preview',
      keyId: 'preview',
      sessionId: uniqueSessionId
    });

    // Calculate hash of original content to verify it's the correct script
    const contentHash = crypto.createHash('sha256').update(script.content).digest('hex').substring(0, 16);

    // Extract payload size from obfuscated code (the encrypted bytes array)
    const payloadMatch = obfuscationResult.code.match(/local\s+\w+\s*=\s*\{([\d,\s]+)\}/);
    const payloadSize = payloadMatch ? payloadMatch[1].split(',').length : 0;

    res.json({
      success: true,
      script: {
        id: script.id,
        name: script.name,
        placeId: script.placeId.toString()
      },
      original: {
        content: script.content,
        size: script.content.length,
        lines: script.content.split('\n').length,
        hash: contentHash
      },
      obfuscated: {
        content: obfuscationResult.code,
        size: obfuscationResult.code.length,
        lines: obfuscationResult.code.split('\n').length,
        level: level,
        ratio: obfuscationResult.stats.ratio,
        buildId: obfuscationResult.buildId,
        payloadBytes: payloadSize
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/roblox/game/:placeId - Get Roblox game info
router.get('/roblox/game/:placeId', async (req, res, next) => {
  try {
    const { placeId } = req.params;
    const gameInfo = await getGameInfo(placeId);
    
    if (!gameInfo) {
      throw new AppError('Could not fetch game info from Roblox', 404, 'GAME_NOT_FOUND');
    }
    
    res.json({
      success: true,
      game: gameInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/scripts - Create new script
router.post('/scripts', async (req, res, next) => {
  try {
    const data = createScriptSchema.parse(req.body);

    // Try to fetch game icon from Roblox if not provided
    let iconUrl = data.iconUrl || null;
    let gameId = data.gameId ? BigInt(data.gameId) : null;
    
    if (!iconUrl) {
      const gameInfo = await getGameInfo(data.placeId);
      if (gameInfo) {
        iconUrl = gameInfo.iconUrl;
        if (!gameId && gameInfo.universeId) {
          gameId = BigInt(gameInfo.universeId);
        }
      }
    }

    const script = await req.prisma.gameScript.create({
      data: {
        name: data.name,
        placeId: BigInt(data.placeId),
        gameId: gameId,
        content: data.content,
        enabled: data.enabled,
        iconUrl: iconUrl
      }
    });

    await logWithRequest(req.prisma, req, AuditEvents.SCRIPT_CREATED, {
      scriptId: script.id,
      name: script.name,
      placeId: data.placeId
    });

    res.json({
      success: true,
      script: {
        ...script,
        placeId: script.placeId.toString(),
        gameId: script.gameId?.toString() || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/scripts/:id - Update script
router.put('/scripts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateScriptSchema.parse(req.body);

    const script = await req.prisma.gameScript.update({
      where: { id },
      data
    });

    await logWithRequest(req.prisma, req, AuditEvents.SCRIPT_UPDATED, {
      scriptId: script.id,
      name: script.name
    });

    res.json({
      success: true,
      script: {
        ...script,
        placeId: script.placeId.toString(),
        gameId: script.gameId?.toString() || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/scripts/:id - Delete script
router.delete('/scripts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const script = await req.prisma.gameScript.delete({
      where: { id }
    });

    await logWithRequest(req.prisma, req, AuditEvents.SCRIPT_DELETED, {
      scriptId: id,
      name: script.name
    });

    res.json({
      success: true,
      message: 'Script deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// CHECKPOINTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /admin/checkpoints - List all checkpoints
router.get('/checkpoints', async (req, res, next) => {
  try {
    const checkpoints = await req.prisma.checkpoint.findMany({
      orderBy: { order: 'asc' }
    });

    res.json({
      success: true,
      checkpoints
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/checkpoints - Create checkpoint
router.post('/checkpoints', async (req, res, next) => {
  try {
    const data = createCheckpointSchema.parse(req.body);

    const checkpoint = await req.prisma.checkpoint.create({
      data
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_CHECKPOINT_CREATED, {
      checkpointId: checkpoint.id,
      order: checkpoint.order,
      platform: checkpoint.platform
    });

    res.json({
      success: true,
      checkpoint
    });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/checkpoints/:id - Update checkpoint
router.put('/checkpoints/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateCheckpointSchema.parse(req.body);

    const checkpoint = await req.prisma.checkpoint.update({
      where: { id },
      data
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_CHECKPOINT_UPDATED, {
      checkpointId: checkpoint.id
    });

    res.json({
      success: true,
      checkpoint
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/checkpoints/:id - Delete checkpoint
router.delete('/checkpoints/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Delete all progress for this checkpoint
    await req.prisma.checkpointProgress.deleteMany({
      where: { checkpointId: id }
    });

    await req.prisma.checkpoint.delete({
      where: { id }
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_CHECKPOINT_DELETED, {
      checkpointId: id
    });

    res.json({
      success: true,
      message: 'Checkpoint deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// SETTINGS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /admin/settings - Get system settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await req.prisma.systemSettings.findUnique({
      where: { id: 'default' }
    });

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/settings - Update system settings
router.put('/settings', async (req, res, next) => {
  try {
    const data = updateSettingsSchema.parse(req.body);

    const settings = await req.prisma.systemSettings.update({
      where: { id: 'default' },
      data
    });

    await logWithRequest(req.prisma, req, AuditEvents.ADMIN_SETTINGS_UPDATED, {
      changes: Object.keys(data)
    });

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════

// GET /admin/logs - Get audit logs
router.get('/logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 100, event, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (event) where.event = event;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      req.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { username: true, discordId: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      req.prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════

// GET /admin/stats - Get dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalKeys,
      activeKeys,
      totalScripts,
      totalCheckpoints,
      recentLogins
    ] = await Promise.all([
      req.prisma.user.count(),
      req.prisma.key.count(),
      req.prisma.key.count({ where: { isActive: true } }),
      req.prisma.gameScript.count({ where: { enabled: true } }),
      req.prisma.checkpoint.count({ where: { enabled: true } }),
      req.prisma.auditLog.count({
        where: {
          event: 'user_login',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalKeys,
        activeKeys,
        totalScripts,
        totalCheckpoints,
        recentLogins
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
