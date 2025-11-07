import { IconInfoCircle } from '@tabler/icons-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export const WelcomeScreen = ({ onGetStarted }: WelcomeScreenProps) => {
  console.log('WelcomeScreen component rendering');
  return (
    <div className="topic-welcome-card">
      <div className="progress-indicator">
        <div className="progress-dot active"></div>
        <div className="progress-dot"></div>
      </div>

      <div className="topic-welcome-header">
        <h2 className="topic-welcome-title">Welcome to Evidently</h2>
        <p className="topic-welcome-lead">Let's configure your Answer Intelligence tracking</p>
      </div>

      <div className="topic-welcome-description">
        <p>
          To start tracking your brand's visibility across AI platforms, we'll first help you select the topics that matter most to your business. These topics will help us generate relevant search queries and build accurate visibility metrics.
        </p>
        <p>
          In this process, you'll choose 5-10 topics from our curated suggestions or create your own custom topics. Once complete, we'll use these topics to configure the specific prompts we'll monitor across AI engines.
        </p>
      </div>

      <div className="topic-steps-overview">
        <div className="topic-step-item active">
          <div className="topic-step-number">1</div>
          <div className="topic-step-content">
            <h3>Select Topics</h3>
            <p>Choose 5-10 topics that matter most to your brand visibility</p>
          </div>
        </div>

        <div className="topic-step-item">
          <div className="topic-step-number">2</div>
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
