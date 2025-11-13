import { useState, useCallback, useMemo } from 'react';
import { calculateImpact, type ImpactEstimate, type PromptChanges } from '../utils/impactCalculator';
import type { CurrentConfiguration } from './usePromptConfiguration';

export function useImpactCalculation(
  currentConfig: CurrentConfiguration,
  pendingChanges: PromptChanges
) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [cachedImpact, setCachedImpact] = useState<ImpactEstimate | null>(null);
  const [lastCalculationHash, setLastCalculationHash] = useState<string>('');

  // Create a hash of the changes to detect when recalculation is needed
  const changesHash = useMemo(() => {
    return JSON.stringify({
      added: pendingChanges.added.length,
      removed: pendingChanges.removed.length,
      edited: pendingChanges.edited.length
    });
  }, [pendingChanges]);

  // Calculate impact with debouncing
  const calculateImpactEstimate = useCallback(async (): Promise<ImpactEstimate> => {
    // Check if we have a cached result for the same changes
    if (cachedImpact && lastCalculationHash === changesHash) {
      return cachedImpact;
    }

    setIsCalculating(true);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));

      const impact = calculateImpact(currentConfig, pendingChanges);
      
      setCachedImpact(impact);
      setLastCalculationHash(changesHash);
      
      return impact;
    } finally {
      setIsCalculating(false);
    }
  }, [currentConfig, pendingChanges, cachedImpact, lastCalculationHash, changesHash]);

  // Auto-calculate when changes occur
  const impact = useMemo(() => {
    if (!pendingChanges.added.length && 
        !pendingChanges.removed.length && 
        !pendingChanges.edited.length) {
      return null;
    }

    // Return cached if available and hash matches
    if (cachedImpact && lastCalculationHash === changesHash) {
      return cachedImpact;
    }

    // Otherwise calculate synchronously for immediate feedback
    return calculateImpact(currentConfig, pendingChanges);
  }, [currentConfig, pendingChanges, cachedImpact, lastCalculationHash, changesHash]);

  return {
    impact,
    isCalculating,
    calculateImpactEstimate,
    recalculate: calculateImpactEstimate
  };
}

