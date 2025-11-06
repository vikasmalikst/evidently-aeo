import { useState, useEffect } from 'react';
import { Input } from './common/Input';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { verifyBrand, type Brand } from '../../api/onboardingMock';
import { Search } from 'lucide-react';

interface BrandInputProps {
  onSuccess: (brand: Brand) => void;
}

export const BrandInput = ({ onSuccess }: BrandInputProps) => {
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(input);
    }, 500);

    return () => clearTimeout(timer);
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__content">
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

        {isLoading ? (
          <div className="onboarding-loading">
            <Spinner size="large" message="Verifying brand..." />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`onboarding-form ${shake ? 'onboarding-form--shake' : ''}`}
          >
            <Input
              type="text"
              placeholder="Enter your brand name or website"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              error={error}
              autoFocus
            />
            <Button
              type="submit"
              disabled={input.length < 2}
              isLoading={isLoading}
            >
              Analyze Brand
            </Button>
          </form>
        )}

        <div className="onboarding-examples">
          <p className="onboarding-examples__label">Try examples:</p>
          <div className="onboarding-examples__list">
            {['Nike', 'Apple', 'Tesla', 'Spotify', 'Airbnb'].map((example) => (
              <button
                key={example}
                type="button"
                className="onboarding-example-chip"
                onClick={() => setInput(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
