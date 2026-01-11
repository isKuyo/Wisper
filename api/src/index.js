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
// const protectionRoutes = require('./routes/protection'); // Removed - using simplified obfuscator

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
// app.use('/api/protection', protectionRoutes); // Removed

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
    
    // Wrap with bootstrap error reporting and anti-dump
    const bootstrapWrapper = `--[[
    WISPER HUB ENTERPRISE LOADER
    Build: ${buildId}
    Generated: ${new Date(buildTime).toISOString()}
    
    SECURITY:
    - No API secrets exposed
    - Session-based authentication
    - HWID hardening
    - Anti-dump protection
    - Anti-instrumentation
]]

-- AGGRESSIVE ANTI-DUMP PROTECTION
local _PROTECTED=(function()
    local _crash=function()
        pcall(function()
            local Players=game:GetService("Players")
            if Players.LocalPlayer then
                Players.LocalPlayer:Kick("\\n\\n\\n[Wisper Hub] Script dumping detected.\\nYour executor has been flagged.\\n\\n\\n")
            end
        end)
        while true do local _={}for i=1,1e7 do _[i]={}end end
    end
    
    -- Detect dumper signatures
    local _dumperSigns={"scriptdump","dumpscript","scripthook","hookscript","captureloadstring","stealthhook","loadstringspy"}
    pcall(function()
        for _,sign in pairs(_dumperSigns)do
            if rawget(_G,sign)or rawget(getfenv(0),sign)then _crash()end
        end
    end)
    
    -- Hook request functions to detect webhooks
    local _origRequest=request or syn and syn.request or http_request
    local _warnWebhook=function(url)
        pcall(function()
            local HttpService=game:GetService("HttpService")
            local Players=game:GetService("Players")
            local user=Players.LocalPlayer and Players.LocalPlayer.Name or "Unknown"
            local userId=Players.LocalPlayer and Players.LocalPlayer.UserId or 0
            local msg={
                content="**⚠️ ANTI-DUMP WARNING**\\n\\nSomeone tried to dump Wisper Hub scripts!\\n\\n**Dumper:** "..user.." (ID: "..userId..")\\n**Place:** "..game.PlaceId.."\\n\\n*This webhook has been detected and reported.*",
                username="Wisper Hub Security",
                avatar_url="https://i.imgur.com/QpPOQVe.png"
            }
            if _origRequest then
                pcall(function()
                    _origRequest({Url=url,Method="POST",Headers={["Content-Type"]="application/json"},Body=HttpService:JSONEncode(msg)})
                end)
            end
        end)
    end
    
    -- Intercept and detect webhook URLs in requests
    pcall(function()
        local _hook=function(orig)
            return function(opts)
                if type(opts)=="table"and opts.Url then
                    local url=opts.Url:lower()
                    if url:find("discord")and url:find("webhook")then
                        _warnWebhook(opts.Url)
                        _crash()
                    end
                    if opts.Body and type(opts.Body)=="string"then
                        local body=opts.Body:lower()
                        if body:find("script capturado")or body:find("dump")or body:find("loadstring")then
                            if url:find("discord")then _warnWebhook(opts.Url)end
                            _crash()
                        end
                    end
                end
                return orig(opts)
            end
        end
        if request then rawset(_G,"request",_hook(request))end
        if http_request then rawset(_G,"http_request",_hook(http_request))end
        if syn and syn.request then syn.request=_hook(syn.request)end
    end)
    
    -- Disable dump functions
    pcall(function()
        local _env=getfenv(0)or _G
        local _kill={"decompile","disassemble","dumpstring","getscriptbytecode","getscripthash","debug_getupvalues","getupvalues","getprotos","getconstants","setupvalue","getupvalue"}
        for _,fn in pairs(_kill)do rawset(_env,fn,nil)rawset(_G,fn,nil)end
    end)
    
    -- Clear debug hooks
    pcall(function()if debug and debug.sethook then debug.sethook(function()end,"",0)end end)
    
    -- Metatable protection - crash on getinfo attempts
    pcall(function()
        local _mt={
            __tostring=function()return""end,
            __metatable="Protected",
            __index=function()return nil end,
            __newindex=function()end
        }
        setmetatable(_G,_mt)
    end)
    
    return true
end)()

local _BUILD_ID = "${buildId}"
local _BUILD_TIME = ${buildTime}
local _API_URL = "${apiUrl}"

-- Integrity check
local _INTEGRITY = (function()
    local h = 0
    local s = _BUILD_ID .. tostring(_BUILD_TIME)
    for i = 1, #s do
        h = (h * 31 + string.byte(s, i)) % 2147483647
    end
    return h
end)()

-- Error reporting (no secrets needed)
local function _reportError(errorMsg, stack, phase)
    pcall(function()
        local HttpService = game:GetService("HttpService")
        local Players = game:GetService("Players")
        local executorName = "Unknown"
        pcall(function() 
            if identifyexecutor then 
                executorName = identifyexecutor() or "Unknown" 
            end 
        end)
        
        local body = HttpService:JSONEncode({
            error = tostring(errorMsg),
            stack = tostring(stack or ""),
            executor = executorName,
            placeId = game.PlaceId,
            userId = Players.LocalPlayer and Players.LocalPlayer.UserId or 0,
            phase = phase or "unknown",
            build = _BUILD_ID,
            timestamp = os.time() * 1000
        })
        
        local requestFunc = syn and syn.request or request or http_request
        if requestFunc then
            requestFunc({
                Url = _API_URL .. "/loader/error",
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = body
            })
        end
    end)
end

-- Main execution
local function _runLoader()
    local loaderCode = [==[
${loaderContent}
]==]

    local chunk, compileErr = loadstring(loaderCode)
    if not chunk then
        warn("[Wisper Hub] Compile error: " .. tostring(compileErr))
        _reportError(compileErr, "", "compile")
        return
    end
    
    local ok, execErr = pcall(chunk)
    if not ok then
        warn("[Wisper Hub] Execution error: " .. tostring(execErr))
        _reportError(execErr, debug.traceback(), "execute")
    end
end

-- Protected entry point
local ok, err = pcall(_runLoader)
if not ok then
    warn("[Wisper Hub] Bootstrap error: " .. tostring(err))
    _reportError(err, debug.traceback(), "bootstrap")
end
`;
    
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