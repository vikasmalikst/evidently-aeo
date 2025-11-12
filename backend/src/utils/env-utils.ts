/**
 * Environment Utilities
 * 
 * Centralized environment variable loading and validation
 */

import dotenv from 'dotenv';
import path from 'path';

let isLoaded = false;

/**
 * Load environment variables from .env file
 */
export function loadEnvironment(): void {
  if (isLoaded) return;
  
  // Try to load from backend/.env first, then fallback to root .env
  const envPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../../.env'),
    path.join(process.cwd(), '.env')
  ];
  
  for (const envPath of envPaths) {
    try {
      const result = dotenv.config({ path: envPath });
      if (result.parsed) {
        console.log(`✅ Loaded environment from: ${envPath}`);
        isLoaded = true;
        return;
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  console.warn('⚠️ No .env file found, using system environment variables');
  isLoaded = true;
}

/**
 * Get environment variable with optional default value
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  if (!isLoaded) {
    loadEnvironment();
  }
  
  const value = process.env[key];
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  
  return value;
}

/**
 * Get environment variable as boolean
 */
export function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = getEnvVar(key, defaultValue.toString());
  return value.toLowerCase() === 'true';
}

/**
 * Get environment variable as number
 */
export function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnvVar(key, defaultValue.toString());
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  
  return parsed;
}

/**
 * Check if all required environment variables are set
 */
export function validateRequiredEnvVars(requiredVars: string[]): void {
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
