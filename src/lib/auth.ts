import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  emailVerified: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export const authService = {
  async register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Registration failed');

      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          email_verified: false,
        });

      if (profileError) throw profileError;

      return {
        success: true,
        user: {
          id: authData.user.id,
          email,
          fullName,
          emailVerified: false,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Registration failed',
      };
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Login failed');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (userError) throw userError;

      await supabase.from('user_sessions').insert({
        user_id: authData.user.id,
        login_at: new Date().toISOString(),
      });

      return {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          fullName: userData?.full_name || null,
          emailVerified: userData?.email_verified || false,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed',
      };
    }
  },

  async logout(): Promise<void> {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase
        .from('user_sessions')
        .update({ logout_at: new Date().toISOString() })
        .eq('user_id', data.user.id)
        .is('logout_at', null);
    }
    await supabase.auth.signOut();
  },

  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      return {
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password reset failed',
      };
    }
  },

  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return {
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password update failed',
      };
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      return {
        id: user.id,
        email: user.email!,
        fullName: userData?.full_name || null,
        emailVerified: userData?.email_verified || false,
      };
    } catch (error) {
      return null;
    }
  },
};
