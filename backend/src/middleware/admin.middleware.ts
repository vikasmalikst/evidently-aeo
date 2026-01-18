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

    // Get user details from database to check role and email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', req.user.id)
      .single();

    if (userError || !user) {
      console.error('Admin access check - User not found:', userError);
      res.status(403).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check if user has AL_ADMIN role (Anvaya Labs employees - full access)
    const isAnvayaAdmin = user.role === 'AL_ADMIN' &&
      user.email &&
      user.email.endsWith('@anvayalabs.com');

    // Check if user's customer has admin access level
    const isCustomerAdmin = req.user.access_level === 'admin';

    // Grant access if EITHER condition is met
    if (!isAnvayaAdmin && !isCustomerAdmin) {
      console.log(`Admin access denied for user: ${user.email} (role: ${user.role}, access_level: ${req.user.access_level})`);
      res.status(403).json({
        success: false,
        error: 'Admin access required. Insufficient privileges.'
      });
      return;
    }

    if (isAnvayaAdmin) {
      console.log(`✅ Anvaya Labs admin access granted to: ${user.email} (${user.role})`);
    } else {
      console.log(`✅ Customer admin access granted to: ${user.email} (access_level: ${req.user.access_level})`);
    }
    next();
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
