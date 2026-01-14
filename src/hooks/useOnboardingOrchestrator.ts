
import { useEffect, useRef } from 'react';
import { useOnboardingProgress } from './useOnboardingProgress';
import { apiClient } from '../lib/apiClient';

/**
 * Orchestrates the automated onboarding flow:
 * 1. Waits for Scoring to complete.
 * 2. Triggers Domain Readiness Audit.
 * 3. Waits for Audit to complete.
 * 4. Triggers Recommendation Generation.
 */
export const useOnboardingOrchestrator = (brandId: string | null) => {
    const { data: progress } = useOnboardingProgress(brandId);

    // Use refs to prevent double-firing strict mode or rapid updates
    const hasTriggeredAudit = useRef(false);
    const hasTriggeredRecs = useRef(false);

    useEffect(() => {
        if (!brandId || !progress) return;

        const stages = progress.stages;
        if (!stages) return; // Wait for full data

        // 1. Check if we need to trigger Domain Readiness
        // Condition: Scoring is DONE, Readiness is PENDING (hasn't started/completed)
        // Note: status 'pending' in our backend logic for readiness means "ready to run" essentially, if scoring is done.
        if (
            stages.scoring.status === 'completed' &&
            stages.domain_readiness.status === 'pending' &&
            !hasTriggeredAudit.current
        ) {
            console.log('🚀 [Orchestrator] Scoring complete. Triggering Domain Readiness Audit...');
            hasTriggeredAudit.current = true;

            // Trigger Audit
            // Using correct path structure: /brands/:brandId/domain-readiness/audit
            // Note: The controller handles domain lookup internally via brandService
            apiClient.request(`/brands/${brandId}/domain-readiness/audit`, {
                method: 'POST'
            }, { requiresAuth: true })
                .catch(err => {
                    console.error('❌ [Orchestrator] Failed to trigger audit:', err);
                    hasTriggeredAudit.current = false;
                });
        }

        // 2. Check if we need to trigger Recommendations
        // Condition: Readiness is COMPLETED, Recommendations is PENDING
        if (
            stages.domain_readiness.status === 'completed' &&
            stages.recommendations.status === 'pending' &&
            !hasTriggeredRecs.current
        ) {
            console.log('🚀 [Orchestrator] Domain Readiness complete. Triggering Recommendations...');
            hasTriggeredRecs.current = true;

            // Trigger Recommendations
            apiClient.request(`/recommendations-v3/generate`, {
                method: 'POST',
                body: JSON.stringify({ brandId })
            }, { requiresAuth: true })
                .catch(err => {
                    console.error('❌ [Orchestrator] Failed to trigger recommendations:', err);
                    hasTriggeredRecs.current = false;
                });
        }

    }, [brandId, progress]);
};
