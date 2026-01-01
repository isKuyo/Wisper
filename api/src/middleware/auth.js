// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await req.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { key: true }
    });

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (user.isBanned) {
      throw new AppError('Account is banned', 403, 'ACCOUNT_BANNED');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
    }
    next(error);
  }
};

// Verify admin access
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!req.user.isAdmin && !req.user.isOwner) {
      throw new AppError('Admin access required', 403, 'ADMIN_REQUIRED');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Verify owner access
const requireOwner = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!req.user.isOwner) {
      throw new AppError('Owner access required', 403, 'OWNER_REQUIRED');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await req.prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (user && !user.isBanned) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requireOwner,
  optionalAuth
};
