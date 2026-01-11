require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const keyRoutes = require('./routes/keys');
const checkpointRoutes = require('./routes/checkpoints');
const scriptRoutes = require('./routes/scripts');
const adminRoutes = require('./routes/admin');
const loaderRoutes = require('./routes/loader');
const securityRoutes = require('./routes/security');

const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const { loaderSecurityMiddleware, getAccessLogs, getBlacklist, getSuspiciousIPs, getStats } = require('./middleware/loaderSecurity');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://wisper.lol',
  'https://www.wisper.lol',
  'https://wisper-zeta.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Signature', 
    'X-Timestamp',
    'X-Session',
    'X-HWID',
    'X-Build',
    'X-Auto-Validate'
  ]
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Make prisma available in routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/checkpoints', checkpointRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/loader', loaderRoutes);
app.use('/api/security', securityRoutes);

// Session management
const { generateSessionId, createSession } = require('./utils/session');
const { obfuscate } = require('./utils/obfuscator');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════
// SECURE LOADER ENDPOINT V2
// No API secrets exposed - session-based authentication
// ═══════════════════════════════════════════════════════════════
app.get('/loader', loaderSecurityMiddleware, async (req, res) => {
  try {
    // Use the original loader
    // In Docker: /app/loader/loader.lua, locally: ../../loader/loader.lua
    const loaderPath = process.env.NODE_ENV === 'production' 
      ? path.join('/app', 'loader', 'loader.lua')
      : path.join(__dirname, '../..', 'loader', 'loader.lua');
    
    if (!fs.existsSync(loaderPath)) {
      return res.status(404).send('-- Loader not available');
    }
    
    let loaderContent = fs.readFileSync(loaderPath, 'utf8');
    
    // Dynamic config injection (NO API SECRET - only public URL)
    // Use environment variable or fallback to request host
    const apiUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}/api`;
    const buildId = crypto.randomBytes(8).toString('hex');
    const buildTime = Date.now();
    
    // Inject ONLY public config (no secrets!)
    loaderContent = loaderContent
      .replace(/API_URL = "[^"]*"/, `API_URL = "${apiUrl}"`)
      .replace(/VERSION = "[^"]*"/, `VERSION = "1.0.0"`)
      .replace(/DEBUG = \w+/, `DEBUG = true`);
    
    // Remove any API_SECRET references if they exist (safety measure)
    loaderContent = loaderContent.replace(/API_SECRET = "[^"]*",?\n?/g, '');
    
    // XOR encrypt the loader content
    const xorKey = [];
    for (let i = 0; i < 32; i++) {
      xorKey.push(Math.floor(Math.random() * 256));
    }
    
    const encryptedBytes = [];
    for (let i = 0; i < loaderContent.length; i++) {
      const charCode = loaderContent.charCodeAt(i);
      const keyByte = xorKey[i % xorKey.length];
      encryptedBytes.push(charCode ^ keyByte);
    }
    
    // Create the encrypted loader with anti-dump detection and API reporting
    const securityApiUrl = apiUrl.replace('/api', '/api/security');
    const bootstrapWrapper = `local _API="${securityApiUrl}"
local _K={${xorKey.join(',')}}
local _E={${encryptedBytes.join(',')}}
local function _S()
local P=game:GetService("Players").LocalPlayer
local H=game:GetService("HttpService")
local r=request or syn and syn.request or http_request or http and http.request
local exec=(identifyexecutor and identifyexecutor()or"Unknown")

local function _report(action,details)
pcall(function()
if r then r({Url=_API.."/report",Method="POST",Headers={["Content-Type"]="application/json"},Body=H:JSONEncode({robloxUserId=P.UserId,robloxName=P.Name,placeId=game.PlaceId,executor=exec,action=action,details=details})})end
end)
end

local function _kick(msg)
pcall(function()P:Kick("\\n\\n[Wisper] "..msg.."\\n\\n")end)
while true do local _={}for i=1,1e7 do _[i]={}end end
end

-- Check if banned
pcall(function()
if r then
local res=r({Url=_API.."/check-ban/"..P.UserId,Method="GET"})
if res and res.Body then
local data=H:JSONDecode(res.Body)
if data.banned then _kick("You are banned.\\nReason: "..(data.reason or"Security violation"))end
end
end
end)

-- Detect dumper signatures
local _detected=nil
local signs={"scriptdump","dumpscript","scripthook","stealthhook","loadstringspy","getconstants","getprotos","decompile"}
for _,s in pairs(signs)do
if rawget(_G,s)or rawget(getfenv(0)or{},s)then _detected="DUMP_ATTEMPT"break end
end

-- Detect hook functions
if not _detected then
if hookfunction or hookfunc or replaceclosure or clonefunction then _detected="HOOK_DETECTED"end
end

-- Detect debug hooks
if not _detected then
pcall(function()
if debug and debug.getinfo then
local i=debug.getinfo(loadstring or load)
if i and i.what~="C"then _detected="HOOK_DETECTED"end
end
end)
end

-- Detect tamper attempts
if not _detected then
pcall(function()
if getgenv and getgenv().SCRIPT_DUMP_MODE then _detected="TAMPER_ATTEMPT"end
if getgenv and getgenv().DUMP_SCRIPTS then _detected="DUMP_ATTEMPT"end
end)
end

if _detected then
_report(_detected,{signatures=signs})
_kick("Security violation: ".._detected)
end
end
_S()
local _D=""for i=1,#_E do _D=_D..string.char(bit32 and bit32.bxor(_E[i],_K[(i-1)%#_K+1])or(function(a,b)local r=0 for j=0,7 do if a%2~=b%2 then r=r+2^j end a=math.floor(a/2)b=math.floor(b/2)end return r end)(_E[i],_K[(i-1)%#_K+1]))end
(loadstring or load)(_D)()`;
    
    // NOTE: Loader is NOT obfuscated to ensure reliability
    // Game scripts ARE obfuscated via scripts.js route
    // The loader code is already minified and has anti-tamper features
    
    // Log loader request
    console.log('[Loader] Served build:', buildId, '| IP:', req.ip?.substring(0, 15) || 'unknown');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('X-Build-ID', buildId);
    res.send(bootstrapWrapper);
  } catch (error) {
    console.error('[Loader] Error:', error.message);
    res.status(500).send('-- Error loading script');
  }
});

// WEAO API Proxy (to avoid CORS issues)
app.get('/api/executors', async (req, res) => {
  try {
    const https = require('https');
    
    const options = {
      hostname: 'weao.xyz',
      path: '/api/status/exploits',
      method: 'GET',
      headers: {
        'User-Agent': 'WEAO-3PService'
      }
    };
    
    const request = https.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.json(jsonData);
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse response' });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('WEAO API error:', error);
      res.status(500).json({ error: 'Failed to fetch executors' });
    });
    
    request.end();
  } catch (error) {
    console.error('WEAO API error:', error);
    res.status(500).json({ error: 'Failed to fetch executors' });
  }
});

// Security stats endpoints (before admin routes to avoid auth middleware)
app.get('/api/security/stats', async (req, res) => {
  res.json(getStats());
});

app.get('/api/security/logs', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(getAccessLogs(limit));
});

app.get('/api/security/blacklist', async (req, res) => {
  res.json(getBlacklist());
});

app.get('/api/security/suspicious', async (req, res) => {
  res.json(getSuspiciousIPs());
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ═══════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════

async function initializeDatabase() {
  try {
    // Create default system settings if not exists
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'default' }
    });

    if (!settings) {
      await prisma.systemSettings.create({
        data: {
          id: 'default',
          hubName: 'Wisper Hub',
          checkpointsRequired: 3,
          maxHwidResets: 3
        }
      });
      console.log('✅ Default system settings created');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🌟 WISPER HUB API                                          ║
║                                                               ║
║   Server running on port ${PORT}                               ║
║   Environment: ${process.env.NODE_ENV || 'development'}                            ║
║                                                               ║
║   Endpoints:                                                  ║
║   • Health: http://localhost:${PORT}/api/health                ║
║   • Auth:   http://localhost:${PORT}/api/auth                  ║
║   • Keys:   http://localhost:${PORT}/api/keys                  ║
║   • Admin:  http://localhost:${PORT}/api/admin                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer().catch(console.error);

module.exports = app;