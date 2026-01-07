import { Router, Request, Response } from 'express';
import { authService } from '../services/auth/auth.service';
import { emailAuthService, EmailAuthRequest } from '../services/auth/email-auth.service';
import { emailService } from '../services/email/email.service';
import { otpService } from '../services/auth/otp.service';
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

/**
 * POST /auth/forgot-password
 * Initiate password reset: check email and send OTP
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    // Generate and store OTP
    const otp = await otpService.createOTP(email);

    // Send OTP via email
    const sent = await emailService.sendOTP(email, otp);

    if (!sent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send OTP email'
      });
      return;
    }

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process request'
    });
  }
});

/**
 * POST /auth/verify-otp
 * Verify OTP code
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        error: 'Email and OTP are required'
      });
      return;
    }

    const isValid = otpService.verifyOTP(email, otp);

    if (!isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired OTP'
      });
      return;
    }

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    });
  }
});

/**
 * POST /auth/reset-password
 * Reset password with valid OTP
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      res.status(400).json({
        success: false,
        error: 'Email, OTP, and password are required'
      });
      return;
    }

    // Verify OTP again (consume it)
    const consumed = otpService.consumeOTP(email, otp);

    if (!consumed) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired OTP'
      });
      return;
    }

    // Reset password in Supabase
    await emailAuthService.resetPassword(email, password);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Password reset failed'
    });
  }
});

export default router;
