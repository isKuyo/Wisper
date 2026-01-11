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
    
    // Wrap with bootstrap error reporting
    const bootstrapWrapper = `--[[
    WISPER HUB ENTERPRISE LOADER
    Build: ${buildId}
    Generated: ${new Date(buildTime).toISOString()}
    
    SECURITY:
    - No API secrets exposed
    - Session-based authentication
    - HWID hardening
    - Anti-instrumentation
]]

local _BUILD_ID = "${buildId}"
local _BUILD_TIME = ${buildTime}
local _API_URL = "${apiUrl}"

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