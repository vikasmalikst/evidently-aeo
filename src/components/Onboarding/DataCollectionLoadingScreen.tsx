import { useNavigate, useParams } from 'react-router-dom';
import { ProgressModal } from '../Progress/ProgressModal';

export const DataCollectionLoadingScreenRoute = () => {
  const { brandId } = useParams<{ brandId: string }>();
  if (!brandId) return <div>Invalid brand ID</div>;
  return <DataCollectionLoadingScreen brandId={brandId} />;
};

interface DataCollectionLoadingScreenProps {
  brandId: string;
}

/**
 * Fullpage onboarding route wrapper.
 * The underlying UI + polling live in `ProgressModal` (single source of truth).
 */
export const DataCollectionLoadingScreen = ({ brandId }: DataCollectionLoadingScreenProps) => {
  const navigate = useNavigate();

  const navigateToDashboardMinimized = () => {
    // Persist "in progress" and mark UI minimized (so bell is the entry point on dashboard)
    localStorage.setItem(`data_collection_in_progress_${brandId}`, 'true');
    localStorage.setItem(`data_collection_progress_ui_${brandId}`, 'minimized');
    localStorage.setItem('current_brand_id', brandId);
    navigate('/dashboard', { replace: true, state: { autoSelectBrandId: brandId, fromOnboarding: true } });
  };

  return (
    <ProgressModal
      brandId={brandId}
      mode="fullpage"
      onNavigateDashboard={navigateToDashboardMinimized}
    />
  );
};

// Hook for using loading route in onboarding flow (kept for backward compatibility)
export const useDataCollectionProgress = (brandId: string) => {
  const navigate = useNavigate();
  const startDataCollection = () => {
    navigate(`/onboarding/loading/${brandId}`, { replace: true });
  };
  return { startDataCollection };
};


