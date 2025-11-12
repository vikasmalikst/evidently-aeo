import { supabaseAdmin, supabaseClient } from '../../config/database';
import { generateToken, generateRefreshToken } from '../../utils/jwt';
import { User, UserProfile, Customer, AuthResponse, DatabaseError, AuthError } from '../../types/auth';
import { v4 as uuidv4 } from 'uuid';

export interface EmailAuthRequest {
  email: string;
  password: string;
  name?: string; // For signup
}

export class EmailAuthService {
  /**
   * Register a new user with email and password using Supabase Auth
   */
  async register(request: EmailAuthRequest): Promise<AuthResponse> {
    try {
      const { email, password, name } = request;

      // Use Supabase Auth to create user
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name || 'Unknown'
          }
        }
      });

      if (authError || !authData.user) {
        throw new AuthError(`Registration failed: ${authError?.message || 'Unknown error'}`);
      }

      // Create customer first
      const customerId = uuidv4();
      const customerSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
      const { data: newCustomer, error: customerError } = await supabaseAdmin
        .from('customers')
        .insert({
          id: customerId,
          name: name || 'Unknown',
          email: email,
          slug: customerSlug
        })
        .select()
        .single();

      if (customerError || !newCustomer) {
        console.error('Customer creation error:', customerError);
        throw new DatabaseError(`Failed to create customer: ${customerError?.message || 'Unknown error'}`);
      }

      // Generate tokens using customer ID (using customer as main hierarchy)
      const accessToken = generateToken({
        sub: newCustomer.id,
        email: newCustomer.email,
        customer_id: newCustomer.id
      });

      const refreshToken = generateRefreshToken(newCustomer.id);

      // Create user object from customer (using customer as main hierarchy)
      const user: User = {
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

      // Create user profile
      const profile: UserProfile = {
        id: newCustomer.id,
        email: newCustomer.email,
        name: newCustomer.name,
        avatar_url: null,
        provider: 'email',
        customer_id: newCustomer.id
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
      console.error('Registration error:', error);
      if (error instanceof AuthError || error instanceof DatabaseError) {
        throw error;
      }
      throw new AuthError('Registration failed');
    }
  }

  /**
   * Login user with email and password using Supabase Auth
   */
  async login(request: EmailAuthRequest): Promise<AuthResponse> {
    try {
      const { email, password } = request;

      // Use Supabase Auth to sign in
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        throw new AuthError('Invalid email or password');
      }

      // Get customer directly from email (using customer as main hierarchy)
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('email', email)
        .single();

      if (customerError || !customer) {
        throw new DatabaseError('Customer not found');
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
        name: customer.name,
        avatar_url: null,
        provider: 'email',
        customer_id: customer.id
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
      console.error('Login error:', error);
      if (error instanceof AuthError || error instanceof DatabaseError) {
        throw error;
      }
      throw new AuthError('Login failed');
    }
  }
}

export const emailAuthService = new EmailAuthService();