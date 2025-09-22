import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtPayload } from '../types';
import type { UserRole } from '../models/user.model';

// Verifies that a JWT token is present and valid
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization header missing'
      });
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token is empty'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        let message = 'Invalid token';

        if (err.name === 'TokenExpiredError') {
          message = 'Token expired';
        } else if (err.name === 'JsonWebTokenError') {
          message = 'Token malformed';
        }

        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message
        });
        return;
      }

      const payload = decoded as JwtPayload;

      if (!payload.role) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Token missing role information'
        });
        return;
      }

      req.user = {
        userId: payload.userId,
        username: payload.username,
        role: payload.role
      };

      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Unexpected authentication error'
    });
  }
};

// Optionally verifies JWT token; if verification fails, user remains undefined
export const authenticateTokenOptional = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      delete req.user;
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      delete req.user;
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        delete req.user;
        next();
        return;
      }

      const payload = decoded as JwtPayload;

      if (!payload.role) {
        delete req.user;
        next();
        return;
      }

      req.user = {
        userId: payload.userId,
        username: payload.username,
        role: payload.role
      };

      next();
    });
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    delete req.user;
    next();
  }
};

// Ensures the authenticated user has one of the required roles
export const authorizeRoles = (...allowedRoles: UserRole[]) => (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
    return;
  }

  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to perform this action'
    });
    return;
  }

  next();
};
