import { useState } from 'react';
import { Spinner } from './common/Spinner';
import { CheckCircle, Sparkles } from 'lucide-react';
import type { OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';

interface SummaryProps {
  brand: OnboardingBrand;
  competitors: OnboardingCompetitor[];
  onComplete: () => void;
  onBack: () => void;
}

export const Summary = ({ brand, competitors, onComplete, onBack }: SummaryProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleStartAnalysis = async () => {
    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 750));
      setShowSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (error) {
      console.error('Failed to progress onboarding summary:', error);
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="onboarding-summary-content">
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
    );
  }

  if (isSubmitting) {
    return (
      <div className="onboarding-summary-content">
        <Spinner size="large" message="Setting up your analysis..." />
      </div>
    );
  }

  return (
    <div className="onboarding-summary-content">
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
            {brand.logo && (
              <img
                src={brand.logo}
                alt={brand.companyName}
                className="onboarding-summary-brand__logo"
                crossOrigin="anonymous"
              />
            )}
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
              <div key={competitor.domain || competitor.name} className="onboarding-summary-competitor">
                {competitor.logo && (
                  <img
                    src={competitor.logo}
                    alt={competitor.name}
                    className="onboarding-summary-competitor__logo"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
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

        <div
          className="onboarding-summary-actions"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '32px',
          }}
        >
          <button
            type="button"
            className="onboarding-button-secondary"
            onClick={onBack}
            disabled={isSubmitting}
            style={{ minWidth: 120 }}
          >
            Back
          </button>
          <button
            type="button"
            className="onboarding-button-primary"
            onClick={handleStartAnalysis}
            disabled={isSubmitting}
            style={{ minWidth: 160 }}
          >
            Complete Onboarding
          </button>
        </div>
      </div>
    </div>
  );
};
