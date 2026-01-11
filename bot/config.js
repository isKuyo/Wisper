// ═══════════════════════════════════════════════════════════════
// WISPER HUB DISCORD BOT - CONFIGURATION
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Bot Token (get from Discord Developer Portal)
  token: process.env.DISCORD_BOT_TOKEN || 'MTQ0NDI5MDM5MzcxNjgyMjE2Nw.GIs4bj.-d1zpk6gbPvZN54sichHFs0PjJBWsFMY21BWOU',

  // Bot Client ID (for registering slash commands)
  clientId: process.env.DISCORD_CLIENT_ID || '1444290393716822167',

  // Owner Discord ID (has full control)
  ownerId: process.env.DISCORD_OWNER_ID || '1088946006663630969',

  // Guild ID (optional - for guild-specific commands during development)
  guildId: process.env.DISCORD_GUILD_ID || null,

  // API Configuration
  api: {
    baseUrl: process.env.API_URL || 'http://localhost:3001',
  },

  // Website URL
  siteUrl: process.env.SITE_URL || 'http://localhost:5173',

  // Embed Colors
  colors: {
    primary: 0x0EA5E9,    // Sky blue - main color
    success: 0x22C55E,    // Green - success messages
    error: 0xEF4444,      // Red - error messages
    warning: 0xF59E0B,    // Orange - warnings
    info: 0x6366F1,       // Indigo - info
  },

  // Loader Script URL (served by the Wisper Hub API)
  loaderScript: process.env.LOADER_SCRIPT || 'loadstring(game:HttpGet("http://localhost:3001/api/loader/script"))()',

  // Bot Activity
  activity: {
    type: 'WATCHING', // PLAYING, STREAMING, LISTENING, WATCHING, COMPETING
    name: 'Wisper Hub',
  },
};
