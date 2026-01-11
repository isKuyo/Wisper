const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Generate one-time token for loader decryption
router.post('/token', async (req, res) => {
  try {
    const { robloxUserId } = req.body;
    
    // Generate server-side key (16 random bytes for XOR)
    const serverKeyBytes = [];
    for (let i = 0; i < 16; i++) {
      serverKeyBytes.push(Math.floor(Math.random() * 256));
    }
    const serverKey = serverKeyBytes.join(',');
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token with 30 second expiration
    await req.prisma.loaderToken.create({
      data: {
        token,
        serverKey,
        robloxUserId: robloxUserId ? BigInt(robloxUserId) : null,
        expiresAt: new Date(Date.now() + 30000) // 30 seconds
      }
    });
    
    // Clean up expired tokens
    await req.prisma.loaderToken.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    }).catch(() => {});
    
    console.log('[Token] Generated:', token.substring(0, 8) + '...');
    res.json({ token, expiresIn: 30 });
  } catch (error) {
    console.error('[Token] Error:', error.message);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Validate token and return server key
router.post('/validate', async (req, res) => {
  try {
    const { token, robloxUserId } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const loaderToken = await req.prisma.loaderToken.findUnique({
      where: { token }
    });
    
    if (!loaderToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (loaderToken.used) {
      return res.status(401).json({ error: 'Token already used' });
    }
    
    if (loaderToken.expiresAt < new Date()) {
      await req.prisma.loaderToken.delete({ where: { token } }).catch(() => {});
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // Mark token as used
    await req.prisma.loaderToken.update({
      where: { token },
      data: { used: true, robloxUserId: robloxUserId ? BigInt(robloxUserId) : null }
    });
    
    console.log('[Token] Validated:', token.substring(0, 8) + '...');
    res.json({ serverKey: loaderToken.serverKey, valid: true });
  } catch (error) {
    console.error('[Validate] Error:', error.message);
    res.status(500).json({ error: 'Validation failed' });
  }
});

module.exports = router;
