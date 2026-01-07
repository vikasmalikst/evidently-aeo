import { useEffect, useMemo, useState } from 'react';
import { Spinner } from './common/Spinner';
import { CheckCircle, Sparkles } from 'lucide-react';
import { SafeLogo } from './common/SafeLogo';
import { fetchBrandProductsPreview } from '../../api/onboardingApi';
import type { BrandProductsEnrichment, OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';

interface SummaryProps {
  brand: OnboardingBrand;
  competitors: OnboardingCompetitor[];
  onComplete: () => void;
  onBack: () => void;
}

export const Summary = ({ brand, competitors, onComplete, onBack }: SummaryProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [enrichment, setEnrichment] = useState<BrandProductsEnrichment | null>(null);
  const [editedEnrichment, setEditedEnrichment] = useState<BrandProductsEnrichment | null>(null);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

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
    if (!editedEnrichment) return [];

    return [
      {
        name: brand.companyName,
        type: 'Brand' as const,
        logo: brand.logo,
        domain: brand.domain,
        synonymsText: draftBrandSynonyms,
        productsText: draftBrandProducts,
      },
      ...competitorNames.map((name) => {
        const comp = competitors.find((c) => c.name === name);
        return {
          name,
          type: 'Competitor' as const,
          logo: comp?.logo || '',
          domain: comp?.domain || '',
          synonymsText: draftCompetitorSynonyms[name] || '',
          productsText: draftCompetitorProducts[name] || '',
        };
      }),
    ];
  }, [
    brand,
    competitors,
    competitorNames,
    editedEnrichment,
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
