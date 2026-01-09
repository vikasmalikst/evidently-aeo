import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from './common/Input';
import { Spinner } from './common/Spinner';
import { fetchBrandIntel } from '../../api/onboardingApi';
import { searchBrand } from '../../api/brandApi';
import { getBrightdataCountries, type BrightdataCountry } from '../../api/promptManagementApi';
import type { OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';
import { SafeLogo } from './common/SafeLogo';
import { CountryFlag } from '../CountryFlag';

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
  const [url, setUrl] = useState('');
  const [country, setCountry] = useState('US');
  const [countries, setCountries] = useState<BrightdataCountry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoDomain, setLogoDomain] = useState('');
  const [brandPreview, setBrandPreview] = useState<OnboardingBrand | null>(null);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const fetchedCountries = await getBrightdataCountries();
        setCountries(fetchedCountries);
      } catch (err) {
        console.error('Failed to fetch countries:', err);
        // Fallback to basic list if fetch fails
        setCountries([
          { code: 'US', name: 'United States' },
          { code: 'GB', name: 'United Kingdom' },
          { code: 'CA', name: 'Canada' },
          { code: 'IN', name: 'India' },
          { code: 'JP', name: 'Japan' },
          { code: 'CN', name: 'China' },
          { code: 'KR', name: 'South Korea' },
          { code: 'AU', name: 'Australia' },
          { code: 'DE', name: 'Germany' },
          { code: 'FR', name: 'France' },
        ]);
      }
    };
    loadCountries();
  }, []);

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
      setError('Please enter a valid brand name');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!url.trim()) {
      setError('Please enter a website URL');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!country) {
      setError('Please select a country');
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
          url: url || (isUrl ? input : undefined),
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
        // Build logo URL with proper fallback to brand name
        const brandDomain = existingBrandData.homepage_url?.replace(/^https?:\/\//, '').split('/')[0] || '';
        const brandNameDomain = existingBrandData.name.toLowerCase().replace(/\s+/g, '');
        const logoDomain = brandDomain || (brandNameDomain ? `${brandNameDomain}.com` : '');
        const logoUrl = existingBrandData.metadata?.brand_logo || existingBrandData.metadata?.logo || 
          (logoDomain ? `https://logo.clearbit.com/${logoDomain}` : '');

        const brandIntel: OnboardingBrand = {
          verified: true,
          companyName: existingBrandData.name,
          website: existingBrandData.homepage_url || input,
          domain: brandDomain || logoDomain,
          logo: logoUrl,
          industry: existingBrandData.industry || 'General',
          headquarters: existingBrandData.headquarters || existingBrandData.metadata?.headquarters || '',
          founded: existingBrandData.founded_year || existingBrandData.metadata?.founded_year || null,
          description: existingBrandData.summary || existingBrandData.description || 
                      existingBrandData.metadata?.description || '',
          metadata: {
            ...(existingBrandData.metadata || {}),
            logo: logoUrl, // Add logo to metadata for dashboard compatibility
            brand_logo: logoUrl, // Also add as brand_logo for compatibility
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
      const response = await fetchBrandIntel(input, { 
        locale: navigator.language, 
        country: country,
        url: url 
      });

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', alignItems: 'start' }}>
                <Input
                  type="text"
                  placeholder="Enter your brand name"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  error={error}
                  autoFocus
                  label="Brand Name"
                />

                <div className="onboarding-input-wrapper" ref={countryDropdownRef} style={{ position: 'relative' }}>
                  <label className="onboarding-input-label">Country</label>
                  <div
                    className="onboarding-input"
                    onClick={() => setIsCountryOpen(!isCountryOpen)}
                    style={{
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      paddingRight: '12px',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CountryFlag countryCode={country} />
                      <span>{country}</span>
                    </div>
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isCountryOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isCountryOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '240px',
                        overflowY: 'auto',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        marginTop: '4px',
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      {countries.length > 0 ? (
                        countries.map((c) => (
                          <div
                            key={c.code}
                            onClick={() => {
                              setCountry(c.code);
                              setIsCountryOpen(false);
                            }}
                            title={c.name}
                            style={{
                              padding: '8px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              background: country === c.code ? 'var(--bg-secondary)' : 'transparent',
                              fontSize: '14px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (country !== c.code) e.currentTarget.style.background = 'var(--bg-secondary)';
                            }}
                            onMouseLeave={(e) => {
                              if (country !== c.code) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <CountryFlag countryCode={c.code} />
                            <span style={{ fontWeight: 500, minWidth: '24px' }}>{c.code}</span>
                            <span style={{ 
                              color: '#64748b', 
                              fontSize: '12px', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}>{c.name}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>Loading...</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ marginTop: '16px' }}>
                <Input
                  type="url"
                  placeholder="e.g. brand.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  label="Website URL"
                  error={error}
                />
              </div>
            </div>
          </form>

          {brandPreview && (
            <div
              className="onboarding-brand-header"
              style={{ margin: '24px auto 0', maxWidth: 520 }}
            >
              <div className="onboarding-brand-header__info" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <SafeLogo
                  src={brandPreview.logo || brandPreview.metadata?.logo || brandPreview.metadata?.brand_logo}
                  domain={brandPreview.domain || brandPreview.website?.replace(/^https?:\/\//, '').split('/')[0]}
                  alt={brandPreview.companyName}
                  size={64}
                  className="w-16 h-16 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
                />
                <div style={{ flex: 1 }}>
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
            </div>
          )}
        </>
      )}
    </div>
  );
};
