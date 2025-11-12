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

    // Check if user has AL_ADMIN role
    if (user.role !== 'AL_ADMIN') {
      console.log(`Admin access denied - Invalid role: ${user.role} for user: ${user.email}`);
      res.status(403).json({
        success: false,
        error: 'Admin access required. Insufficient privileges.'
      });
      return;
    }

    // Check if user email ends with @anvayalabs.com
    if (!user.email || !user.email.endsWith('@anvayalabs.com')) {
      console.log(`Admin access denied - Invalid email domain: ${user.email}`);
      res.status(403).json({
        success: false,
        error: 'Admin access restricted to @anvayalabs.com domain'
      });
      return;
    }

    console.log(`✅ Admin access granted to: ${user.email} (${user.role})`);
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
