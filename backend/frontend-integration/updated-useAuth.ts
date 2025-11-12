// Updated useAuth hook for the new backend
// Replace your existing useAuth.ts with this

import { useState, useEffect, useCallback } from 'react';
import { authService, User, UserProfile } from './auth-service';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthMethods {
  signInWithGoogle: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = (): AuthState & AuthMethods => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null
  });

  // Load initial auth state
  const loadAuthState = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      if (!authService.isAuthenticated()) {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          error: null
        });
        return;
      }

      const [user, profile] = await Promise.all([
        authService.getCurrentUser(),
        authService.getUserProfile()
      ]);
      
      setAuthState({
        user,
        profile,
        loading: false,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load authentication state';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, []);

  // Handle Google sign-in
  const handleSignInWithGoogle = useCallback(async (code: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const authResponse = await authService.signInWithGoogle(code);
      
      setAuthState({
        user: authResponse.user,
        profile: authResponse.profile,
        loading: false,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign-in failed';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, []);

  // Handle sign-out
  const handleSignOut = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      await authService.signOut();
      
      setAuthState({
        user: null,
        profile: null,
        loading: false,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign-out failed';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    await loadAuthState();
  }, [loadAuthState]);

  // Clear error
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Load initial state on mount
  useEffect(() => {
    loadAuthState();
  }, [loadAuthState]);

  return {
    ...authState,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    refreshUser,
    clearError
  };
};

export default useAuth;
