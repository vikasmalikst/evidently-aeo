import { useMemo } from 'react';
import { CountryFlag } from '../../../components/CountryFlag';
import { IconBrandOpenai } from '@tabler/icons-react';
import claudeLogoSrc from '../../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../../assets/Microsoft-Copilot-icon.svg';
import geminiLogoSrc from '../../../assets/Google-Gemini-Icon.svg';
import googleAioLogoSrc from '../../../assets/Google-AI-icon.svg';
import grokLogoSrc from '../../../assets/Grok-icon.svg';
import perplexityLogoSrc from '../../../assets/Perplexity-Simple-Icon.svg';

interface ChartTitleProps {
  category?: string;
  country?: string;
  dateRange?: string;
  baseTitle?: string;
  countryOptions?: Array<{ value: string; label: string }>;
  selectedModel?: string;
  aiModels?: Array<{ id: string; name: string; icon: string }>;
}

export const ChartTitle = ({
  category = 'all',
  country,
  dateRange = '',
  baseTitle = 'Topics Share of Answer',
  countryOptions = [],
  selectedModel,
  aiModels = [],
}: ChartTitleProps) => {
  // Get country label from options
  const countryLabel = useMemo(() => {
    if (!country) return null;
    const countryOption = countryOptions.find(opt => opt.value === country);
    if (!countryOption) return null;
    
    // Remove flag emoji if present (handles both Unicode flag emojis and regional indicator symbols)
    // Also handles globe emojis for regions
    const label = countryOption.label
      .replace(/^[\u{1F1E6}-\u{1F1FF}]+ /u, '') // Remove flag emojis
      .replace(/^[\u{1F30D}-\u{1F30F}] /u, '') // Remove globe emojis
      .trim();
    
    return label || null;
  }, [country, countryOptions]);

  // Generate title based on filters
  const title = useMemo(() => {
    const parts: string[] = [baseTitle];
    
    // Add category if not "all"
    if (category && category !== 'all') {
      parts.push(`- ${category}`);
    }
    
    return parts.join(' ');
  }, [baseTitle, category]);

  // Get model info
  const modelInfo = useMemo(() => {
    if (!selectedModel || !aiModels.length) return null;
    return aiModels.find(m => m.id === selectedModel);
  }, [selectedModel, aiModels]);

  // Get model favicon component
  const getModelFavicon = () => {
    if (!selectedModel || !modelInfo) return null;
    
    switch (selectedModel) {
      case 'chatgpt':
        return <IconBrandOpenai size={16} />;
      case 'claude':
        return <img src={claudeLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'gemini':
        return <img src={geminiLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'perplexity':
        return <img src={perplexityLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'copilot':
        return <img src={copilotLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'google_aio':
        return <img src={googleAioLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'grok':
        return <img src={grokLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      default:
        return null;
    }
  };

  // Generate subtitle based on filters
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    
    // Add date range
    if (dateRange) {
      parts.push(`for the ${dateRange}`);
    }
    
    // Add country/region if specified
    if (countryLabel) {
      parts.push(`in ${countryLabel}`);
    }
    
    return parts.join(' ');
  }, [dateRange, countryLabel]);

  return (
    <div>
      <h2
        style={{
          fontSize: '20px',
          fontFamily: 'Sora, sans-serif',
          fontWeight: 600,
          color: 'var(--text-headings)',
          margin: '0 0 8px 0',
          lineHeight: '1.2',
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <div
          style={{
            fontSize: '14px',
            fontFamily: 'IBM Plex Sans, sans-serif',
            color: 'var(--text-caption)',
            margin: 0,
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {/* Date range part */}
          {dateRange && (
            <span>for the {dateRange}</span>
          )}
          
          {/* Country/region part with flag */}
          {country && countryLabel && (
            <>
              {dateRange && <span style={{ margin: '0 4px' }}>•</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CountryFlag 
                  countryCode={country} 
                  className="w-4 h-4"
                  style={{ display: 'inline-block', verticalAlign: 'middle' }}
                />
                <span>in {countryLabel}</span>
              </span>
            </>
          )}
          
          {/* Model part with favicon */}
          {modelInfo && (
            <>
              {(dateRange || (country && countryLabel)) && <span style={{ margin: '0 4px' }}>•</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {getModelFavicon()}
                <span>{modelInfo.name}</span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

