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
const loaderTokenRoutes = require('./routes/loaderToken');

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
app.use('/api/loader-token', loaderTokenRoutes);

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
    
    // OBFUSCATE the loader content (makes dumped code unreadable)
    try {
      const obfResult = obfuscate(loaderContent, { userId: 'loader', keyId: buildId });
      if (obfResult.success && obfResult.code) {
        loaderContent = obfResult.code;
        console.log('[Loader] Obfuscated:', obfResult.stats.originalSize, '->', obfResult.stats.obfuscatedSize, 'bytes');
      }
    } catch (obfError) {
      console.warn('[Loader] Obfuscation failed, using original:', obfError.message);
      // Continue with non-obfuscated code if obfuscation fails
    }
    
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
    
    // Create the encrypted loader with aggressive anti-dump detection
    const securityApiUrl = apiUrl.replace('/api', '/api/security');
    const bootstrapWrapper = `local _API="${securityApiUrl}"
local _K={${xorKey.join(',')}}
local _E={${encryptedBytes.join(',')}}
local _SAFE=true
local P=game:GetService("Players").LocalPlayer
local H=game:GetService("HttpService")
local _r=request or syn and syn.request or http_request or http and http.request
local exec=(identifyexecutor and identifyexecutor()or"Unknown")

local function _report(action,details)
pcall(function()
if _r then _r({Url=_API.."/report",Method="POST",Headers={["Content-Type"]="application/json"},Body=H:JSONEncode({robloxUserId=P.UserId,robloxName=P.Name,placeId=game.PlaceId,executor=exec,action=action,details=details})})end
end)
end

local function _crash(msg,action)
_SAFE=false
_report(action or"HOOK_DETECTED",{reason=msg})
pcall(function()P:Kick("\\n\\n[Wisper] "..msg.."\\n\\n")end)
while true do local _={}for i=1,1e8 do _[i]=i end _=nil end
end

-- Check if banned
pcall(function()
if _r then
local res=_r({Url=_API.."/check-ban/"..P.UserId,Method="GET"})
if res and res.Body then
local d=H:JSONDecode(res.Body)
if d.banned then _crash("Banned: "..(d.reason or"Security violation"),"BAN_CHECK")end
end
end
end)

-- AGGRESSIVE ANTI-DUMP V2

-- 1. SCAN MEMORY WITH GETGC (finds LOCAL variables too!)
pcall(function()
if getgc then
local dominated={"discord.com/api/webhooks","STEALTH","DUMPER","sendDump","captured","Dump stealth","SCRIPT CAPTURADO","hookfunc"}
for _,obj in pairs(getgc(true))do
if type(obj)=="string"and #obj>10 then
local lower=obj:lower()
for _,p in pairs(dominated)do
if lower:find(p:lower())then _crash("Memory contains: "..p,"DUMP_ATTEMPT")end
end
end
if type(obj)=="table"then
for k,v in pairs(obj)do
if type(k)=="string"then
local ks=k:lower()
if ks:find("webhook")or ks:find("captured")or ks:find("senddump")or ks:find("dumper")then
_crash("Table key in memory: "..k,"DUMP_ATTEMPT")
end
end
end
end
if type(obj)=="function"then
pcall(function()
local info=debug.getinfo(obj)
if info and info.source then
local src=info.source:lower()
if src:find("dumper")or src:find("stealth")or src:find("hook")then
_crash("Suspicious function: "..tostring(info.source),"DUMP_ATTEMPT")
end
end
end)
end
end
end
end)

-- 2. INTERCEPT ALL HTTP REQUESTS TO WEBHOOKS
pcall(function()
local _origReq=request or syn and syn.request or http_request
if _origReq and not _G.__WISPER_HOOKED then
_G.__WISPER_HOOKED=true
local function safeReq(opts)
if type(opts)=="table"and opts.Url then
local url=opts.Url:lower()
if url:find("discord")and url:find("webhook")then
local body=opts.Body or""
if body:lower():find("dump")or body:lower():find("captur")or body:lower():find("script")then
_crash("Webhook dump intercepted","DUMP_ATTEMPT")
end
end
end
return _origReq(opts)
end
rawset(_G,"request",safeReq)
if syn then rawset(syn,"request",safeReq)end
rawset(_G,"http_request",safeReq)
end
end)

-- 3. CHECK IF LOADSTRING WAS HOOKED BY TESTING BEHAVIOR
pcall(function()
local _ls=loadstring or load
local testCode="return 82673"
local fn=_ls(testCode)
if type(fn)~="function"then _crash("loadstring returned non-function","HOOK_DETECTED")end
local result=fn()
if result~=82673 then _crash("loadstring result mismatch","HOOK_DETECTED")end
end)

-- 4. CHECK GETFENV FOR SUSPICIOUS ENVIRONMENTS
pcall(function()
if getgenv then
local genv=getgenv()
for k,v in pairs(genv)do
local ks=tostring(k):lower()
if ks:find("hook")or ks:find("dump")or ks:find("capture")or ks:find("webhook")then
_crash("Suspicious genv key: "..tostring(k),"DUMP_ATTEMPT")
end
end
end
end)

-- 5. CHECK SCRIPT CONTEXT FOR INJECTED SCRIPTS
pcall(function()
if getrunningscripts then
for _,scr in pairs(getrunningscripts())do
local name=scr.Name:lower()
if name:find("dump")or name:find("hook")or name:find("stealth")then
_crash("Suspicious script: "..scr.Name,"DUMP_ATTEMPT")
end
end
end
end)

-- 6. CHECK DEBUG.GETINFO ON CRITICAL FUNCTIONS
pcall(function()
if debug and debug.getinfo then
local funcs={loadstring or load,string.char,table.concat,game.HttpGet}
for _,fn in pairs(funcs)do
pcall(function()
local info=debug.getinfo(fn)
if info then
if info.what~="C"then _crash("Non-C function detected","HOOK_DETECTED")end
if info.nups and info.nups>0 then _crash("Function has upvalues","HOOK_DETECTED")end
end
end)
end
end
end)

-- 7. CHECK FOR TASK.SPAWN ABUSE (dumpers use it)
pcall(function()
if getgc then
local spawnCount=0
for _,obj in pairs(getgc())do
if type(obj)=="thread"then spawnCount=spawnCount+1 end
end
if spawnCount>20 then _crash("Too many threads: "..spawnCount,"DUMP_ATTEMPT")end
end
end)

if not _SAFE then return end

-- TOKEN-BASED DECRYPTION (anti-dump: code useless without valid server key)
local _TAPI="${apiUrl.replace('/api', '/api/loader-token')}"
local _SK=nil

pcall(function()
if not _r then _crash("No HTTP","DUMP_ATTEMPT")return end
-- Step 1: Get one-time token
local tokRes=_r({Url=_TAPI.."/token",Method="POST",Headers={["Content-Type"]="application/json"},Body=H:JSONEncode({robloxUserId=P.UserId})})
if not tokRes or not tokRes.Body then _crash("Token request failed","DUMP_ATTEMPT")return end
local tokData=H:JSONDecode(tokRes.Body)
if not tokData or not tokData.token then _crash("No token received","DUMP_ATTEMPT")return end
-- Step 2: Validate token to get server key
local valRes=_r({Url=_TAPI.."/validate",Method="POST",Headers={["Content-Type"]="application/json"},Body=H:JSONEncode({token=tokData.token,robloxUserId=P.UserId})})
if not valRes or not valRes.Body then _crash("Validation failed","DUMP_ATTEMPT")return end
local valData=H:JSONDecode(valRes.Body)
if not valData or not valData.valid or not valData.serverKey then _crash("Invalid token","DUMP_ATTEMPT")return end
-- Parse server key into table
_SK={}
for n in valData.serverKey:gmatch("%d+")do table.insert(_SK,tonumber(n))end
if #_SK<1 then _crash("Bad server key","DUMP_ATTEMPT")return end
end)

if not _SAFE or not _SK then return end

-- DECRYPTION (token validated - proceed with client key)
local _X=function(a,b)
if bit32 then return bit32.bxor(a,b)end
local r=0 for j=0,7 do if a%2~=b%2 then r=r+2^j end a=math.floor(a/2)b=math.floor(b/2)end return r
end
local _C={}
for i=1,#_E do
_C[i]=string.char(_X(_E[i],_K[(i-1)%#_K+1]))
end
if not _SAFE then return end
local _F=table.concat(_C)
local _R,_Er=(loadstring or load)(_F)
if _R then _R()elseif _Er then warn("[Wisper] Error")end`;
    
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