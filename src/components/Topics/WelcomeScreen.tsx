import { IconInfoCircle } from '@tabler/icons-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export const WelcomeScreen = ({ onGetStarted }: WelcomeScreenProps) => {
  console.log('WelcomeScreen component rendering');
  return (
    <div className="topic-welcome-card">
      <div className="progress-indicator">
        <div className="progress-step">
          <div className="progress-dot active"></div>
          <span className="progress-label">Topics</span>
        </div>
        <div className="progress-step">
          <div className="progress-dot"></div>
          <span className="progress-label">Models</span>
        </div>
        <div className="progress-step">
          <div className="progress-dot"></div>
          <span className="progress-label">Prompts</span>
        </div>
      </div>

      <div className="topic-welcome-header">
        <h2 className="topic-welcome-title">Welcome to Evidently</h2>
        <p className="topic-welcome-lead">Let's configure your Answer Intelligence tracking</p>
      </div>

      <div className="topic-welcome-description">
        <p>
          To start tracking your brand's visibility across AI platforms, we'll guide you through three simple steps to configure your monitoring.
        </p>
        <p>
          First, select which AI models to track. Then, choose 5-10 topics from our curated suggestions or create your own. Finally, we'll configure the specific prompts to monitor across AI engines.
        </p>
      </div>

      <div className="topic-steps-overview">
        <div className="topic-step-item active">
          <div className="topic-step-number">1</div>
          <div className="topic-step-content">
            <h3>Select AI Models</h3>
            <p>Choose which AI platforms to track your visibility across</p>
          </div>
        </div>

        <div className="topic-step-item">
          <div className="topic-step-number">2</div>
          <div className="topic-step-content">
            <h3>Select Topics</h3>
            <p>Choose 5-10 topics that matter most to your brand visibility</p>
          </div>
        </div>

        <div className="topic-step-item">
          <div className="topic-step-number">3</div>
          <div className="topic-step-content">
            <h3>Configure Prompts</h3>
            <p>Select search queries to track your AI visibility</p>
          </div>
        </div>
      </div>

      <div className="info-message">
        <IconInfoCircle size={20} className="icon" />
        <p>
          Topics are crucial for generating relevant prompts and building a reliable visibility score. They form the foundation for all platform analytics.
        </p>
      </div>

      <button className="topic-welcome-button" onClick={onGetStarted}>
        Next
      </button>
    </div>
  );
};
