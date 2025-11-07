import { useState } from 'react';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { submitOnboarding, type Brand, type Competitor } from '../../api/onboardingMock';
import { CheckCircle, Sparkles } from 'lucide-react';

interface SummaryProps {
  brand: Brand;
  competitors: Competitor[];
  onComplete: () => void;
  onBack: () => void;
}

export const Summary = ({ brand, competitors, onComplete, onBack }: SummaryProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleStartAnalysis = async () => {
    setIsSubmitting(true);

    try {
      await submitOnboarding(brand, competitors);
      setShowSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-step__content">
          <div className="onboarding-success">
            <div className="onboarding-success__icon">
              <CheckCircle size={80} />
            </div>
            <h1 className="onboarding-success__title">All Set!</h1>
            <p className="onboarding-success__message">
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-step__content">
          <Spinner size="large" message="Setting up your analysis..." />
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__content">
        <div className="onboarding-summary">
          <div className="onboarding-summary__header">
            <Sparkles size={48} className="onboarding-summary__icon" />
            <h1 className="onboarding-summary__title">Ready to Launch</h1>
            <p className="onboarding-summary__subtitle">
              Review your configuration and start tracking
            </p>
          </div>

          <div className="onboarding-summary__section">
            <h2 className="onboarding-summary__section-title">Your Brand</h2>
            <div className="onboarding-summary-brand">
              <img
                src={brand.logo}
                alt={brand.companyName}
                className="onboarding-summary-brand__logo"
              />
              <div className="onboarding-summary-brand__info">
                <h3 className="onboarding-summary-brand__name">{brand.companyName}</h3>
                <p className="onboarding-summary-brand__meta">
                  {brand.industry} • {brand.headquarters}
                </p>
                <p className="onboarding-summary-brand__description">{brand.description}</p>
              </div>
            </div>
          </div>

          <div className="onboarding-summary__section">
            <h2 className="onboarding-summary__section-title">
              Tracked Competitors ({competitors.length})
            </h2>
            <div className="onboarding-summary-competitors">
              {competitors.map((competitor) => (
                <div key={competitor.domain} className="onboarding-summary-competitor">
                  <img
                    src={competitor.logo}
                    alt={competitor.name}
                    className="onboarding-summary-competitor__logo"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <span className="onboarding-summary-competitor__name">{competitor.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="onboarding-summary__preview">
            <h3 className="onboarding-summary__preview-title">What's Next?</h3>
            <ul className="onboarding-summary__preview-list">
              <li>Track visibility across 6 AI engines</li>
              <li>Analyze 50+ queries in your industry</li>
              <li>Get actionable insights in minutes</li>
              <li>Monitor competitor performance</li>
            </ul>
          </div>

          <div className="onboarding-actions">
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button onClick={handleStartAnalysis} isLoading={isSubmitting}>
              Start Analysis
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
