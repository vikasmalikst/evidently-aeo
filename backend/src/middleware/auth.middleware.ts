import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { authService } from '../services/auth/auth.service';
import { AuthError } from '../types/auth';
import { config } from '../config/environment';

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
        access_level?: string | null; // Customer access level
        isImpersonating?: boolean; // True when admin is impersonating another customer
        originalCustomerId?: string | null; // Admin's original customer_id when impersonating
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to request
 * Bypasses authentication in development mode if BYPASS_AUTH_IN_DEV is enabled
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Bypass authentication in development mode
  if (config.bypassAuthInDev) {
    console.log('🔓 Dev mode: Bypassing authentication');
    // Set a mock dev user
    req.user = {
      id: 'dev-user-123',
      email: 'dev@evidently.ai',
      customer_id: '123e4567-e89b-12d3-a456-426614174001', // Test Brand customer ID
      role: 'admin',
      full_name: 'Dev User'
    };
    next();
    return;
  }

  try {
    let token = extractTokenFromHeader(req.headers.authorization);

    // Fallback: Check query param (needed for SSE/EventSource which cannot set headers)
    if (!token && req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

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
      full_name: user.full_name,
      access_level: user.access_level || 'user' // Include access_level from customer
    };

    // Handle admin impersonation
    // Note: Admin privileges are stored in access_level within the customers table
    const impersonateCustomerId = req.headers['x-impersonate-customer'] as string | undefined;
    const isAdmin = req.user.access_level === 'admin' || req.user.role === 'admin';

    if (impersonateCustomerId && isAdmin) {
      console.log(`[Auth] Admin ${req.user.email} impersonating customer ${impersonateCustomerId}`);
      req.user.originalCustomerId = req.user.customer_id;
      req.user.customer_id = impersonateCustomerId;
      req.user.isImpersonating = true;
    }

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
          full_name: user.full_name,
          access_level: user.access_level || 'user' // Include access_level
        };

        // Handle admin impersonation (same as authenticateToken)
        const impersonateCustomerId = req.headers['x-impersonate-customer'] as string | undefined;
        const isAdmin = req.user.access_level === 'admin' || req.user.role === 'admin';

        if (impersonateCustomerId && isAdmin) {
          req.user.originalCustomerId = req.user.customer_id;
          req.user.customer_id = impersonateCustomerId;
          req.user.isImpersonating = true;
        }
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
 * Admins can access any customer, and impersonation is handled by auth middleware
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

    // Admins can access any customer (impersonation is already handled in auth middleware)
    const isAdmin = req.user.role === 'admin' || req.user.access_level === 'admin';
    if (isAdmin) {
      next();
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
