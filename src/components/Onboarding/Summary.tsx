import { useEffect, useMemo, useState } from 'react';
import { Spinner } from './common/Spinner';
import { CheckCircle, Sparkles, Edit2, Save, X } from 'lucide-react';
import { SafeLogo } from './common/SafeLogo';
import { Input } from './common/Input';
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

  // Initialize edit state when entering edit mode
  useEffect(() => {
    if (isEditingBrand) {
      setEditIndustry(brand.industry || '');
      setEditWebsite(brand.domain || '');
    }
  }, [isEditingBrand, brand]);

  const handleCancelEdit = () => {
    setIsEditingBrand(false);
  };

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

  // Draft text so the textarea behaves normally (no auto-trim/join while typing).
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [draftBrandSynonyms, setDraftBrandSynonyms] = useState('');
  const [draftBrandProducts, setDraftBrandProducts] = useState('');
  const [draftCompetitorSynonyms, setDraftCompetitorSynonyms] = useState<Record<string, string>>({});
  const [draftCompetitorProducts, setDraftCompetitorProducts] = useState<Record<string, string>>({});

  const sanitizeListForSave = (items: string[]): string[] =>
    items.map((s) => s.trim()).filter(Boolean);

  const parseCommaListForSave = (value: string): string[] =>
    sanitizeListForSave(value.split(','));

  // When enrichment is loaded or cached, initialize editedEnrichment
  useEffect(() => {
    if (enrichment && !editedEnrichment) {
      setEditedEnrichment(enrichment);
    }
  }, [enrichment, editedEnrichment]);

  // Initialize draft text once we have editedEnrichment, so inputs are editable
  // without reformatting/cursor jumps on each keystroke.
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
      console.error(message, error);
      setEnrichmentError(message);
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
      // Clean up any empty items (e.g., from trailing commas) before saving.
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
        const parsed = JSON.parse(cached) as {
          brandName: string;
          industry?: string;
          competitors: string[];
          enrichment: BrandProductsEnrichment;
        };

        const sameBrand = parsed.brandName === brand.companyName;
        const sameCompetitors =
          Array.isArray(parsed.competitors) &&
          parsed.competitors.length === competitorNames.length &&
          parsed.competitors.every((name, idx) => name === competitorNames[idx]);

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
    console.log('📊 Summary: Generating rows. Competitors prop:', competitors);

    const brandRow = {
      name: brand.companyName,
      type: 'Brand' as const,
      logo: brand.logo,
      domain: brand.domain,
      synonymsText: draftBrandSynonyms,
      productsText: draftBrandProducts,
    };

    // If we have enrichment data, we can filter/sort, 
    // but we must ensure ALL selected competitors are shown.
    // We map over the `competitors` prop to ensure no one is left out.
    const competitorRows = competitors.map((comp) => {
      const row = {
        name: comp.name,
        type: 'Competitor' as const,
        logo: comp.logo || '',
        domain: comp.domain || '',
        synonymsText: draftCompetitorSynonyms[comp.name] || '',
        productsText: draftCompetitorProducts[comp.name] || '',
      };
      
      if (!draftCompetitorSynonyms[comp.name] && !draftCompetitorProducts[comp.name]) {
        console.warn(`⚠️ Competitor "${comp.name}" has no enrichment data. Showing empty row.`);
      }
      
      return row;
    });

    const result = [brandRow, ...competitorRows];
    console.log('✅ Summary: Generated rows:', result);
    return result;
  }, [
    brand,
    competitors,
    draftBrandSynonyms,
    draftBrandProducts,
    draftCompetitorSynonyms,
    draftCompetitorProducts,
  ]);

  if (showSuccess) {
    return (
      <div className="onboarding-summary-content">
        <div className="onboarding-success">
          <div className="onboarding-success__icon">
            <CheckCircle size={80} />
          </div>
          <h1 className="onboarding-success__title">All Set!</h1>
          <p className="onboarding-success__message">
            Redirecting to the next step...
          </p>
        </div>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="onboarding-summary-content">
        <Spinner size="large" message={loadingMessage || 'Working...'} />
      </div>
    );
  }

  return (
    <div className="onboarding-summary-content">
      <div className="onboarding-summary" style={{ maxWidth: '1000px' }}>
        <div className="onboarding-summary__header">
          <Sparkles size={48} className="onboarding-summary__icon" />
          <h1 className="onboarding-summary__title">Ready to Launch</h1>
          <p className="onboarding-summary__subtitle">
            Review and refine your brand and competitor products
          </p>
        </div>

        <div className="onboarding-summary__section">
          <div className="onboarding-brand-details" style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-headings)' }}>Brand Information</h3>
              {!isEditingBrand && onUpdateBrand && (
                <button
                  onClick={() => setIsEditingBrand(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--accent500)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              )}
            </div>

            {isEditingBrand ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input
                  label="Industry"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                  placeholder="e.g. SaaS, E-commerce"
                />
                <Input
                  label="Website"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="e.g. brand.com"
                />
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                  <button
                    onClick={handleCancelEdit}
                    className="onboarding-button-secondary"
                    style={{ height: '36px', padding: '0 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBrandDetails}
                    className="onboarding-button-primary"
                    style={{ height: '36px', padding: '0 16px' }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginBottom: '4px' }}>Brand Name</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-body)' }}>{brand.companyName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginBottom: '4px' }}>Industry</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-body)' }}>{brand.industry || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginBottom: '4px' }}>Website</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-body)' }}>{brand.website || '-'}</div>
                </div>
              </div>
            )}
          </div>

          {enrichmentError && (
            <div style={{ color: 'var(--text-error)', fontSize: 14, marginBottom: 16 }}>
              {enrichmentError}
            </div>
          )}

          {editedEnrichment ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ 
                padding: '12px 16px', 
                background: 'var(--accent50)', 
                borderLeft: '3px solid var(--accent500)',
                borderRadius: '4px',
                marginBottom: '16px',
                fontSize: '14px',
                color: 'var(--text-body)'
              }}>
                <strong>Tip:</strong> Click any field below to edit synonyms or products. Separate multiple items with commas.
              </div>
              <table className="onboarding-grid-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Brand</th>
                    <th style={{ width: '35%' }}>Alias (Synonyms)</th>
                    <th style={{ width: '40%' }}>Commercial Products</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.type}:${row.name}`}>
                      <td>
                        <div className="onboarding-grid-entity">
                          <SafeLogo
                            src={row.logo}
                            domain={row.domain}
                            alt={row.name}
                            size={32}
                            className="onboarding-summary-competitor__logo"
                          />
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td>
                        <textarea
                          className="onboarding-grid-input"
                          value={row.synonymsText}
                          onChange={(e) => {
                            if (row.type === 'Brand') {
                              setDraftBrandSynonyms(e.target.value);
                            } else {
                              setDraftCompetitorSynonyms((prev) => ({ ...prev, [row.name]: e.target.value }));
                            }
                          }}
                          placeholder="Add synonyms separated by commas..."
                          disabled={isSubmitting}
                          rows={3}
                          spellCheck={false}
                        />
                      </td>
                      <td>
                        <textarea
                          className="onboarding-grid-input"
                          value={row.productsText}
                          onChange={(e) => {
                            if (row.type === 'Brand') {
                              setDraftBrandProducts(e.target.value);
                            } else {
                              setDraftCompetitorProducts((prev) => ({ ...prev, [row.name]: e.target.value }));
                            }
                          }}
                          placeholder="Add products separated by commas..."
                          disabled={isSubmitting}
                          rows={3}
                          spellCheck={false}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="onboarding-spinner-container">
              <Spinner size="large" message="Generating product and synonym suggestions…" />
            </div>
          )}
        </div>

        <div className="onboarding-summary__preview">
          <h3 className="onboarding-summary__preview-title">What's Next?</h3>
          <ul className="onboarding-summary__preview-list">
            <li>Track visibility across multiple AI engines</li>
            <li>Analyze queries across {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}</li>
            <li>Get actionable insights powered by AI</li>
            <li>Monitor your brand's performance</li>
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
            onClick={enrichment ? handleApproveAndContinue : handleGenerate}
            disabled={isSubmitting || (!enrichment && competitorNames.length === 0)}
            style={{ minWidth: 160 }}
          >
            {enrichment ? 'Approve & Continue' : 'Generate Products'}
          </button>
        </div>
      </div>
    </div>
  );
};
