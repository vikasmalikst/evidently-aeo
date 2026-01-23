import { Request, Response, NextFunction } from 'express';
import { customerEntitlementsService, CustomerEntitlement } from '../services/customer-entitlements.service';

/**
 * Middleware factory to enforce feature entitlements
 * @param featureName The key in CustomerEntitlement.features to check
 */
export const requireFeatureEntitlement = (featureName: keyof NonNullable<CustomerEntitlement['features']>) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            if (!user || !user.customer_id) {
                // If no user/customer (unauthenticated?), let auth middleware handle it or pass through?
                // Usually safe to assume auth middleware ran before this.
                return next();
            }

            const customerId = user.customer_id;
            const customer = await customerEntitlementsService.getCustomerEntitlements(customerId);
            const entitlements = customer?.settings?.entitlements;

            // Default to true (allowed) if features not configured, for backward compatibility
            // Only block if explicitly set to false
            const isEnabled = entitlements?.features?.[featureName] ?? true;

            if (isEnabled === false) {
                return res.status(403).json({
                    success: false,
                    error: `Access denied: Your plan does not include the '${featureName}' feature. Please upgrade your plan.`
                });
            }

            next();
        } catch (error) {
            console.error('Entitlement check failed:', error);
            // Fail open or closed? 
            // Safest to fail open if DB error to avoid outage, OR fail closed for security.
            // Failing closed (500) is probably better than leaking paid features.
            return res.status(500).json({ success: false, error: 'Failed to verify entitlements' });
        }
    };
};
