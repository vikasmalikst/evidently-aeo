import { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Card } from './common/Card';
import { Input } from './common/Input';
import { Spinner } from './common/Spinner';
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
    // If we have already loaded the initial competitors and we have local changes,
    // prevent overwriting local state with the echoed prop from parent.
    // This fixes the issue where adding a custom competitor updates parent, 
    // which then updates prop, causing a reset here.
    if (hasLoadedRef.current && competitors.length > 0) {
      return;
    }

    const loadCompetitors = async () => {
      setIsLoading(true);
      try {
        if (initialCompetitors && initialCompetitors.length > 0) {
          setCompetitors(initialCompetitors);
          hasLoadedRef.current = true;
          
          // Only notify if we haven't already (to avoid loops)
          // onCompetitorsLoaded?.(initialCompetitors); 
          
          if (!externalSelected || externalSelected.size === 0) {
            const autoSelect = new Set(
              initialCompetitors.slice(0, 5).map((competitor) => getCompetitorKey(competitor))
            );
            setSelected(autoSelect);
            onSelectionChange?.(autoSelect);
          }
        } else {
          // Only reset if we really have nothing
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
    e.stopPropagation(); // Prevent card click event
    const key = getCompetitorKey(competitor);
    if (!key) {
      return;
    }

    // Remove competitor from the list
    const updatedCompetitors = competitors.filter((c) => getCompetitorKey(c) !== key);
    setCompetitors(updatedCompetitors);
    
    // Notify parent of updated competitors list
    if (onCompetitorsLoaded) {
      onCompetitorsLoaded(updatedCompetitors);
    }

    // Remove from selection if it was selected
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
      // Add protocol if missing for URL parsing
      const urlToParse = domain.startsWith('http') ? domain : `https://${domain}`;
      const urlObj = new URL(urlToParse);
      domain = urlObj.hostname;
    } catch (e) {
      // fallback to raw string if parsing fails
    }
    
    // Remove www. if present for cleaner domain
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
    console.log('➕ Added custom competitor:', customCompetitor);
    setCompetitors(updatedCompetitors);
    
    // Add to selection automatically
    const key = getCompetitorKey(customCompetitor);
    const newSelected = new Set(selected);
    newSelected.add(key);
    setSelected(newSelected);
    
    // Notify parent of both the new list and the new selection
    onCompetitorsLoaded?.(updatedCompetitors);
    onSelectionChange?.(newSelected);

    setCustomName('');
    setCustomUrl('');
    setShowCustomForm(false);
  };

  const handleContinue = () => {
    // All remaining competitors are considered selected
    console.log('🚀 CompetitorGrid: handleContinue called with competitors:', competitors);
    onContinue(competitors);
  };

  if (isLoading) {
    return (
      <div className="onboarding-competitor-grid-content">
        <Spinner size="large" message="Loading competitors..." />
      </div>
    );
  }

  return (
    <div className="onboarding-competitor-grid-content">
      <div className="onboarding-brand-section-wrapper">
        <div className="onboarding-brand-header">
          <div className="onboarding-brand-header__info" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <SafeLogo
              src={brand.logo || brand.metadata?.logo || brand.metadata?.brand_logo}
              domain={brand.domain || brand.website?.replace(/^https?:\/\//, '').split('/')[0]}
              alt={brand.companyName}
              size={64}
              className="w-16 h-16 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
            />
            <div style={{ flex: 1 }}>
              <h2 className="onboarding-brand-header__name">{brand.companyName}</h2>
              <p className="onboarding-brand-header__meta">
                {brand.industry || 'General'}
                {brand.headquarters ? ` • ${brand.headquarters}` : ''}
                {brand.founded ? ` • Founded ${brand.founded}` : ''}
                {brand.metadata?.ceo ? ` • CEO: ${brand.metadata.ceo}` : ''}
              </p>
              {brand.description ? (
                <p className="onboarding-brand-header__description">{brand.description}</p>
              ) : (
                <p className="onboarding-brand-header__description" style={{ fontStyle: 'italic', color: '#64748b' }}>
                  {brand.website ? `Website: ${brand.website}` : 'No additional information available'}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="onboarding-selection-count">
          <span className="onboarding-selection-count__number">{competitors.length}</span>
          <span className="onboarding-selection-count__text">competitors</span>
        </div>
      </div>

      <div className="onboarding-section-header">
        <p className="onboarding-section-header__subtitle">
          Remove competitors you don't want to track (recommended: 5-7)
        </p>
        <button
          type="button"
          className="onboarding-button-secondary"
          onClick={() => setShowCustomForm(!showCustomForm)}
        >
          <Plus size={18} />
          Add Custom Competitor
        </button>
      </div>

      {showCustomForm && (
        <div className="onboarding-custom-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end', marginBottom: '24px' }}>
          <Input
            label="Competitor Name"
            placeholder="Enter competitor name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <Input
            label="Competitor URL"
            placeholder="e.g. example.com"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              }
            }}
          />
          <button
            className="onboarding-button-primary"
            onClick={handleAddCustom}
            disabled={!customName.trim() || !customUrl.trim()}
            style={{ marginBottom: '2px', height: '42px' }}
          >
            Add
          </button>
        </div>
      )}

      <div className="onboarding-competitor-grid">
        {competitors.map((competitor) => {
          const key = getCompetitorKey(competitor);
          return (
            <Card
              key={key || competitor.name}
              hoverable
              className={
                competitor.relevance === 'Direct Competitor' 
                  ? 'onboarding-card--direct' 
                  : competitor.relevance === 'Indirect Competitor'
                  ? 'onboarding-card--indirect'
                  : 'onboarding-card--custom'
              }
            >
              <div className="onboarding-competitor-card">
                <button
                  onClick={(e) => handleRemoveCompetitor(competitor, e)}
                  className="onboarding-competitor-card__remove"
                  aria-label={`Remove ${competitor.name}`}
                  type="button"
                >
                  <X size={16} />
                </button>
                {(competitor.logo || competitor.domain) && (
                  <SafeLogo
                    src={competitor.logo}
                    domain={competitor.domain}
                    alt={competitor.name}
                    className="onboarding-competitor-card__logo"
                  />
                )}
                <h3 className="onboarding-competitor-card__name">{competitor.name}</h3>
                <p className="onboarding-competitor-card__industry">{competitor.industry}</p>
                <span className={`onboarding-competitor-card__relevance onboarding-competitor-card__relevance--${
                  competitor.relevance === 'Direct Competitor' 
                    ? 'direct' 
                    : competitor.relevance === 'Indirect Competitor' 
                    ? 'indirect' 
                    : 'custom'
                }`}>
                  {competitor.relevance}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
