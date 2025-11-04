import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      const user = await authService.getCurrentUser();
      setUser(user);
      setLoading(false);
    };

    if (isLoading) {
      checkAuth();
    }
  }, [isLoading, setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
