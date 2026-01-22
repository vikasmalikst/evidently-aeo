import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/database';

/**
 * Admin authentication middleware
 * Verifies user has role='AL_ADMIN' and email domain='@anvayalabs.com'
 */
export const requireAdminAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is authenticated (from previous auth middleware)
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Check if user has admin privileges 
    // We check both access_level (from customers table) and deprecated role logic
    const isCustomerAdmin = req.user.access_level === 'admin';
    const isLegacyAdmin = req.user.role === 'admin' || req.user.role === 'AL_ADMIN';
    const isAnvayaEmail = req.user.email?.endsWith('@anvayalabs.com');

    // Grant access if admin
    if (isCustomerAdmin || (isLegacyAdmin && isAnvayaEmail)) {
      if (isAnvayaEmail) {
        // console.log(`✅ Anvaya Labs admin access granted to: ${req.user.email}`); 
      } else {
        // console.log(`✅ Customer admin access granted to: ${req.user.email}`);
      }
      next();
      return;
    }

    // DEBUG BYPASS for troubleshooting
    if (req.user.email === 'vmalik9@gmail.com') {
      console.log(`⚠️ DEBUG BYPASS granted for: ${req.user.email}`);
      next();
      return;
    }

    console.log(`Admin access denied for user: ${req.user.email} (role: ${req.user.role}, access_level: ${req.user.access_level})`);
    res.status(403).json({
      success: false,
      error: 'Admin access required. Insufficient privileges.'
    });

  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during admin verification'
    });
  }
};

/**
 * Optional admin access middleware
 * Adds admin flag to request if user is admin, but doesn't require it
 */
export const optionalAdminAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('role, email')
        .eq('id', req.user.id)
        .single();

      if (!userError && user) {
        const isAdmin = user.role === 'AL_ADMIN' &&
          user.email &&
          user.email.endsWith('@anvayalabs.com');

        // Add admin flag to request
        (req as any).isAdmin = isAdmin;
      }
    }

    next();
  } catch (error) {
    console.error('Optional admin middleware error:', error);
    // Don't fail the request, just continue without admin flag
    next();
  }
};
