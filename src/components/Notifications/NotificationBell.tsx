import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { ProgressModal } from '../Progress/ProgressModal';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';

type BellState = {
  brandId: string | null;
  inProgress: boolean;
  completedAt: string | null;
};

const readBellState = (): BellState => {
  // Try to get brandId from multiple sources (for compatibility)
  let brandId: string | null = null;
  if (typeof window !== 'undefined') {
    brandId = localStorage.getItem('current_brand_id');
    // Fallback to manual dashboard key if current_brand_id is not set
    if (!brandId) {
      brandId = localStorage.getItem('manual-dashboard:selected-brand');
    }
  }
  
  if (!brandId) {
    return { brandId: null, inProgress: false, completedAt: null };
  }
  
  const inProgress = localStorage.getItem(`data_collection_in_progress_${brandId}`) === 'true';
  const completedAt = localStorage.getItem(`data_collection_completed_at_${brandId}`);
  return { brandId, inProgress, completedAt };
};

export const NotificationBell = () => {
  const [state, setState] = useState<BellState>(() => readBellState());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Only poll onboarding progress while actually in progress or modal is open
  const progressBrandId = state.inProgress || isModalOpen ? state.brandId : null;
  const { isComplete } = useOnboardingProgress(progressBrandId);

  // Keep state in sync with localStorage (same-tab updates don't fire `storage` events)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = readBellState();
      setState((prev) => {
        if (
          prev.brandId === next.brandId &&
          prev.inProgress === next.inProgress &&
          prev.completedAt === next.completedAt
        ) {
          return prev;
        }
        return next;
      });
    }, 750);

    const onStorage = () => setState(readBellState());
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // When progress completes, flip inProgress off and record completion timestamp if missing.
  useEffect(() => {
    if (!state.brandId) return;
    if (!state.inProgress) return;
    if (!isComplete) return;

    const storageKey = `data_collection_in_progress_${state.brandId}`;
    const completedAtKey = `data_collection_completed_at_${state.brandId}`;
    localStorage.removeItem(storageKey);
    if (!localStorage.getItem(completedAtKey)) {
      localStorage.setItem(completedAtKey, new Date().toISOString());
    }
    setState(readBellState());
  }, [state.brandId, state.inProgress, isComplete]);

  const shouldRender = useMemo(() => {
    // Show bell while active, or if we have a completion timestamp (so user can see completion message)
    // Also allow manual test mode via localStorage flag (for development/testing)
    const testMode = typeof window !== 'undefined' && localStorage.getItem('notification_bell_test_mode') === 'true';
    const shouldShow = Boolean(state.brandId && (state.inProgress || state.completedAt || testMode));
    
    // Debug logging (remove in production if needed)
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      console.debug('[NotificationBell] State check:', {
        brandId: state.brandId,
        inProgress: state.inProgress,
        completedAt: state.completedAt,
        testMode,
        shouldShow,
        currentBrandId: localStorage.getItem('current_brand_id'),
        manualDashboardKey: localStorage.getItem('manual-dashboard:selected-brand'),
        inProgressKey: state.brandId ? `data_collection_in_progress_${state.brandId}` : null,
        inProgressValue: state.brandId ? localStorage.getItem(`data_collection_in_progress_${state.brandId}`) : null
      });
    }
    
    return shouldShow;
  }, [state.brandId, state.inProgress, state.completedAt]);

  if (!shouldRender) {
    // In dev mode, show a placeholder or debug info
    if (typeof window !== 'undefined' && import.meta.env.DEV && state.brandId) {
      console.debug('[NotificationBell] Not rendering - conditions not met. Brand exists but no active progress.');
    }
    return null;
  }

  const handleClick = () => {
    if (!state.brandId) return;

    // If still collecting/scoring, open the progress modal; otherwise show completion popover.
    if (state.inProgress) {
      localStorage.setItem(`data_collection_progress_ui_${state.brandId}`, 'open');
      setIsPopoverOpen(false);
      setIsModalOpen(true);
      return;
    }
    
    // If completed (has completion timestamp), show completion message
    if (state.completedAt) {
      setIsPopoverOpen((v) => !v);
      return;
    }
    
    // Test mode: show modal even if not in progress
    const testMode = typeof window !== 'undefined' && localStorage.getItem('notification_bell_test_mode') === 'true';
    if (testMode) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    if (state.brandId) {
      localStorage.setItem(`data_collection_progress_ui_${state.brandId}`, 'minimized');
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={handleClick}
          className="relative p-2 rounded-lg hover:bg-gray-50 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-gray-700" />
          {/* Badge */}
          {state.inProgress ? (
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-[#00bcdc]" />
          ) : (
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-green-500" />
          )}
        </button>

        {isPopoverOpen && !state.inProgress && (
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Notifications</div>
            <div className="mt-2 text-sm text-gray-600">
              Data collection and scoring are complete{state.completedAt ? ` (finished ${new Date(state.completedAt).toLocaleString()})` : ''}.
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setIsPopoverOpen(false)}
                className="text-sm font-semibold text-gray-900 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && state.brandId && (
        <ProgressModal
          brandId={state.brandId}
          mode="modal"
          onClose={closeModal}
        />
      )}
    </>
  );
};


