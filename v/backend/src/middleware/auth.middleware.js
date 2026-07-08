const jwt = require('jsonwebtoken');
const config = require('../config/env');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      }
    });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Token has expired.'
        : 'Invalid or malformed token.';

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message
      }
    });
  }
}

function optionalAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;

  // Public request: allow it through without req.user.
  if (!header) {
    return next();
  }

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization header.'
      }
    });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Token has expired.'
        : 'Invalid or malformed token.';

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message
      }
    });
  }
}

module.exports = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;