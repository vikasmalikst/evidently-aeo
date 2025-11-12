import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SetupModal, type SetupData } from '../components/Onboarding/SetupModal';
import { onboardingUtils } from '../utils/onboardingUtils';
import { featureFlags } from '../config/featureFlags';

export const Setup = () => {
  const navigate = useNavigate();

  // Redirect to dashboard if skip setup check is enabled
  useEffect(() => {
    if (featureFlags.skipSetupCheck) {
      console.log('🚀 Setup page: Skipping setup check - redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleComplete = (data: SetupData) => {
    onboardingUtils.setOnboardingComplete(data);
    navigate('/dashboard');
  };

  const handleClose = () => {
    navigate('/dashboard');
  };

  // Don't render setup if skip check is enabled
  if (featureFlags.skipSetupCheck) {
    return null;
  }

  return (
    <SetupModal
      brandName="Your Brand"
      industry="Technology"
      onComplete={handleComplete}
      onClose={handleClose}
    />
  );
};
