import { useState, useEffect } from 'react';
import { Input } from './common/Input';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { verifyBrand, type Brand } from '../../api/onboardingMock';
import { Search } from 'lucide-react';

interface BrandInputProps {
  onSuccess: (brand: Brand) => void;
  input?: string;
  onInputChange?: (value: string) => void;
  isLoading?: boolean;
}

export const BrandInput = ({ 
  onSuccess, 
  input: externalInput, 
  onInputChange,
  isLoading: externalIsLoading 
}: BrandInputProps) => {
  const [input, setInput] = useState(externalInput || '');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

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
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(input);
      if (input.length >= 2) {
        const domain = input.toLowerCase().replace(/\s+/g, '').replace(/^(https?:\/\/)?(www\.)?/, '');
        const cleanDomain = domain.includes('.') ? domain.split('/')[0] : `${domain}.com`;
        setLogoUrl(`https://logo.clearbit.com/${cleanDomain}`);
      } else {
        setLogoUrl('');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [input]);

  const handleSubmit = async () => {
    if (input.length < 2) {
      setError('Please enter at least 2 characters');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const brand = await verifyBrand(input);
      onSuccess(brand);
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

  return (
    <div className="onboarding-brand-input">
      <div className="onboarding-hero">
        <div className="onboarding-hero__icon">
          <Search size={48} />
        </div>
        <h1 className="onboarding-hero__title">
          Track Your Brand's AI Visibility
        </h1>
        <p className="onboarding-hero__subtitle">
          See how your brand appears across ChatGPT, Perplexity, Claude, and more
        </p>
      </div>

      {(isLoading || externalIsLoading) ? (
        <div className="onboarding-loading">
          <Spinner size="large" message="Verifying brand..." />
        </div>
      ) : (
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
      )}
    </div>
  );
};
