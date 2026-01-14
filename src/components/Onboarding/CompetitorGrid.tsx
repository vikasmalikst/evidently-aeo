import { useState, useEffect, useRef } from 'react';
import { Plus, X, Users, Building2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';
import { SafeLogo } from './common/SafeLogo';

interface CompetitorGridProps {
  brand: OnboardingBrand;
  initialCompetitors?: OnboardingCompetitor[];
  onContinue: (competitors: OnboardingCompetitor[]) => void;
  onBack: () => void;
  selectedCompetitors?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  onCompetitorsLoaded?: (competitors: OnboardingCompetitor[]) => void;
}

export const CompetitorGrid = ({ 
  brand, 
  initialCompetitors = [],
  onContinue, 
  onBack,
  selectedCompetitors: externalSelected,
  onSelectionChange,
  onCompetitorsLoaded
}: CompetitorGridProps) => {
  const [competitors, setCompetitors] = useState<OnboardingCompetitor[]>(initialCompetitors);
  const [selected, setSelected] = useState<Set<string>>(externalSelected || new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const hasLoadedRef = useRef(false);

  const getCompetitorKey = (competitor: OnboardingCompetitor) =>
    (competitor.domain || competitor.name || '').toLowerCase();

  // Sync with external selection if provided
  useEffect(() => {
    if (externalSelected) {
      setSelected(
        new Set(Array.from(externalSelected).map((value) => value.toLowerCase()))
      );
    }
  }, [externalSelected]);

  useEffect(() => {
    if (hasLoadedRef.current && competitors.length > 0) {
      return;
    }

    const loadCompetitors = async () => {
      setIsLoading(true);
      try {
        if (initialCompetitors && initialCompetitors.length > 0) {
          setCompetitors(initialCompetitors);
          hasLoadedRef.current = true;
          
          if (!externalSelected || externalSelected.size === 0) {
            const autoSelect = new Set(
              initialCompetitors.slice(0, 5).map((competitor) => getCompetitorKey(competitor))
            );
            setSelected(autoSelect);
            onSelectionChange?.(autoSelect);
          }
        } else {
          if (!hasLoadedRef.current) {
             setCompetitors([]);
             onCompetitorsLoaded?.([]);
             if (!externalSelected || externalSelected.size === 0) {
               setSelected(new Set());
             }
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCompetitors();
  }, [brand, initialCompetitors]);


  const handleRemoveCompetitor = (competitor: OnboardingCompetitor, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = getCompetitorKey(competitor);
    if (!key) return;

    const updatedCompetitors = competitors.filter((c) => getCompetitorKey(c) !== key);
    setCompetitors(updatedCompetitors);
    
    if (onCompetitorsLoaded) {
      onCompetitorsLoaded(updatedCompetitors);
    }

    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
      setSelected(newSelected);
      if (onSelectionChange) {
        onSelectionChange(newSelected);
      }
    }
  };

  const handleAddCustom = () => {
    if (!customName.trim() || !customUrl.trim()) return;

    let domain = customUrl.trim().toLowerCase();
    try {
      const urlToParse = domain.startsWith('http') ? domain : `https://${domain}`;
      const urlObj = new URL(urlToParse);
      domain = urlObj.hostname;
    } catch (e) {
      // fallback to raw string
    }
    
    domain = domain.replace(/^www\./, '');

    const customCompetitor: OnboardingCompetitor = {
      name: customName,
      logo: `https://logo.clearbit.com/${domain}`,
      industry: brand.industry,
      relevance: 'Custom',
      domain,
      url: customUrl.startsWith('http') ? customUrl : `https://${customUrl}`,
      source: 'custom',
    };

    const updatedCompetitors = [customCompetitor, ...competitors];
    setCompetitors(updatedCompetitors);
    
    const key = getCompetitorKey(customCompetitor);
    const newSelected = new Set(selected);
    newSelected.add(key);
    setSelected(newSelected);
    
    onCompetitorsLoaded?.(updatedCompetitors);
    onSelectionChange?.(newSelected);

    setCustomName('');
    setCustomUrl('');
    setShowCustomForm(false);
  };

  const handleContinue = () => {
    onContinue(competitors);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 border-4 border-cyan-100 rounded-full" />
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading competitors...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Premium Card Container */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">
        
        {/* Brand Header Section */}
        <motion.div 
          className="flex flex-col md:flex-row md:items-start gap-6 mb-8 pb-8 border-b border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Brand Info */}
          <div className="flex items-start gap-4 flex-1">
            <SafeLogo
              src={brand.logo || brand.metadata?.logo || brand.metadata?.brand_logo}
              domain={brand.domain || brand.website?.replace(/^https?:\/\//, '').split('/')[0]}
              alt={brand.companyName}
              size={72}
              className="w-18 h-18 rounded-2xl shadow-lg object-contain bg-white p-2 border border-gray-100"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900">{brand.companyName}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {brand.industry || 'General'}
                {brand.headquarters ? ` • ${brand.headquarters}` : ''}
                {brand.founded ? ` • Founded ${brand.founded}` : ''}
              </p>
              {brand.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{brand.description}</p>
              )}
            </div>
          </div>

          {/* Competitor Count Badge */}
          <motion.div 
            className="flex-shrink-0 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-6 text-center border border-cyan-100"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
          >
            <div className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              {competitors.length}
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">
              Competitors
            </div>
          </motion.div>
        </motion.div>

        {/* Action Bar */}
        <motion.div 
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 text-gray-500">
            <Users size={18} />
            <span className="text-sm">Remove competitors you don't want to track (recommended: 5-7)</span>
          </div>
          <motion.button
            type="button"
            onClick={() => setShowCustomForm(!showCustomForm)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
          >
            <Plus size={18} />
            Add Custom Competitor
          </motion.button>
        </motion.div>

        {/* Custom Competitor Form */}
        <AnimatePresence>
          {showCustomForm && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Competitor Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter competitor name"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Website URL
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. example.com"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustom();
                        }
                      }}
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleAddCustom}
                    disabled={!customName.trim() || !customUrl.trim()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                  >
                    Add
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Competitor Grid */}
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence mode="popLayout">
            {competitors.map((competitor, index) => {
              const key = getCompetitorKey(competitor);
              const relevanceColor = 
                competitor.relevance === 'Direct Competitor' ? 'from-red-500 to-red-600' :
                competitor.relevance === 'Indirect Competitor' ? 'from-orange-500 to-orange-600' :
                'from-gray-500 to-gray-600';
              const borderColor = 
                competitor.relevance === 'Direct Competitor' ? 'border-red-100 hover:border-red-200' :
                competitor.relevance === 'Indirect Competitor' ? 'border-orange-100 hover:border-orange-200' :
                'border-gray-100 hover:border-gray-200';

              return (
                <motion.div
                  key={key || competitor.name}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.03 }}
                  className={`relative group bg-white rounded-2xl border-2 ${borderColor} p-4 transition-all duration-200 hover:shadow-lg`}
                >
                  {/* Remove Button */}
                  <motion.button
                    onClick={(e) => handleRemoveCompetitor(competitor, e)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-gray-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                    aria-label={`Remove ${competitor.name}`}
                  >
                    <X size={14} />
                  </motion.button>

                  {/* Logo */}
                  <div className="flex justify-center mb-3">
                    <SafeLogo
                      src={competitor.logo}
                      domain={competitor.domain}
                      alt={competitor.name}
                      size={48}
                      className="w-12 h-12 rounded-xl object-contain bg-gray-50 p-1.5 border border-gray-100"
                    />
                  </div>

                  {/* Name */}
                  <h3 className="text-sm font-semibold text-gray-900 text-center truncate">
                    {competitor.name}
                  </h3>

                  {/* Industry */}
                  <p className="text-xs text-gray-500 text-center mt-1 truncate">
                    {competitor.industry || 'General'}
                  </p>

                  {/* Relevance Badge */}
                  <div className="mt-3 flex justify-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wide bg-gradient-to-r ${relevanceColor}`}>
                      {competitor.relevance === 'Direct Competitor' ? 'Direct' : 
                       competitor.relevance === 'Indirect Competitor' ? 'Indirect' : 'Custom'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Continue Button */}
        <motion.div 
          className="mt-8 pt-6 border-t border-gray-100 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.button
            onClick={handleContinue}
            disabled={competitors.length < 3}
            whileHover={{ scale: competitors.length >= 3 ? 1.02 : 1 }}
            whileTap={{ scale: competitors.length >= 3 ? 0.98 : 1 }}
            className={`group flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
              competitors.length >= 3
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-200 hover:shadow-xl hover:shadow-cyan-300'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span>Continue</span>
            <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
          </motion.button>
          {competitors.length < 3 && (
            <div className="absolute -top-10 right-0 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm">
              Keep at least 3 competitors
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};
