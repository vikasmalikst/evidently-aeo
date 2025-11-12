import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { JWTPayload, AuthError } from '../types/auth';

/**
 * Generate JWT token for user
 */
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  try {
    const secret = config.jwt.secret || 'fallback-secret';
    const options = {
      expiresIn: (config.jwt.expiresIn || '24h') as string,
      issuer: 'answerintel-backend',
      audience: 'answerintel-frontend'
    };
    return (jwt as any).sign(payload, secret, options);
  } catch (error) {
    throw new AuthError('Failed to generate token', 500);
  }
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'answerintel-backend',
      audience: 'answerintel-frontend'
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('Token expired', 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid token', 401);
    } else {
      throw new AuthError('Token verification failed', 401);
    }
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1] || null;
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (userId: string): string => {
  try {
    const secret = config.jwt.secret || 'fallback-secret';
    const payload = { sub: userId, type: 'refresh' };
    const options = { expiresIn: '30d' as string };
    return (jwt as any).sign(payload, secret, options);
  } catch (error) {
    throw new AuthError('Failed to generate refresh token', 500);
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): { sub: string; type: string } => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    if (decoded.type !== 'refresh') {
      throw new AuthError('Invalid token type', 401);
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('Refresh token expired', 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid refresh token', 401);
    } else {
      throw error;
    }
  }
};
