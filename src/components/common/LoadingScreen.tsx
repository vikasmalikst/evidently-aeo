import React from 'react';
import { Spinner } from '../Onboarding/common/Spinner';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading data...', 
  className = '' 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[60vh] w-full ${className}`}>
      <Spinner size="large" message={message} />
    </div>
  );
};
