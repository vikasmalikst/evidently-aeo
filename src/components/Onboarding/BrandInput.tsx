import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Globe, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
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
            logo: logoUrl,
            brand_logo: logoUrl,
            ceo: existingBrandData.ceo || existingBrandData.metadata?.ceo,
            headquarters: existingBrandData.headquarters || existingBrandData.metadata?.headquarters,
            founded_year: existingBrandData.founded_year || existingBrandData.metadata?.founded_year,
          }
        };

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
  const canSubmit = input.trim().length >= 2 && url.trim().length > 0;

  return (
    <div className="w-full">
      {/* Premium Card Container */}
      <motion.div 
        className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12 ${shake ? 'animate-shake' : ''}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Hero Section */}
        <div className="text-center mb-10">
          {/* Animated Icon */}
          <motion.div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-200 mb-6"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <Search size={36} className="text-white" />
          </motion.div>

          <motion.h1 
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Track Your Brand's AI Visibility
          </motion.h1>
          
          <motion.p 
            className="text-gray-500 text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            See how your brand appears across ChatGPT, Perplexity, Claude, and more
          </motion.p>
        </div>

        {showLoading ? (
          <motion.div 
            className="py-16 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="relative">
              <div className="w-16 h-16 border-4 border-cyan-100 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-6 text-gray-600 font-medium">Analyzing your brand...</p>
            <p className="mt-2 text-sm text-gray-400">This may take a few moments</p>
          </motion.div>
        ) : (
          <>
            {/* Form */}
            <motion.form
              onSubmit={(e) => e.preventDefault()}
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {/* Brand Name & Country Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Brand Name Input */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Brand Name
                  </label>
                  <div className={`relative transition-all duration-300 ${focusedField === 'brand' ? 'scale-[1.02]' : ''}`}>
                    <input
                      type="text"
                      placeholder="Enter your brand name"
                      value={input}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => setFocusedField('brand')}
                      onBlur={() => setFocusedField(null)}
                      autoFocus
                      className={`w-full px-5 py-4 bg-gray-50 border-2 rounded-xl text-gray-900 placeholder-gray-400 
                        transition-all duration-300 outline-none
                        ${focusedField === 'brand' ? 'border-cyan-500 bg-white shadow-lg shadow-cyan-100' : 'border-gray-200 hover:border-gray-300'}
                        ${error && !input ? 'border-red-400' : ''}
                      `}
                    />
                    {logoUrl && (
                      <motion.img
                        src={logoUrl}
                        alt=""
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md object-contain bg-white shadow-sm"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>

                {/* Country Dropdown */}
                <div ref={countryDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Country
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCountryOpen(!isCountryOpen)}
                      className={`w-full px-5 py-4 bg-gray-50 border-2 rounded-xl text-left flex items-center justify-between
                        transition-all duration-300 
                        ${isCountryOpen ? 'border-cyan-500 bg-white shadow-lg shadow-cyan-100' : 'border-gray-200 hover:border-gray-300'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <CountryFlag countryCode={country} />
                        <span className="font-medium text-gray-900">{country}</span>
                      </div>
                      <ChevronDown 
                        size={18} 
                        className={`text-gray-400 transition-transform duration-300 ${isCountryOpen ? 'rotate-180' : ''}`}  
                      />
                    </button>

                    <AnimatePresence>
                      {isCountryOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto"
                        >
                          {countries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountry(c.code);
                                setIsCountryOpen(false);
                              }}
                              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left
                                ${country === c.code ? 'bg-cyan-50' : ''}
                              `}
                            >
                              <CountryFlag countryCode={c.code} />
                              <span className="font-medium text-gray-900">{c.code}</span>
                              <span className="text-gray-500 text-sm truncate">{c.name}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Website URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Globe size={14} className="inline mr-1.5 -mt-0.5" />
                  Website URL
                </label>
                <div className={`relative transition-all duration-300 ${focusedField === 'url' ? 'scale-[1.02]' : ''}`}>
                  <input
                    type="url"
                    placeholder="e.g. brand.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onFocus={() => setFocusedField('url')}
                    onBlur={() => setFocusedField(null)}
                    className={`w-full px-5 py-4 bg-gray-50 border-2 rounded-xl text-gray-900 placeholder-gray-400 
                      transition-all duration-300 outline-none
                      ${focusedField === 'url' ? 'border-cyan-500 bg-white shadow-lg shadow-cyan-100' : 'border-gray-200 hover:border-gray-300'}
                      ${error && !url ? 'border-red-400' : ''}
                    `}
                  />
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-red-500 text-sm font-medium"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.form>

            {/* Analyze Button */}
            <motion.div 
              className="mt-8 flex justify-end"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit}
                whileHover={{ scale: canSubmit ? 1.02 : 1 }}
                whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                className={`relative px-8 py-4 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300
                  ${canSubmit 
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-200 hover:shadow-xl hover:shadow-cyan-300'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {/* Shimmer effect */}
                {canSubmit && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <Sparkles size={20} />
                  Analyze Brand
                </span>
              </motion.button>
            </motion.div>

            {/* Brand Preview */}
            <AnimatePresence>
              {brandPreview && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-cyan-50/50 rounded-2xl border border-gray-100"
                >
                  <div className="flex items-start gap-4">
                    <SafeLogo
                      src={brandPreview.logo || brandPreview.metadata?.logo || brandPreview.metadata?.brand_logo}
                      domain={brandPreview.domain || brandPreview.website?.replace(/^https?:\/\//, '').split('/')[0]}
                      alt={brandPreview.companyName}
                      size={64}
                      className="w-16 h-16 rounded-xl shadow-md object-contain bg-white p-2 border border-gray-100"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">{brandPreview.companyName}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {brandPreview.industry || 'General'}
                        {brandPreview.headquarters ? ` • ${brandPreview.headquarters}` : ''}
                        {brandPreview.founded ? ` • Founded ${brandPreview.founded}` : ''}
                      </p>
                      {brandPreview.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {brandPreview.description}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
};
