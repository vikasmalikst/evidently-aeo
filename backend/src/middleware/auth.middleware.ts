import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { authService } from '../services/auth/auth.service';
import { AuthError } from '../types/auth';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        customer_id: string | null;
        role?: string | null;
        full_name?: string | null;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    // Verify token
    const payload = verifyToken(token);
    
    // Get user from database using the user ID from the token
    const user = await authService.getUserProfile(payload.sub);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid token or user not found'
      });
      return;
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      customer_id: user.customer_id,
      role: user.role,
      full_name: user.full_name
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user info to request if token is valid, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const payload = verifyToken(token);
      const user = await authService.getUserProfile(payload.sub);
      
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          customer_id: user.customer_id,
          role: user.role,
          full_name: user.full_name
        };
      }
    }

    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

/**
 * Customer validation middleware
 * Ensures user belongs to the specified customer
 */
export const validateCustomer = (customerIdParam: string = 'customerId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const customerId = req.params[customerIdParam];
    
    if (!customerId) {
      res.status(400).json({
        success: false,
        error: 'Customer ID required'
      });
      return;
    }

    if (req.user.customer_id !== customerId) {
      res.status(403).json({
        success: false,
        error: 'Access denied: Invalid customer'
      });
      return;
    }

    next();
  };
};
