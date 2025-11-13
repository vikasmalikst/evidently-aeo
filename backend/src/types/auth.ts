import { User as SupabaseUser } from '@supabase/supabase-js';

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  customer_id: string;
  role?: string;
  preferences?: Record<string, any>;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  avatar_url?: string | null;
  provider: string;
  customer_id: string | null;
  preferences?: Record<string, any> | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// Customer types
export interface Customer {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// Brand types
export interface Brand {
  id: string;
  customer_id: string;
  name: string;
  website_url: string;
  description?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

// Authentication request/response types
export interface AuthRequest {
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  user: User;
  profile: UserProfile;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface BrandOnboardingRequest {
  brand_name: string;
  website_url: string;
  description?: string;
  industry?: string;
  competitors?: Array<
    string | {
      name?: string;
      domain?: string;
      url?: string;
      relevance?: string;
      industry?: string;
      logo?: string;
      source?: string;
    }
  >;
  keywords?: string[];
  aeo_topics?: Array<{
    label: string;
    weight: number;
  }>;
  ai_models?: string[]; // Selected AI models (chatgpt, perplexity, gemini, etc.)
  metadata?: Record<string, any>; // Additional metadata
}

export interface BrandOnboardingResponse {
  brand: Brand;
  artifact_id: string;
  message: string;
}

// JWT payload
export interface JWTPayload {
  sub: string; // user id
  email: string;
  customer_id: string;
  iat: number;
  exp: number;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Error types
export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}
