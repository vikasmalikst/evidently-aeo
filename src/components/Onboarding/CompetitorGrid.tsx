import { useState, useEffect, useMemo } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { Spinner } from './common/Spinner';
import { getCompetitors, type Brand, type Competitor } from '../../api/onboardingMock';
import { Search, Plus, Check } from 'lucide-react';

interface CompetitorGridProps {
  brand: Brand;
  onContinue: (competitors: Competitor[]) => void;
  onBack: () => void;
}

export const CompetitorGrid = ({ brand, onContinue, onBack }: CompetitorGridProps) => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    const loadCompetitors = async () => {
      setIsLoading(true);
      try {
        const data = await getCompetitors(brand);
        setCompetitors(data);
        const topFive = new Set(data.slice(0, 5).map(c => c.domain));
        setSelected(topFive);
      } finally {
        setIsLoading(false);
      }
    };

    loadCompetitors();
  }, [brand]);

  const filteredCompetitors = useMemo(() => {
    if (!searchQuery) return competitors;
    const query = searchQuery.toLowerCase();
    return competitors.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.industry.toLowerCase().includes(query)
    );
  }, [competitors, searchQuery]);

  const toggleCompetitor = (domain: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      if (newSelected.size >= 10) return;
      newSelected.add(domain);
    }
    setSelected(newSelected);
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;

    const customDomain = customName.toLowerCase().replace(/\s+/g, '');
    const customCompetitor: Competitor = {
      name: customName,
      logo: `https://logo.clearbit.com/${customDomain}.com`,
      industry: brand.industry,
      relevance: 'Custom',
      domain: `${customDomain}.com`
    };

    setCompetitors([customCompetitor, ...competitors]);
    setSelected(new Set([...selected, customCompetitor.domain]));
    setCustomName('');
    setShowCustomForm(false);
  };

  const handleContinue = () => {
    const selectedCompetitors = competitors.filter((c) => selected.has(c.domain));
    onContinue(selectedCompetitors);
  };

  if (isLoading) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-step__content">
          <Spinner size="large" message="Loading competitors..." />
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__content onboarding-step__content--wide">
        <div className="onboarding-brand-header">
          <img src={brand.logo} alt={brand.companyName} className="onboarding-brand-header__logo" />
          <div className="onboarding-brand-header__info">
            <h2 className="onboarding-brand-header__name">{brand.companyName}</h2>
            <p className="onboarding-brand-header__meta">{brand.industry}</p>
          </div>
        </div>

        <div className="onboarding-section-header">
          <div>
            <h1 className="onboarding-section-header__title">Select Your Competitors</h1>
            <p className="onboarding-section-header__subtitle">
              Choose up to 10 competitors to track (recommended: 5-7)
            </p>
          </div>
          <div className="onboarding-selection-count">
            <span className="onboarding-selection-count__number">{selected.size}</span>
            <span className="onboarding-selection-count__text">of 10 selected</span>
          </div>
        </div>

        <div className="onboarding-controls">
          <div className="onboarding-search">
            <Search size={20} className="onboarding-search__icon" />
            <input
              type="text"
              placeholder="Search competitors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="onboarding-search__input"
            />
          </div>
          <button
            type="button"
            className="onboarding-add-custom-button"
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
            <Button onClick={handleAddCustom} disabled={!customName.trim()}>
              Add
            </Button>
          </div>
        )}

        <div className="onboarding-competitor-grid">
          {filteredCompetitors.map((competitor) => {
            const isSelected = selected.has(competitor.domain);
            return (
              <Card
                key={competitor.domain}
                selected={isSelected}
                hoverable
                onClick={() => toggleCompetitor(competitor.domain)}
              >
                <div className="onboarding-competitor-card">
                  <div className="onboarding-competitor-card__checkbox">
                    {isSelected && <Check size={16} />}
                  </div>
                  <img
                    src={competitor.logo}
                    alt={competitor.name}
                    className="onboarding-competitor-card__logo"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <h3 className="onboarding-competitor-card__name">{competitor.name}</h3>
                  <p className="onboarding-competitor-card__industry">{competitor.industry}</p>
                  <span className="onboarding-competitor-card__relevance">{competitor.relevance}</span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="onboarding-actions">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={selected.size < 3}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
