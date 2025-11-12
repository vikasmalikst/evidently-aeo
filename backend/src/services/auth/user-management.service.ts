import { supabaseAdmin } from '../../config/supabase';
import bcrypt from 'bcryptjs';

export interface CreateUserRequest {
  email: string;
  password: string;
  role: 'admin' | 'member' | 'viewer' | 'AL_ADMIN';
  full_name?: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export class UserManagementService {
  /**
   * Create a new user with hashed password
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    // Validate email domain
    if (!userData.email.endsWith('@anvayalabs.com')) {
      throw new Error('Only @anvayalabs.com email addresses are allowed');
    }

    // Validate password strength
    this.validatePassword(userData.password);

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    // Create user in auth.users table (Supabase Auth)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || '',
        role: userData.role
      }
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    if (!authUser.user) {
      throw new Error('Failed to create auth user');
    }

    // Create user in public.users table
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: userData.email,
        role: userData.role,
        full_name: userData.full_name || null,
        password: hashedPassword, // Store hashed password for our own validation
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (publicError) {
      // Clean up auth user if public user creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create public user: ${publicError.message}`);
    }

    return publicUser;
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, full_name, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return users || [];
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, full_name, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // User not found
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updateData: Partial<CreateUserRequest>): Promise<User> {
    const updateFields: any = {
      updated_at: new Date().toISOString()
    };

    if (updateData.email) {
      if (!updateData.email.endsWith('@anvayalabs.com')) {
        throw new Error('Only @anvayalabs.com email addresses are allowed');
      }
      updateFields.email = updateData.email;
    }

    if (updateData.role) {
      updateFields.role = updateData.role;
    }

    if (updateData.full_name !== undefined) {
      updateFields.full_name = updateData.full_name;
    }

    if (updateData.password) {
      this.validatePassword(updateData.password);
      const saltRounds = 12;
      updateFields.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updateFields)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return user;
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    // Delete from public.users table
    const { error: publicError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (publicError) {
      throw new Error(`Failed to delete public user: ${publicError.message}`);
    }

    // Delete from auth.users table
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      throw new Error(`Failed to delete auth user: ${authError.message}`);
    }
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (errors.length > 0) {
      throw new Error(`Password validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Verify user password
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('password')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(email: string, password: string): Promise<User | null> {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, full_name, password, created_at, updated_at')
      .eq('email', email)
      .single();

    if (error || !user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    // Remove password from returned user object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export const userManagementService = new UserManagementService();
