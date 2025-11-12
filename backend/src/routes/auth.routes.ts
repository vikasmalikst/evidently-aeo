import { Router, Request, Response } from 'express';
import { authService } from '../services/auth/auth.service';
import { emailAuthService, EmailAuthRequest } from '../services/auth/email-auth.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { AuthRequest, ApiResponse } from '../types/auth';

const router = Router();

/**
 * POST /auth/google/callback
 * Handle Google OAuth callback
 */
router.post('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
      return;
    }

    const authResponse = await authService.handleGoogleCallback(code);

    res.json({
      success: true,
      data: authResponse
    });

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
});

/**
 * POST /auth/register
 * Register a new user with email and password
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
      return;
    }

    const authResponse = await emailAuthService.register({
      email,
      password,
      name
    });

    res.json({
      success: true,
      data: authResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
});

/**
 * POST /auth/login
 * Login user with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
      return;
    }

    const authResponse = await emailAuthService.login({
      email,
      password
    });

    res.json({
      success: true,
      data: authResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    });
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    // User is already available from the authenticateToken middleware
    const user = req.user;
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Get the full user profile from database
    const profile = await authService.getUserProfile(user.id);
    
    if (!profile) {
      res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * POST /auth/google
 * Handle Google OAuth authentication
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
      return;
    }

    const authResponse = await authService.handleGoogleCallback(code);
    
    res.json({
      success: true,
      data: authResponse
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Google authentication failed'
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
      return;
    }

    // Import JWT utilities
    const { verifyRefreshToken, generateToken } = await import('../utils/jwt');
    
    // Verify the refresh token
    const payload = verifyRefreshToken(refresh_token);
    
    // Get user from database
    const user = await authService.getUserProfile(payload.sub);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token or user not found'
      });
      return;
    }

    // Generate new access token
    const newAccessToken = generateToken({
      sub: user.id,
      email: user.email,
      customer_id: user.customer_id
    });

    res.json({
      success: true,
      data: {
        access_token: newAccessToken,
        refresh_token: refresh_token, // Keep the same refresh token
        expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

/**
 * POST /auth/signout
 * Sign out user
 */
router.post('/signout', authenticateToken, async (req: Request, res: Response) => {
  try {
    await authService.signOut(req.user!.id);
    
    res.json({
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({
      success: false,
      error: 'Sign out failed'
    });
  }
});

/**
 * GET /auth/health
 * Health check for auth service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Auth service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
