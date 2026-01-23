import { supabaseAdmin, supabaseClient } from '../../config/database';
import { generateToken, generateRefreshToken } from '../../utils/jwt';
import {
  User,
  UserProfile,
  Customer,
  AuthRequest,
  AuthResponse,
  AuthError,
  DatabaseError
} from '../../types/auth';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  /**
   * Get current user from Supabase
   * Note: Using customer as main hierarchy - user table operations removed
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();

      if (error || !user) {
        return null;
      }

      // Get customer directly from auth user email
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (customerError || !customer) {
        // Create customer if not exists
        const newCustomer = await this.createCustomerFromAuthUser(user);
        return newCustomer;
      }

      // Return customer as user (using customer as main hierarchy)
      return {
        id: customer.id,
        customer_id: customer.id,
        email: customer.email,
        name: customer.name,
        avatar_url: null,
        role: 'admin',
        preferences: {},
        last_login_at: null,
        created_at: customer.created_at,
        updated_at: customer.updated_at
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Create customer from auth user
   */
  private async createCustomerFromAuthUser(authUser: any): Promise<User> {
    const customerId = uuidv4();
    const { data: newCustomer, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        id: customerId,
        name: (authUser.user_metadata?.full_name as string) || 'Unknown',
        email: authUser.email,
        slug: authUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
      })
      .select()
      .single();

    if (customerError || !newCustomer) {
      throw new DatabaseError('Failed to create customer');
    }

    return {
      id: newCustomer.id,
      customer_id: newCustomer.id,
      email: newCustomer.email,
      name: newCustomer.name,
      avatar_url: null,
      role: 'admin',
      preferences: {},
      last_login_at: null,
      created_at: newCustomer.created_at,
      updated_at: newCustomer.updated_at
    };
  }

  /**
   * Get user profile by ID (using customers table as main hierarchy)
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !customer) {
        return null;
      }

      return {
        id: customer.id,
        email: customer.email,
        full_name: customer.name,
        role: null,
        avatar_url: null,
        provider: 'email',
        customer_id: customer.id,
        access_level: customer.access_level || 'user', // Include access_level from customers table
        settings: customer.settings, // Include customer settings (entitlements)
        created_at: customer.created_at,
        updated_at: customer.updated_at
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Create or update user after Google OAuth
   * Note: Using customer as main hierarchy - user table operations removed
   */
  async createOrUpdateUser(authData: AuthRequest): Promise<AuthResponse> {
    try {
      // Check if customer exists
      const { data: existingCustomer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('email', authData.email)
        .single();

      let customer: Customer;

      if (existingCustomer && !customerError) {
        // Customer exists, update if needed
        customer = existingCustomer;
      } else {
        // Create new customer
        const customerId = uuidv4();
        if (!authData.email) {
          throw new DatabaseError('Email is required');
        }

        // Generate unique slug
        const baseSlug = authData.email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown';
        const randomSuffix = uuidv4().split('-')[0].substring(0, 6);
        const emailSlug = `${baseSlug}-${randomSuffix}`;

        const { data: newCustomer, error: newCustomerError } = await supabaseAdmin
          .from('customers')
          .insert({
            id: customerId,
            name: authData.name || 'Unknown',
            email: authData.email,
            slug: emailSlug
          })
          .select()
          .single();

        if (newCustomerError || !newCustomer) {
          throw new DatabaseError('Failed to create customer');
        }

        customer = newCustomer;
      }

      // Generate tokens using customer ID
      const accessToken = generateToken({
        sub: customer.id,
        email: customer.email,
        customer_id: customer.id
      });

      const refreshToken = generateRefreshToken(customer.id);

      // Create user object from customer (using customer as main hierarchy)
      const user: User = {
        id: customer.id,
        customer_id: customer.id,
        email: customer.email,
        name: customer.name,
        avatar_url: null,
        role: 'admin',
        preferences: {},
        last_login_at: null,
        created_at: customer.created_at,
        updated_at: customer.updated_at
      };

      // Create user profile
      const profile: UserProfile = {
        id: customer.id,
        email: customer.email,
        full_name: customer.name,
        role: null,
        avatar_url: null,
        provider: 'google',
        customer_id: customer.id,
        access_level: customer.access_level || 'user', // Include access_level from customers table
        settings: customer.settings // Include settings
      };

      return {
        user,
        profile,
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        }
      };
    } catch (error) {
      console.error('Error creating/updating user:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Authentication failed');
    }
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code: string): Promise<AuthResponse> {
    try {
      // Exchange code for tokens with Google
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env['GOOGLE_CLIENT_ID']!,
          client_secret: process.env['GOOGLE_CLIENT_SECRET']!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env['SITE_URL']}/auth/callback`,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        throw new AuthError('Failed to exchange code for tokens');
      }

      const tokenData = await tokenResponse.json() as {
        access_token: string;
      };

      // Get user info from Google
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new AuthError('Failed to get user info from Google');
      }

      const googleUser = await userResponse.json() as {
        email: string;
        name: string;
        picture: string;
      };

      // Create or update user
      return await this.createOrUpdateUser({
        email: googleUser.email,
        name: googleUser.name,
        avatar_url: googleUser.picture
      });
    } catch (error) {
      console.error('Error handling Google callback:', error);
      if (error instanceof AuthError || error instanceof DatabaseError) {
        throw error;
      }
      throw new AuthError('Google authentication failed');
    }
  }

  /**
   * Sign out user
   */
  async signOut(userId: string): Promise<void> {
    try {
      // In a real implementation, you might want to blacklist the token
      // For now, we'll just return success
      console.log(`User ${userId} signed out`);
    } catch (error) {
      console.error('Error signing out user:', error);
      throw new AuthError('Sign out failed');
    }
  }

  /**
   * Validate user session
   */
  async validateSession(accessToken: string): Promise<User | null> {
    try {
      // In a real implementation, you would validate the JWT token
      // For now, we'll get the user from the token payload
      const { verifyToken } = await import('../../utils/jwt');
      verifyToken(accessToken);

      return await this.getCurrentUser();
    } catch (error) {
      console.error('Error validating session:', error);
      return null;
    }
  }
}

export const authService = new AuthService();
