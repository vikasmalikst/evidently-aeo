import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../lib/auth';
import { featureFlags } from '../config/featureFlags';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // In dev bypass mode, skip auth check and set dev user immediately
    if (featureFlags.bypassAuthInDev) {
      if (isLoading) {
        const devUser = {
          id: 'dev-user-123',
          email: 'dev@evidently.ai',
          fullName: 'Dev User',
          customerId: 'dev-customer-123',
          role: 'admin',
          accessLevel: 'admin' as const, // Dev user has admin access
        };
        setUser(devUser);
      }
      return;
    }

    let isMounted = true;

    const checkAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!isMounted) return;
        setUser(user);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (isLoading) {
      checkAuth();
    }

    return () => {
      isMounted = false;
    };
  }, [isLoading, setUser, setLoading]);

  if (isLoading && !featureFlags.bypassAuthInDev) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // In dev bypass mode, always allow access
  if (featureFlags.bypassAuthInDev) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
