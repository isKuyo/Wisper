const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// PUBLIC: Report security violation (called from loader)
// ═══════════════════════════════════════════════════════════════
router.post('/report', async (req, res) => {
  try {
    const { robloxUserId, robloxName, placeId, executor, action, details, keyUsed, hwid } = req.body;

    if (!robloxUserId || !robloxName || !placeId || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user is already banned
    const existingBan = await req.prisma.bannedRobloxUser.findUnique({
      where: { robloxUserId: BigInt(robloxUserId) }
    });

    // Create security log
    await req.prisma.securityLog.create({
      data: {
        robloxUserId: BigInt(robloxUserId),
        robloxName,
        placeId: BigInt(placeId),
        executor: executor || 'Unknown',
        action,
        details: details ? JSON.stringify(details) : null,
        keyUsed,
        hwid
      }
    });

    console.log(`[Security] ${action} detected: ${robloxName} (${robloxUserId}) in place ${placeId}`);

    res.json({ 
      success: true, 
      banned: !!existingBan,
      message: existingBan ? 'User is banned' : 'Violation logged'
    });
  } catch (error) {
    console.error('[Security] Report error:', error);
    res.status(500).json({ error: 'Failed to log violation' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC: Check if user is banned (called from loader)
// ═══════════════════════════════════════════════════════════════
router.get('/check-ban/:robloxUserId', async (req, res) => {
  try {
    const { robloxUserId } = req.params;

    const ban = await req.prisma.bannedRobloxUser.findUnique({
      where: { robloxUserId: BigInt(robloxUserId) }
    });

    res.json({ 
      banned: !!ban,
      reason: ban?.reason || null
    });
  } catch (error) {
    console.error('[Security] Check ban error:', error);
    res.json({ banned: false });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Get security logs
// ═══════════════════════════════════════════════════════════════
router.get('/logs', async (req, res) => {
  try {
    const { limit = 100, action, robloxUserId } = req.query;

    const where = {};
    if (action) where.action = action;
    if (robloxUserId) where.robloxUserId = BigInt(robloxUserId);

    const logs = await req.prisma.securityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Convert BigInt to string for JSON
    const serialized = logs.map(log => ({
      ...log,
      robloxUserId: log.robloxUserId.toString(),
      placeId: log.placeId.toString()
    }));

    res.json({ logs: serialized });
  } catch (error) {
    console.error('[Security] Get logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Get banned users
// ═══════════════════════════════════════════════════════════════
router.get('/bans', async (req, res) => {
  try {
    const bans = await req.prisma.bannedRobloxUser.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Convert BigInt to string for JSON
    const serialized = bans.map(ban => ({
      ...ban,
      robloxUserId: ban.robloxUserId.toString()
    }));

    res.json({ bans: serialized });
  } catch (error) {
    console.error('[Security] Get bans error:', error);
    res.status(500).json({ error: 'Failed to get bans' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Ban a Roblox user
// ═══════════════════════════════════════════════════════════════
router.post('/ban', async (req, res) => {
  try {
    const { robloxUserId, robloxName, reason, bannedBy } = req.body;

    if (!robloxUserId || !robloxName) {
      return res.status(400).json({ error: 'Missing robloxUserId or robloxName' });
    }

    // Check if already banned
    const existing = await req.prisma.bannedRobloxUser.findUnique({
      where: { robloxUserId: BigInt(robloxUserId) }
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already banned' });
    }

    const ban = await req.prisma.bannedRobloxUser.create({
      data: {
        robloxUserId: BigInt(robloxUserId),
        robloxName,
        reason: reason || 'Security violation',
        bannedBy
      }
    });

    console.log(`[Security] Banned: ${robloxName} (${robloxUserId}) by ${bannedBy}`);

    res.json({ 
      success: true, 
      ban: {
        ...ban,
        robloxUserId: ban.robloxUserId.toString()
      }
    });
  } catch (error) {
    console.error('[Security] Ban error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Unban a Roblox user
// ═══════════════════════════════════════════════════════════════
router.delete('/ban/:robloxUserId', async (req, res) => {
  try {
    const { robloxUserId } = req.params;

    const ban = await req.prisma.bannedRobloxUser.findUnique({
      where: { robloxUserId: BigInt(robloxUserId) }
    });

    if (!ban) {
      return res.status(404).json({ error: 'User is not banned' });
    }

    await req.prisma.bannedRobloxUser.delete({
      where: { robloxUserId: BigInt(robloxUserId) }
    });

    console.log(`[Security] Unbanned: ${ban.robloxName} (${robloxUserId})`);

    res.json({ success: true });
  } catch (error) {
    console.error('[Security] Unban error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Get security stats
// ═══════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalLogs, logs24h, totalBans, actionCounts] = await Promise.all([
      req.prisma.securityLog.count(),
      req.prisma.securityLog.count({
        where: { createdAt: { gte: last24h } }
      }),
      req.prisma.bannedRobloxUser.count(),
      req.prisma.securityLog.groupBy({
        by: ['action'],
        _count: { action: true }
      })
    ]);

    const byAction = {};
    actionCounts.forEach(item => {
      byAction[item.action] = item._count.action;
    });

    res.json({
      stats: {
        totalLogs,
        logs24h,
        totalBans,
        byAction
      }
    });
  } catch (error) {
    console.error('[Security] Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Delete a security log
// ═══════════════════════════════════════════════════════════════
router.delete('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.securityLog.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Security] Delete log error:', error);
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: Clear all logs
// ═══════════════════════════════════════════════════════════════
router.delete('/logs', async (req, res) => {
  try {
    await req.prisma.securityLog.deleteMany();
    res.json({ success: true });
  } catch (error) {
    console.error('[Security] Clear logs error:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

module.exports = router;
