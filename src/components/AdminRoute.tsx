import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../lib/auth';
import { featureFlags } from '../config/featureFlags';

interface AdminRouteProps {
    children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
    const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();

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

    // Show loading state
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

    // Check authentication
    if (!isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }

    // Check admin access
    // User needs EITHER:
    // 1. AL_ADMIN role (Anvaya Labs employees), OR
    // 2. accessLevel = 'admin' (customer-level admin)
    const hasAdminAccess =
        user?.role === 'AL_ADMIN' ||
        user?.accessLevel === 'admin';

    if (!hasAdminAccess) {
        // Redirect to dashboard with error message
        // TODO: Consider adding a toast notification here
        console.warn('Admin access denied for user:', user?.email, '(accessLevel:', user?.accessLevel, ', role:', user?.role, ')');
        return <Navigate to="/measure" replace />;
    }

    return <>{children}</>;
};
