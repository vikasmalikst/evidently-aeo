import { apiClient } from './apiClient';

const USER_STORAGE_KEY = 'auth.user';

interface BackendAuthSuccess {
  user: {
    id: string;
    email: string;
    name?: string | null;
    customer_id?: string | null;
    role?: string | null;
  };
  profile: {
    id: string;
    email: string;
    name?: string | null;
    full_name?: string | null;
    customer_id?: string | null;
    role?: string | null;
    access_level?: string | null; // Customer access level from backend
    settings?: Record<string, any> | null; // Customer settings including entitlements
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

interface BackendResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  customerId: string | null;
  role?: string | null;
  accessLevel?: 'user' | 'admin' | null; // Customer access level for admin portal access
  settings?: Record<string, any> | null; // Customer settings including entitlements
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

const persistUser = (user: AuthUser | null) => {
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

const loadUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

const mapUser = (payload: BackendAuthSuccess): AuthUser => {
  const name = payload.profile.full_name ?? payload.profile.name ?? payload.user.name ?? null;
  const accessLevel = payload.profile.access_level ?? null;
  return {
    id: payload.user.id,
    email: payload.user.email,
    fullName: name,
    customerId: payload.profile.customer_id ?? payload.user.customer_id ?? null,
    role: payload.profile.role ?? payload.user.role ?? null,
    accessLevel: accessLevel as 'user' | 'admin' | null,
    settings: payload.profile.settings ?? null
  };
};

const handleAuthSuccess = (payload: BackendAuthSuccess): AuthResponse => {
  apiClient.setAuthTokens(
    payload.session.access_token,
    payload.session.refresh_token,
    payload.session.expires_at
  );

  const user = mapUser(payload);
  persistUser(user);

  return {
    success: true,
    user,
  };
};

export const authService = {
  getStoredUser(): AuthUser | null {
    return loadUser();
  },

  async sendSignupOTP(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.request<BackendResponse<any>>('/auth/signup-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }, { requiresAuth: false });

      if (response.success) {
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async register(email: string, password: string, fullName: string, otp: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.request<BackendResponse<BackendAuthSuccess>>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name: fullName, otp }),
      }, { requiresAuth: false });

      if (response.success && response.data) {
        return handleAuthSuccess(response.data);
      }

      return {
        success: false,
        error: response.error || 'Registration failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.request<BackendResponse<BackendAuthSuccess>>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
        { requiresAuth: false }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || 'Login failed');
      }

      return handleAuthSuccess(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return {
        success: false,
        error: message,
      };
    }
  },

  async loginWithGoogle(code: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.request<BackendResponse<BackendAuthSuccess>>(
        '/auth/google',
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        },
        { requiresAuth: false }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || 'Google authentication failed');
      }

      return handleAuthSuccess(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google authentication failed';
      return {
        success: false,
        error: message,
      };
    }
  },

  async logout(): Promise<void> {
    try {
      await apiClient.request<BackendResponse<{ message: string }>>(
        '/auth/signout',
        { method: 'POST' },
        { requiresAuth: true }
      );
    } catch (error) {
      console.warn('Failed to notify backend about logout:', error);
    } finally {
      // Clear API cache to prevent cross-customer data leakage
      const { clearApiCache } = await import('./apiCache');
      clearApiCache();

      // Clear onboarding state
      localStorage.removeItem('onboarding_complete');
      localStorage.removeItem('onboarding_data');
      localStorage.removeItem('onboarding_topics');
      localStorage.removeItem('onboarding_prompts');
      localStorage.removeItem('onboarding_brand');

      apiClient.clearAuthTokens();
      persistUser(null);
    }
  },

  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.request<BackendResponse<any>>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }, { requiresAuth: false });

      if (response.success) {
        return { success: true };
      }
      return { success: false, error: response.error || response.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send reset email' };
    }
  },

  async verifyOTP(email: string, otp: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.request<BackendResponse<any>>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      }, { requiresAuth: false });

      if (response.success) {
        return { success: true };
      }
      return { success: false, error: response.error || response.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Verification failed' };
    }
  },

  async confirmPasswordReset(email: string, otp: string, password: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.request<BackendResponse<any>>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp, password }),
      }, { requiresAuth: false });

      if (response.success) {
        return { success: true };
      }
      return { success: false, error: response.error || response.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Password reset failed' };
    }
  },

  async updatePassword(_newPassword: string): Promise<AuthResponse> {
    return {
      success: false,
      error: 'Password update is not yet available in the new backend.',
    };
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const accessToken = apiClient.getAccessToken();
    const refreshToken = apiClient.getRefreshToken();

    if (!accessToken && !refreshToken) {
      persistUser(null);
      return null;
    }

    try {
      const response = await apiClient.request<BackendResponse<any>>('/auth/me');
      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || 'Failed to fetch user');
      }

      const payload: BackendAuthSuccess = {
        user: {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name ?? response.data.full_name ?? null,
          customer_id: response.data.customer_id ?? null,
          role: response.data.role ?? null,
        },
        profile: response.data,
        session: {
          access_token: apiClient.getAccessToken() || '',
          refresh_token: apiClient.getRefreshToken() || '',
          expires_at: apiClient.getTokenExpiry() || Date.now(),
        },
      };

      const user = mapUser(payload);
      persistUser(user);
      return user;
    } catch (error) {
      console.warn('Failed to restore authenticated user:', error);

      // Only clear tokens if it's an actual authentication error (401)
      // Don't clear on network errors or other issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthError = errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('Token expired') ||
        errorMessage.includes('Invalid token') ||
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Access token required');

      if (isAuthError) {
        apiClient.clearAuthTokens();
        persistUser(null);
      }

      return null;
    }
  },
};

