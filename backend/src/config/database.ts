import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Ensure environment variables are loaded
// This is important when this module is imported before environment.ts
dotenv.config();
// Also try loading from backend/.env specifically
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import from config to ensure validation and consistency
import { config } from './environment';

// Use environment variables from config (which validates them)
const supabaseUrl = config.supabase.url;
const supabaseServiceKey = config.supabase.serviceRoleKey;
const supabaseAnonKey = config.supabase.anonKey;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Create Supabase clients
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          customer_id: string;
          email: string;
          name: string;
          avatar_url?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          email: string;
          name: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          email?: string;
          name?: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      brands: {
        Row: {
          id: string;
          customer_id: string;
          name: string;
          website_url: string;
          description?: string;
          industry?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          name: string;
          website_url: string;
          description?: string;
          industry?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          name?: string;
          website_url?: string;
          description?: string;
          industry?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      onboarding_artifacts: {
        Row: {
          id: string;
          customer_id: string;
          brand_id: string;
          artifact_type: string;
          artifact_data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          brand_id: string;
          artifact_type: string;
          artifact_data: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          brand_id?: string;
          artifact_type?: string;
          artifact_data?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
