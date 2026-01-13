import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Sparkles, Edit2, Save, X, Rocket, Target, TrendingUp, BarChart3 } from 'lucide-react';
import { SafeLogo } from './common/SafeLogo';
import { fetchBrandProductsPreview } from '../../api/onboardingApi';
import type { BrandProductsEnrichment, OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';

interface SummaryProps {
  brand: OnboardingBrand;
  competitors: OnboardingCompetitor[];
  onComplete: () => void;
  onBack: () => void;
  onUpdateBrand?: (brand: OnboardingBrand) => void;
}

export const Summary = ({ brand, competitors, onComplete, onBack, onUpdateBrand }: SummaryProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [enrichment, setEnrichment] = useState<BrandProductsEnrichment | null>(null);
  const [editedEnrichment, setEditedEnrichment] = useState<BrandProductsEnrichment | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  // Brand editing state
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [editIndustry, setEditIndustry] = useState('');
  const [editWebsite, setEditWebsite] = useState('');

  // Draft text state
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [draftBrandSynonyms, setDraftBrandSynonyms] = useState('');
  const [draftBrandProducts, setDraftBrandProducts] = useState('');
  const [draftCompetitorSynonyms, setDraftCompetitorSynonyms] = useState<Record<string, string>>({});
  const [draftCompetitorProducts, setDraftCompetitorProducts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditingBrand) {
      setEditIndustry(brand.industry || '');
      setEditWebsite(brand.domain || '');
    }
  }, [isEditingBrand, brand]);

  const handleCancelEdit = () => setIsEditingBrand(false);

  const handleSaveBrandDetails = () => {
    if (onUpdateBrand) {
      onUpdateBrand({
        ...brand,
        industry: editIndustry,
        domain: editWebsite,
        website: editWebsite.startsWith('http') ? editWebsite : `https://${editWebsite}`,
      });
    }
    setIsEditingBrand(false);
  };

  const sanitizeListForSave = (items: string[]): string[] =>
    items.map((s) => s.trim()).filter(Boolean);

  const parseCommaListForSave = (value: string): string[] =>
    sanitizeListForSave(value.split(','));

  useEffect(() => {
    if (enrichment && !editedEnrichment) {
      setEditedEnrichment(enrichment);
    }
  }, [enrichment, editedEnrichment]);

  useEffect(() => {
    if (!editedEnrichment || draftInitialized) return;

    setDraftBrandSynonyms((editedEnrichment.brand?.synonyms || []).join(', '));
    setDraftBrandProducts((editedEnrichment.brand?.products || []).join(', '));

    const compSyn: Record<string, string> = {};
    const compProd: Record<string, string> = {};
    Object.entries(editedEnrichment.competitors || {}).forEach(([name, data]) => {
      compSyn[name] = (data?.synonyms || []).join(', ');
      compProd[name] = (data?.products || []).join(', ');
    });
    setDraftCompetitorSynonyms(compSyn);
    setDraftCompetitorProducts(compProd);
    setDraftInitialized(true);
  }, [editedEnrichment, draftInitialized]);

  const competitorNames = useMemo(
    () => competitors.map((c) => c.name).filter(Boolean),
    [competitors]
  );

  const previewCacheKey = 'onboarding_brand_products_preview';

  const handleGenerate = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLoadingMessage('Generating products and synonyms...');
    setEnrichmentError(null);

    try {
      const response = await fetchBrandProductsPreview({
        brand_name: brand.companyName,
        industry: brand.industry,
        competitors: competitorNames.map((name) => ({ name })),
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate products and synonyms');
      }

      setEnrichment(response.data);
      setDraftInitialized(false);
      localStorage.setItem(
        previewCacheKey,
        JSON.stringify({
          brandName: brand.companyName,
          industry: brand.industry,
          competitors: competitorNames,
          enrichment: response.data,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate products and synonyms';
      setEnrichmentError(message);
      
      const emptyEnrichment: BrandProductsEnrichment = {
        brand: { synonyms: [], products: [] },
        competitors: Object.fromEntries(
          competitorNames.map((name) => [name, { synonyms: [], products: [] }])
        ),
      };
      setEnrichment(emptyEnrichment);
      setEditedEnrichment(emptyEnrichment);
      setDraftInitialized(false);
    } finally {
      setIsSubmitting(false);
      setLoadingMessage(null);
    }
  };

  const handleApproveAndContinue = async () => {
    if (!editedEnrichment || isSubmitting) return;
    setIsSubmitting(true);
    setLoadingMessage('Saving your approval...');
    try {
      const cleaned: BrandProductsEnrichment = {
        ...editedEnrichment,
        brand: {
          ...editedEnrichment.brand,
          synonyms: parseCommaListForSave(draftBrandSynonyms),
          products: parseCommaListForSave(draftBrandProducts),
        },
        competitors: Object.fromEntries(
          competitorNames.map((name) => [
            name,
            {
              synonyms: parseCommaListForSave(draftCompetitorSynonyms[name] || ''),
              products: parseCommaListForSave(draftCompetitorProducts[name] || ''),
            },
          ])
        ),
      };

      localStorage.setItem('onboarding_brand_products', JSON.stringify(cleaned));
      localStorage.setItem('onboarding_brand_products_approved', 'true');

      setShowSuccess(true);
      setTimeout(() => onComplete(), 800);
    } catch (error) {
      console.error('Failed to finalize onboarding:', error);
      onComplete();
    } finally {
      setIsSubmitting(false);
      setLoadingMessage(null);
    }
  };

  useEffect(() => {
    if (enrichment || isSubmitting) return;
    try {
      const cached = localStorage.getItem(previewCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const sameBrand = parsed.brandName === brand.companyName;
        const sameCompetitors =
          Array.isArray(parsed.competitors) &&
          parsed.competitors.length === competitorNames.length &&
          parsed.competitors.every((name: string, idx: number) => name === competitorNames[idx]);

        if (sameBrand && sameCompetitors && parsed.enrichment) {
          setEnrichment(parsed.enrichment);
          return;
        }
      }
    } catch (_e) {
      localStorage.removeItem(previewCacheKey);
    }

    handleGenerate();
  }, [brand.companyName, competitorNames.join('|')]);

  const rows = useMemo(() => {
    const brandRow = {
      name: brand.companyName,
      type: 'Brand' as const,
      logo: brand.logo,
      domain: brand.domain,
      synonymsText: draftBrandSynonyms,
      productsText: draftBrandProducts,
    };

    const competitorRows = competitors.map((comp) => ({
      name: comp.name,
      type: 'Competitor' as const,
      logo: comp.logo || '',
      domain: comp.domain || '',
      synonymsText: draftCompetitorSynonyms[comp.name] || '',
      productsText: draftCompetitorProducts[comp.name] || '',
    }));

    return [brandRow, ...competitorRows];
  }, [brand, competitors, draftBrandSynonyms, draftBrandProducts, draftCompetitorSynonyms, draftCompetitorProducts]);

  // Success State
  if (showSuccess) {
    return (
      <motion.div 
        className="w-full flex items-center justify-center py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div 
          className="text-center"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
            transition={{ delay: 0.2 }}
          >
            <CheckCircle size={48} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Set!</h1>
          <p className="text-gray-500">Redirecting to the next step...</p>
        </motion.div>
      </motion.div>
    );
  }

  // Loading State
  if (isSubmitting) {
    return (
      <motion.div 
        className="w-full flex items-center justify-center py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 border-4 border-cyan-100 rounded-full" />
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">{loadingMessage || 'Working...'}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Main Card */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">
        
        {/* Header */}
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-200 mb-4"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            <Sparkles size={32} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ready to Launch</h1>
          <p className="text-gray-500">Review and refine your brand and competitor products</p>
        </motion.div>

        {/* Brand Info Card */}
        <motion.div 
          className="bg-gradient-to-r from-gray-50 to-cyan-50/30 rounded-2xl p-6 mb-8 border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-gray-900">Brand Information</h3>
            {!isEditingBrand && onUpdateBrand && (
              <button
                onClick={() => setIsEditingBrand(true)}
                className="flex items-center gap-1.5 text-cyan-600 hover:text-cyan-700 text-sm font-medium transition-colors"
              >
                <Edit2 size={14} />
                Edit
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {isEditingBrand ? (
              <motion.div 
                key="edit"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                    <input
                      type="text"
                      value={editIndustry}
                      onChange={(e) => setEditIndustry(e.target.value)}
                      placeholder="e.g. SaaS, E-commerce"
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="text"
                      value={editWebsite}
                      onChange={(e) => setEditWebsite(e.target.value)}
                      placeholder="e.g. brand.com"
                      className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBrandDetails}
                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="view"
                className="grid grid-cols-3 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Brand Name</p>
                  <p className="font-medium text-gray-900">{brand.companyName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Industry</p>
                  <p className="font-medium text-gray-900">{brand.industry || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Website</p>
                  <p className="font-medium text-gray-900">{brand.website || '-'}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error Message */}
        <AnimatePresence>
          {enrichmentError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"
            >
              {enrichmentError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products & Synonyms Table */}
        {editedEnrichment ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Tip */}
            <div className="mb-6 p-4 bg-cyan-50 border-l-4 border-cyan-500 rounded-r-xl">
              <p className="text-sm text-gray-700">
                <strong className="text-cyan-700">Tip:</strong> Click any field below to edit synonyms or products. Separate multiple items with commas.
              </p>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '25%' }}>Brand</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '35%' }}>Alias (Synonyms)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: '40%' }}>Commercial Products</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, index) => (
                    <motion.tr 
                      key={`${row.type}:${row.name}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={row.type === 'Brand' ? 'bg-cyan-50/30' : 'bg-white hover:bg-gray-50'}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <SafeLogo
                            src={row.logo}
                            domain={row.domain}
                            alt={row.name}
                            size={36}
                            className="w-9 h-9 rounded-lg object-contain bg-white p-1 border border-gray-100"
                          />
                          <span className="font-medium text-gray-900">{row.name}</span>
                          {row.type === 'Brand' && (
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-semibold rounded-full">You</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <textarea
                          value={row.synonymsText}
                          onChange={(e) => {
                            if (row.type === 'Brand') {
                              setDraftBrandSynonyms(e.target.value);
                            } else {
                              setDraftCompetitorSynonyms((prev) => ({ ...prev, [row.name]: e.target.value }));
                            }
                          }}
                          placeholder="Add synonyms..."
                          disabled={isSubmitting}
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-cyan-500 focus:outline-none resize-none transition-colors"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <textarea
                          value={row.productsText}
                          onChange={(e) => {
                            if (row.type === 'Brand') {
                              setDraftBrandProducts(e.target.value);
                            } else {
                              setDraftCompetitorProducts((prev) => ({ ...prev, [row.name]: e.target.value }));
                            }
                          }}
                          placeholder="Add products..."
                          disabled={isSubmitting}
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-cyan-500 focus:outline-none resize-none transition-colors"
                        />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="relative w-12 h-12 mx-auto">
                <div className="w-12 h-12 border-4 border-cyan-100 rounded-full" />
                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="mt-4 text-sm text-gray-500">Generating product and synonym suggestions…</p>
            </div>
          </div>
        )}

        {/* What's Next Section */}
        <motion.div 
          className="mt-8 p-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Rocket size={20} className="text-cyan-400" />
            What's Next?
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Target, text: 'Track visibility across AI engines' },
              { icon: BarChart3, text: `Monitor ${competitors.length} competitors` },
              { icon: Sparkles, text: 'AI-powered insights' },
              { icon: TrendingUp, text: 'Track brand performance' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-2 text-sm text-gray-300"
              >
                <item.icon size={16} className="text-cyan-400 flex-shrink-0" />
                <span>{item.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          className="mt-8 flex justify-end gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
          >
            Back
          </button>
          <motion.button
            type="button"
            onClick={enrichment ? handleApproveAndContinue : handleGenerate}
            disabled={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-200 hover:shadow-xl transition-all flex items-center gap-2"
          >
            <Sparkles size={18} />
            {enrichment ? 'Approve & Continue' : 'Generate Products'}
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};
