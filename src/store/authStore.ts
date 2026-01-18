import { create } from 'zustand';
import { AuthUser, authService } from '../lib/auth';
import { featureFlags } from '../config/featureFlags';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

// Create a dev user for bypassing authentication
const createDevUser = (): AuthUser => ({
  id: 'dev-user-123',
  email: 'dev@evidently.ai',
  fullName: 'Dev User',
  customerId: 'dev-customer-123',
  role: 'admin',
  accessLevel: 'admin', // Dev user has admin access for testing
});

const getInitialUser = (): AuthUser | null => {
  // If bypass auth is enabled in dev, return dev user
  if (featureFlags.bypassAuthInDev) {
    console.log('🔓 Dev mode: Bypassing authentication with dev user');
    const devUser = createDevUser();
    // Persist dev user so it survives page refreshes
    if (!authService.getStoredUser()) {
      localStorage.setItem('auth.user', JSON.stringify(devUser));
    }
    return devUser;
  }

  return authService.getStoredUser();
};

const storedUser = getInitialUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  isAuthenticated: !!storedUser,
  isLoading: true,
  setUser: (user) => {
    // In dev bypass mode, always keep user authenticated
    if (featureFlags.bypassAuthInDev && !user) {
      const devUser = createDevUser();
      set({ user: devUser, isAuthenticated: true, isLoading: false });
      return;
    }
    set({ user, isAuthenticated: !!user, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    // In dev bypass mode, don't actually logout, just refresh the dev user
    if (featureFlags.bypassAuthInDev) {
      console.log('🔓 Dev mode: Logout bypassed, maintaining dev user');
      const devUser = createDevUser();
      set({ user: devUser, isAuthenticated: true });
      return;
    }
    set({ user: null, isAuthenticated: false });
  },
}));
