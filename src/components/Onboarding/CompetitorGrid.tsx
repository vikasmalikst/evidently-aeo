import { useState, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { Card } from './common/Card';
import { Input } from './common/Input';
import { Spinner } from './common/Spinner';
import type { OnboardingBrand, OnboardingCompetitor } from '../../types/onboarding';

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
    const loadCompetitors = async () => {
      setIsLoading(true);
      try {
        if (initialCompetitors && initialCompetitors.length > 0) {
          setCompetitors(initialCompetitors);
          onCompetitorsLoaded?.(initialCompetitors);
          if (!externalSelected || externalSelected.size === 0) {
            const autoSelect = new Set(
              initialCompetitors.slice(0, 5).map((competitor) => getCompetitorKey(competitor))
            );
            setSelected(autoSelect);
            onSelectionChange?.(autoSelect);
          }
        } else {
          setCompetitors([]);
          onCompetitorsLoaded?.([]);
          if (!externalSelected || externalSelected.size === 0) {
            setSelected(new Set());
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCompetitors();
  }, [brand, initialCompetitors]);


  const toggleCompetitor = (competitor: OnboardingCompetitor) => {
    const key = getCompetitorKey(competitor);
    if (!key) {
      return;
    }

    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      if (newSelected.size >= 10) return;
      newSelected.add(key);
    }
    setSelected(newSelected);
    if (onSelectionChange) {
      onSelectionChange(newSelected);
    }
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;

    const customDomain = customName.toLowerCase().replace(/\s+/g, '');
    const domain = `${customDomain}.com`;
    const customCompetitor: OnboardingCompetitor = {
      name: customName,
      logo: `https://logo.clearbit.com/${domain}`,
      industry: brand.industry,
      relevance: 'Custom',
      domain,
      url: `https://${domain}`,
      source: 'custom',
    };

    const updatedCompetitors = [customCompetitor, ...competitors];
    setCompetitors(updatedCompetitors);
    // Notify parent of updated competitors list
    if (onCompetitorsLoaded) {
      onCompetitorsLoaded(updatedCompetitors);
    }
    const key = getCompetitorKey(customCompetitor);
    const newSelected = new Set(selected);
    newSelected.add(key);
    setSelected(newSelected);
    if (onSelectionChange) {
      onSelectionChange(newSelected);
    }
    setCustomName('');
    setShowCustomForm(false);
  };

  const handleContinue = () => {
    const selectedCompetitors = competitors.filter((competitor) =>
      selected.has(getCompetitorKey(competitor))
    );
    onContinue(selectedCompetitors);
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
          <img src={brand.logo} alt={brand.companyName} className="onboarding-brand-header__logo" crossOrigin="anonymous" />
          <div className="onboarding-brand-header__info">
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
        <div className="onboarding-selection-count">
          <span className="onboarding-selection-count__number">{selected.size}</span>
          <span className="onboarding-selection-count__text">of 10 selected</span>
        </div>
      </div>

      <div className="onboarding-section-header">
        <p className="onboarding-section-header__subtitle">
          Choose up to 10 competitors to track (recommended: 5-7)
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
        <div className="onboarding-custom-form">
          <Input
            placeholder="Enter competitor name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
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
            disabled={!customName.trim()}
          >
            Add
          </button>
        </div>
      )}

      <div className="onboarding-competitor-grid">
        {competitors.map((competitor) => {
          const key = getCompetitorKey(competitor);
          const isSelected = key ? selected.has(key) : false;
          return (
            <Card
              key={key || competitor.name}
              selected={isSelected}
              hoverable
              onClick={() => toggleCompetitor(competitor)}
              className={
                competitor.relevance === 'Direct Competitor' 
                  ? 'onboarding-card--direct' 
                  : competitor.relevance === 'Indirect Competitor'
                  ? 'onboarding-card--indirect'
                  : 'onboarding-card--custom'
              }
            >
              <div className="onboarding-competitor-card">
                <div className="onboarding-competitor-card__checkbox">
                  {isSelected && <Check size={16} />}
                </div>
                {competitor.logo && (
                  <img
                    src={competitor.logo}
                    alt={competitor.name}
                    className="onboarding-competitor-card__logo"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
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
