import { useNavigate } from 'react-router-dom';
import { OnboardingModal, type OnboardingData } from '../components/Onboarding/OnboardingModal';

export const Onboarding = () => {
  const navigate = useNavigate();

  const handleComplete = (data: OnboardingData) => {
    localStorage.setItem('onboarding_data', JSON.stringify(data));
    localStorage.setItem('onboarding_complete', 'true');
    navigate('/dashboard');
  };

  const handleClose = () => {
    navigate('/dashboard');
  };

  return (
    <OnboardingModal
      brandName="Your Brand"
      industry="Technology"
      onComplete={handleComplete}
      onClose={handleClose}
    />
  );
};
