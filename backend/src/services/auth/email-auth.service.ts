import { supabaseAdmin, supabaseClient } from '../../config/database';
import { generateToken, generateRefreshToken } from '../../utils/jwt';
import { User, UserProfile, Customer, AuthResponse, DatabaseError, AuthError } from '../../types/auth';
import { v4 as uuidv4 } from 'uuid';
import { otpService } from './otp.service';
import { emailService } from '../email/email.service';

export interface EmailAuthRequest {
  email: string;
  password: string;
  name?: string; // For signup
  otp?: string; // For signup verification
}

export class EmailAuthService {
  private isPublicEmailDomain(email: string): boolean {
    const publicDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'aol.com', 'icloud.com', 'protonmail.com', 'zoho.com',
      'yandex.com', 'mail.com', 'gmx.com', 'live.com', 'msn.com',
      'me.com', 'mac.com', 'inbox.com', 'fastmail.com'
    ];
    const domain = email.split('@')[1]?.toLowerCase();
    return publicDomains.includes(domain);
  }

  /**
   * Send OTP for signup verification
   */
  async sendSignupOTP(email: string): Promise<void> {
    // 1. Check domain
    if (this.isPublicEmailDomain(email)) {
      throw new AuthError('Please use your corporate email address. Public email domains are not allowed.');
    }

    // 2. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new AuthError('User with this email already exists');
    }

    // 3. Generate and send OTP
    const otp = await otpService.createOTP(email);
    const sent = await emailService.sendOTP(email, otp, 'signup');

    if (!sent) {
      throw new AuthError('Failed to send verification email. Please try again.');
    }
  }

  /**
   * Register a new user with email and password using Supabase Auth
   */
  async register(request: EmailAuthRequest): Promise<AuthResponse> {
    try {
      const { email, password, name, otp } = request;

      if (this.isPublicEmailDomain(email)) {
        throw new AuthError('Please use your corporate email address. Public email domains are not allowed.');
      }

      // Verify OTP if provided (enforcing OTP flow)
      if (!otp) {
        throw new AuthError('Verification code is required');
      }

      if (!otpService.consumeOTP(email, otp)) {
        throw new AuthError('Invalid or expired verification code');
      }

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
      // Generate a unique slug by appending a random string to the email prefix
      // This prevents "duplicate key value violates unique constraint" errors for users with same email prefix
      const baseSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
      const randomSuffix = uuidv4().split('-')[0].substring(0, 6); // 6 char random hex
      const customerSlug = `${baseSlug}-${randomSuffix}`;

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

        // Handle specific database errors
        if (customerError?.code === '23505') { // unique_violation
          if (customerError.message?.includes('customers_slug_key')) {
            throw new DatabaseError('Unable to create account handle. Please try again.');
          }
          if (customerError.message?.includes('customers_email_key')) {
            throw new AuthError('User with this email already exists');
          }
        }

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
        full_name: newCustomer.name,
        role: null,
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
      console.log('Login attempt for:', email);

      // Use Supabase Auth to sign in
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        console.error('Supabase login error:', authError?.message);
        throw new AuthError('Invalid email or password');
      }

      console.log('Supabase login success for:', email);

      // Get customer directly from email (using customer as main hierarchy)
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('email', email)
        .single();

      if (customerError || !customer) {
        console.error('Customer lookup error:', {
          email,
          error: customerError,
          errorCode: customerError?.code,
          errorMessage: customerError?.message,
          errorDetails: customerError?.details,
          errorHint: customerError?.hint
        });

        // Check if this is an authentication error (invalid service role key)
        if (customerError?.message?.includes('Invalid authentication credentials') ||
          customerError?.message?.includes('JWT') ||
          customerError?.code === 'PGRST301') {
          console.error('❌ CRITICAL: Supabase authentication failed!');
          console.error('   This usually means:');
          console.error('   1. SUPABASE_SERVICE_ROLE_KEY is incorrect');
          console.error('   2. SUPABASE_URL is incorrect');
          console.error('   3. The service role key and URL are from different projects');
          throw new DatabaseError('Supabase authentication failed. Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
        }

        // If customer doesn't exist but user authenticated, create customer record
        if (customerError?.code === 'PGRST116') {
          // PGRST116 = no rows returned
          console.log(`Customer record not found for ${email}, creating one...`);

          const customerId = uuidv4();
          // Generate unique slug
          const baseSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
          const randomSuffix = uuidv4().split('-')[0].substring(0, 6);
          const customerSlug = `${baseSlug}-${randomSuffix}`;

          const { data: newCustomer, error: createError } = await supabaseAdmin
            .from('customers')
            .insert({
              id: customerId,
              name: authData.user.user_metadata?.full_name || email.split('@')[0],
              email: email,
              slug: customerSlug
            })
            .select()
            .single();

          if (createError || !newCustomer) {
            console.error('Failed to create customer record:', createError);
            throw new DatabaseError(`Customer not found and could not be created: ${createError?.message || 'Unknown error'}`);
          }

          // Use the newly created customer
          const customer = newCustomer;

          // Continue with login using new customer
          const accessToken = generateToken({
            sub: customer.id,
            email: customer.email,
            customer_id: customer.id
          });

          const refreshToken = generateRefreshToken(customer.id);

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

          const profile: UserProfile = {
            id: customer.id,
            email: customer.email,
            full_name: customer.name,
            role: null,
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
              expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000)
            }
          };
        }

        throw new DatabaseError(`Customer not found: ${customerError?.message || 'Unknown error'}`);
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
  async resetPassword(email: string, newPassword: string): Promise<void> {
    try {
      // 1. Find the user by email in Supabase Auth
      // We need to paginate through all users since listUsers() has a default limit of 50
      let user: any = null;
      let page = 1;
      const perPage = 100;

      while (!user) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage
        });

        if (listError) {
          throw new AuthError(`Failed to list users: ${listError.message}`);
        }

        // If no more users, break
        if (!users || users.length === 0) {
          break;
        }

        // Find user in this page
        user = (users as any[]).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

        // If we found the user or this page had fewer users than perPage (last page), break
        if (user || users.length < perPage) {
          break;
        }

        page++;
      }

      if (!user) {
        console.error(`Password reset: User not found for email: ${email}`);
        throw new AuthError('User not found');
      }

      console.log(`Password reset: Found user ${user.id} for email ${email}`);

      // 2. Update the user's password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        throw new AuthError(`Failed to update password: ${updateError.message}`);
      }

      console.log(`Password reset: Successfully updated password for user ${user.id}`);

    } catch (error) {
      console.error('Password reset error:', error);
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Password reset failed');
    }
  }
}

export const emailAuthService = new EmailAuthService();