import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ProtectedRoute } from './ProtectedRoute';

// Feature key types matching backend entitlements
export type FeatureKey = 
  | 'measure'
  | 'analyze_topics'
  | 'analyze_keywords'
  | 'analyze_citation_sources'
  | 'analyze_queries'
  | 'analyze_answers'
  | 'analyze_domain_readiness'
  | 'recommendations'
  | 'executive_reporting';

interface EntitlementRouteProps {
  children: React.ReactNode;
  requiredFeature: FeatureKey;
  fallbackPath?: string;
}

/**
 * Route component that checks if user has access to a specific feature based on entitlements.
 * Wraps ProtectedRoute to first ensure authentication, then checks feature access.
 * 
 * @param requiredFeature - The feature key to check in user's entitlements
 * @param fallbackPath - Where to redirect if access denied (default: /measure)
 */
export const EntitlementRoute = ({ 
  children, 
  requiredFeature,
  fallbackPath = '/measure'
}: EntitlementRouteProps) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  // Check if feature is enabled in user's entitlements
  const isFeatureEnabled = () => {
    // Default to true if entitlements are missing (graceful fallback)
    // This prevents blocking users during transition period
    if (!user?.settings?.entitlements?.features) {
      return true;
    }

    const features = user.settings.entitlements.features;
    
    // Check if the specific feature is enabled
    // Default to true if feature key doesn't exist (new features should be accessible)
    return features[requiredFeature] !== false;
  };

  // The actual access check happens inside ProtectedRoute's children
  // We need this to be inside ProtectedRoute so user is loaded first
  const AccessCheck = () => {
    const hasAccess = isFeatureEnabled();

    if (!hasAccess) {
      console.warn(
        `[EntitlementRoute] Access denied to "${requiredFeature}" for user:`,
        user?.email,
        '| Redirecting to:',
        fallbackPath
      );

      // Redirect to fallback with state to show upgrade message
      return (
        <Navigate 
          to={fallbackPath} 
          replace 
          state={{ 
            accessDenied: true,
            deniedFeature: requiredFeature,
            attemptedPath: location.pathname
          }} 
        />
      );
    }

    return <>{children}</>;
  };

  return (
    <ProtectedRoute>
      <AccessCheck />
    </ProtectedRoute>
  );
};

/**
 * Maps route paths to their required feature entitlements.
 * Used for automatic entitlement checking in routes.
 */
export const routeToFeatureMap: Record<string, FeatureKey> = {
  // Measure
  '/measure': 'measure',
  
  // Analyze
  '/analyze/citation-sources': 'analyze_citation_sources',
  '/analyze/topics': 'analyze_topics',
  '/analyze/queries': 'analyze_queries',
  '/analyze/queries-answers': 'analyze_answers',
  '/analyze/keywords': 'analyze_keywords',
  '/analyze/keywords-graph': 'analyze_keywords',
  '/analyze/domain-readiness': 'analyze_domain_readiness',
  
  // Improve (all use recommendations entitlement)
  '/improve/discover': 'recommendations',
  '/improve/action-plan': 'recommendations',
  '/improve/execute': 'recommendations',
  '/improve/impact': 'recommendations',
  
  // Executive Reporting
  '/executive-reporting': 'executive_reporting',
};

/**
 * Helper to get the feature key for a given path.
 */
export const getFeatureForPath = (path: string): FeatureKey | null => {
  // Direct match
  if (routeToFeatureMap[path]) {
    return routeToFeatureMap[path];
  }
  
  // Partial match for nested routes
  for (const [route, feature] of Object.entries(routeToFeatureMap)) {
    if (path.startsWith(route)) {
      return feature;
    }
  }
  
  return null;
};
