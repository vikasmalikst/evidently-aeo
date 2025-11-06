import { CheckCircle } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export const WelcomeScreen = ({ onGetStarted }: WelcomeScreenProps) => {
  return (
    <div className="topic-welcome-card">
      <div className="topic-welcome-header">
        <h2 className="topic-welcome-title">Welcome to Evidently</h2>
        <p className="topic-welcome-lead">Let's configure your Answer Intelligence tracking</p>
      </div>

      <div className="topic-steps-overview">
        <div className="topic-step-item active">
          <div className="topic-step-number">1</div>
          <div className="topic-step-content">
            <h3>Select Topics</h3>
            <p>Choose 5-10 topics that matter most to your brand visibility</p>
          </div>
          <CheckCircle className="topic-step-icon" size={20} />
        </div>

        <div className="topic-step-divider"></div>

        <div className="topic-step-item">
          <div className="topic-step-number">2</div>
          <div className="topic-step-content">
            <h3>Configure Prompts</h3>
            <p>Select search queries to track your AI visibility</p>
          </div>
        </div>
      </div>

      <div className="topic-welcome-instruction">
        <p>
          Topics are crucial for generating relevant prompts and building a reliable visibility score.
          They form the foundation for all platform analytics.
        </p>
      </div>

      <button className="topic-welcome-button" onClick={onGetStarted}>
        Get Started
      </button>
    </div>
  );
};
