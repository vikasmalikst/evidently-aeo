import { Request, Response, NextFunction } from 'express';
import { AuthError, ValidationError, DatabaseError } from '../types/auth';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', error);

  // Handle known error types
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message
    });
    return;
  }

  if (error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: error.message,
      field: error.field
    });
    return;
  }

  if (error instanceof DatabaseError) {
    res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: process.env['NODE_ENV'] === 'production' 
      ? 'Internal server error' 
      : error.message
  });
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
};
