import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from './common/Input';
import { Spinner } from './common/Spinner';
import { fetchBrandIntel } from '../../api/onboardingApi';
import type { OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';

interface BrandInputProps {
  onSuccess: (brand: OnboardingBrand, competitors: OnboardingCompetitor[]) => void;
  onAnalysisComplete?: () => void;
  input?: string;
  onInputChange?: (value: string) => void;
  isLoading?: boolean;
}

export const BrandInput = ({
  onSuccess,
  input: externalInput,
  onInputChange,
  isLoading: externalIsLoading,
  onAnalysisComplete,
}: BrandInputProps) => {
  const [input, setInput] = useState(externalInput || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [brandPreview, setBrandPreview] = useState<OnboardingBrand | null>(null);

  // Sync with external input if provided
  useEffect(() => {
    if (externalInput !== undefined) {
      setInput(externalInput);
    }
  }, [externalInput]);

  // Notify parent of input changes
  const handleInputChange = (value: string) => {
    setInput(value);
    if (onInputChange) {
      onInputChange(value);
    }

    onAnalysisComplete?.();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.length >= 2) {
        const domain = input
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/^(https?:\/\/)?(www\.)?/, '');
        const cleanDomain = domain.includes('.') ? domain.split('/')[0] : `${domain}.com`;
        setLogoUrl(`https://logo.clearbit.com/${cleanDomain}`);
      } else {
        setLogoUrl('');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [input]);

  const handleSubmit = async () => {
    if (input.trim().length < 2) {
      setError('Please enter at least 2 characters');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetchBrandIntel(input, { locale: navigator.language, country: 'US' });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Unable to resolve brand details');
      }

      const { brand, competitors } = response.data;

      setBrandPreview(brand);
      setLogoUrl(brand.logo || logoUrl);
      onSuccess(brand, competitors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify brand');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger submit when external loading is requested
  useEffect(() => {
    if (externalIsLoading && input.length >= 2 && !isLoading) {
      handleSubmit();
    }
  }, [externalIsLoading]);

  const showLoading = isLoading || externalIsLoading;

  return (
    <div className="onboarding-brand-input">
      <div className="onboarding-hero">
        <div className="onboarding-hero__icon">
          <Search size={48} />
        </div>
        <h1 className="onboarding-hero__title">Track Your Brand's AI Visibility</h1>
        <p className="onboarding-hero__subtitle">
          See how your brand appears across ChatGPT, Perplexity, Claude, and more
        </p>
      </div>

      {showLoading ? (
        <div className="onboarding-loading">
          <Spinner size="large" message="Resolving brand intelligence..." />
        </div>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className={`onboarding-form ${shake ? 'onboarding-form--shake' : ''}`}
          >
            <div className="onboarding-input-with-logo">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Brand logo"
                  className="onboarding-input-logo"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              )}
              <Input
                type="text"
                placeholder="Enter your brand name or website"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                error={error}
                autoFocus
              />
            </div>
          </form>

          {brandPreview && (
            <div
              className="onboarding-brand-header"
              style={{ margin: '24px auto 0', maxWidth: 520 }}
            >
              <img
                src={brandPreview.logo || logoUrl}
                alt={brandPreview.companyName}
                className="onboarding-brand-header__logo"
                crossOrigin="anonymous"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <div className="onboarding-brand-header__info">
                <h3 className="onboarding-brand-header__name">{brandPreview.companyName}</h3>
                <p className="onboarding-brand-header__meta">
                  {brandPreview.industry}
                  {brandPreview.headquarters ? ` • ${brandPreview.headquarters}` : ''}
                  {brandPreview.founded ? ` • Founded ${brandPreview.founded}` : ''}
                </p>
                {brandPreview.description && (
                  <p className="onboarding-brand-header__description">
                    {brandPreview.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
