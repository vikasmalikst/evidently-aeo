import { IconInfoCircle } from '@tabler/icons-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export const WelcomeScreen = ({ onGetStarted }: WelcomeScreenProps) => {
  console.log('WelcomeScreen component rendering');
  return (
    <div className="onboarding-welcome-card">
      <div className="onboarding-welcome-header">
        <h2 className="onboarding-welcome-title">Welcome to EvidentlyAEO</h2>
        <p className="onboarding-welcome-subtitle">Let's set up your Answer Intelligence tracking</p>
      </div>

      <div className="onboarding-welcome-description">
        <p>
          To start measuring your brand's visibility across AI platforms, we'll guide you through three quick setup steps.
          First, you'll choose which AI models to track. Then you'll select 5–10 topics. Finally, we'll configure the search
          queries to monitor your AI presence.
        </p>
      </div>

      <div className="onboarding-steps-overview">
        <div className="onboarding-step-card">
          <div className="onboarding-step-label">1</div>
          <div className="onboarding-step-content">
            <h3>Select AI Models</h3>
            <p>Choose which AI platforms track your visibility</p>
          </div>
        </div>

        <div className="onboarding-step-card">
          <div className="onboarding-step-label">2</div>
          <div className="onboarding-step-content">
            <h3>Select Topics</h3>
            <p>Pick 8–10 topics that matter most to your brand</p>
          </div>
        </div>

        <div className="onboarding-step-card">
          <div className="onboarding-step-label">3</div>
          <div className="onboarding-step-content">
            <h3>Configure Prompts</h3>
            <p>Select the search queries for AI monitoring</p>
          </div>
        </div>
      </div>

      <button className="onboarding-welcome-button" onClick={onGetStarted}>
        let's begin
      </button>
    </div>
  );
};
