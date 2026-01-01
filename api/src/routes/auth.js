// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { generateAccessToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const { strictRateLimiter } = require('../middleware/rateLimiter');
const { AuditEvents, logWithRequest } = require('../utils/audit');
const { AppError } = require('../middleware/errorHandler');

// Discord OAuth configuration
const DISCORD_API_URL = 'https://discord.com/api/v10';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ═══════════════════════════════════════════════════════════════
// GET /auth/discord - Initiate Discord OAuth
// ═══════════════════════════════════════════════════════════════
router.get('/discord', (req, res) => {
  const state = Buffer.from(JSON.stringify({
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7)
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds guilds.members.read guilds.join',
    state
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// ═══════════════════════════════════════════════════════════════
// GET /auth/discord/callback - Discord OAuth callback
// ═══════════════════════════════════════════════════════════════
router.get('/discord/callback', strictRateLimiter, async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', await tokenResponse.text());
      return res.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Discord
    const userResponse = await fetch(`${DISCORD_API_URL}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    if (!userResponse.ok) {
      return res.redirect(`${FRONTEND_URL}/login?error=user_fetch_failed`);
    }

    const discordUser = await userResponse.json();

    // Check if this is the first user (will be owner)
    const userCount = await req.prisma.user.count();
    const isFirstUser = userCount === 0;

    // Find or create user
    let user = await req.prisma.user.findUnique({
      where: { discordId: discordUser.id }
    });

    if (user) {
      // Update existing user
      user = await req.prisma.user.update({
        where: { id: user.id },
        data: {
          username: `${discordUser.username}`,
          avatar: discordUser.avatar,
          email: discordUser.email
        }
      });

      await logWithRequest(req.prisma, req, AuditEvents.USER_LOGIN, {
        discordId: discordUser.id,
        username: discordUser.username
      });
    } else {
      // Create new user
      user = await req.prisma.user.create({
        data: {
          discordId: discordUser.id,
          username: `${discordUser.username}`,
          avatar: discordUser.avatar,
          email: discordUser.email,
          isAdmin: isFirstUser,
          isOwner: isFirstUser
        }
      });

      await logWithRequest(req.prisma, req, AuditEvents.USER_REGISTER, {
        discordId: discordUser.id,
        username: discordUser.username,
        isFirstUser
      });
    }

    // Generate JWT token
    const token = generateAccessToken(user.id, {
      discordId: user.discordId,
      isAdmin: user.isAdmin
    });

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /auth/me - Get current user
// ═══════════════════════════════════════════════════════════════
router.get('/me', authenticate, async (req, res) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      key: {
        select: {
          key: true,
          isActive: true,
          expiresAt: true,
          hwidResetCount: true,
          createdAt: true
        }
      },
      checkpointProgress: {
        include: {
          checkpoint: true
        }
      }
    }
  });

  // Get total checkpoints required
  const settings = await req.prisma.systemSettings.findUnique({
    where: { id: 'default' }
  });

  const totalCheckpoints = await req.prisma.checkpoint.count({
    where: { enabled: true }
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      isOwner: user.isOwner,
      createdAt: user.createdAt,
      key: user.key,
      checkpointsCompleted: user.checkpointProgress.length,
      checkpointsRequired: totalCheckpoints,
      allCheckpointsCompleted: user.checkpointProgress.length >= totalCheckpoints
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /auth/logout - Logout (invalidate session)
// ═══════════════════════════════════════════════════════════════
router.post('/logout', authenticate, async (req, res) => {
  await logWithRequest(req.prisma, req, AuditEvents.USER_LOGOUT, {
    userId: req.user.id
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /auth/status - Get public hub status (maintenance, etc)
// ═══════════════════════════════════════════════════════════════
router.get('/status', async (req, res, next) => {
  try {
    const settings = await req.prisma.systemSettings.findUnique({
      where: { id: 'default' }
    });

    // Get games in maintenance
    const gamesInMaintenance = await req.prisma.gameScript.findMany({
      where: { maintenance: true },
      select: {
        id: true,
        name: true,
        placeId: true,
        iconUrl: true,
        maintenanceMessage: true
      }
    });

    res.json({
      success: true,
      status: {
        hubName: settings?.hubName || 'Wisper Hub',
        maintenanceMode: settings?.maintenanceMode || false,
        maintenanceMessage: settings?.maintenanceMessage || null,
        gamesInMaintenance: gamesInMaintenance.map(g => ({
          ...g,
          placeId: g.placeId.toString()
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
