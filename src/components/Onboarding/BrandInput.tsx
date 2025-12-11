import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from './common/Input';
import { Spinner } from './common/Spinner';
import { fetchBrandIntel } from '../../api/onboardingApi';
import { searchBrand } from '../../api/brandApi';
import type { OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';
import { SafeLogo } from './common/SafeLogo';

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
  const [logoDomain, setLogoDomain] = useState('');
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
        setLogoDomain(cleanDomain);
      } else {
        setLogoUrl('');
        setLogoDomain('');
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
      // First, try to find existing brand in database
      let existingBrandData = null;
      const isUrl = input.includes('.') || input.startsWith('http');
      
      try {
        const searchResult = await searchBrand({
          url: isUrl ? input : undefined,
          name: !isUrl ? input : undefined,
        });
        
        if (searchResult.success && searchResult.data) {
          existingBrandData = searchResult.data;
          console.log('✅ Found existing brand in database:', existingBrandData.name);
        }
      } catch (searchError) {
        console.log('ℹ️ Brand not found in database, proceeding with intel lookup');
      }

      // If brand exists in database, use that data
      if (existingBrandData) {
        const brandIntel: OnboardingBrand = {
          verified: true,
          companyName: existingBrandData.name,
          website: existingBrandData.homepage_url || input,
          domain: existingBrandData.homepage_url?.replace(/^https?:\/\//, '').split('/')[0] || '',
          logo: existingBrandData.metadata?.brand_logo || existingBrandData.metadata?.logo || 
                `https://logo.clearbit.com/${existingBrandData.homepage_url?.replace(/^https?:\/\//, '').split('/')[0] || existingBrandData.name.toLowerCase().replace(/\s+/g, '')}`,
          industry: existingBrandData.industry || 'General',
          headquarters: existingBrandData.headquarters || existingBrandData.metadata?.headquarters || '',
          founded: existingBrandData.founded_year || existingBrandData.metadata?.founded_year || null,
          description: existingBrandData.summary || existingBrandData.description || 
                      existingBrandData.metadata?.description || '',
          metadata: {
            ...(existingBrandData.metadata || {}),
            ceo: existingBrandData.ceo || existingBrandData.metadata?.ceo,
            headquarters: existingBrandData.headquarters || existingBrandData.metadata?.headquarters,
            founded_year: existingBrandData.founded_year || existingBrandData.metadata?.founded_year,
          }
        };

        // Format competitors from database
        const competitors: OnboardingCompetitor[] = [];
        if (existingBrandData.brand_competitors && Array.isArray(existingBrandData.brand_competitors)) {
          existingBrandData.brand_competitors.forEach((comp: any) => {
            competitors.push({
              name: comp.competitor_name,
              logo: `https://logo.clearbit.com/${(comp.competitor_url || comp.competitor_name).replace(/^https?:\/\//, '').split('/')[0]}`,
              relevance: 'Direct Competitor',
              industry: existingBrandData.industry || '',
              domain: comp.competitor_url?.replace(/^https?:\/\//, '').split('/')[0] || 
                      comp.competitor_name.toLowerCase().replace(/\s+/g, '') + '.com',
              url: comp.competitor_url || `https://${comp.competitor_name.toLowerCase().replace(/\s+/g, '')}.com`,
            });
          });
        } else if (existingBrandData.competitors && Array.isArray(existingBrandData.competitors)) {
          existingBrandData.competitors.forEach((compName: string) => {
            competitors.push({
              name: compName,
              logo: `https://logo.clearbit.com/${compName.toLowerCase().replace(/\s+/g, '')}.com`,
              relevance: 'Direct Competitor',
              industry: existingBrandData.industry || '',
              domain: compName.toLowerCase().replace(/\s+/g, '') + '.com',
              url: `https://${compName.toLowerCase().replace(/\s+/g, '')}.com`,
            });
          });
        }

        setBrandPreview(brandIntel);
        setLogoUrl(brandIntel.logo || logoUrl);
        onSuccess(brandIntel, competitors);
        setIsLoading(false);
        return;
      }

      // If brand doesn't exist, use onboarding intel service
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
          <Spinner size="large" message="Fetching your brand info ..." />
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
                <SafeLogo
                  src={logoUrl}
                  domain={logoDomain}
                  alt="Brand logo"
                  className="onboarding-input-logo"
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
              <SafeLogo
                src={brandPreview.logo || logoUrl}
                domain={brandPreview.domain || logoDomain}
                alt={brandPreview.companyName}
                className="onboarding-brand-header__logo"
              />
              <div className="onboarding-brand-header__info">
                <h3 className="onboarding-brand-header__name">{brandPreview.companyName}</h3>
                <p className="onboarding-brand-header__meta">
                  {brandPreview.industry || 'General'}
                  {brandPreview.headquarters ? ` • ${brandPreview.headquarters}` : ''}
                  {brandPreview.founded ? ` • Founded ${brandPreview.founded}` : ''}
                  {brandPreview.metadata?.ceo ? ` • CEO: ${brandPreview.metadata.ceo}` : ''}
                </p>
                {brandPreview.description ? (
                  <p className="onboarding-brand-header__description">
                    {brandPreview.description}
                  </p>
                ) : (
                  <p className="onboarding-brand-header__description" style={{ fontStyle: 'italic', color: '#64748b' }}>
                    {brandPreview.website ? `Website: ${brandPreview.website}` : 'No additional information available'}
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
