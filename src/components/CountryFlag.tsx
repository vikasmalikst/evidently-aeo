import { Globe } from 'lucide-react';
import { US, CA, GB, IN, KR, CN, JP } from 'country-flag-icons/react/3x2';

interface CountryFlagProps {
  countryCode: string;
  className?: string;
  style?: React.CSSProperties;
}

// Map region values to country codes
const regionToCountryCode: Record<string, string> = {
  'us': 'US',
  'canada': 'CA',
  'uk': 'GB',
  'india': 'IN',
  'south-korea': 'KR',
  'china': 'CN',
  'japan': 'JP',
};

// Regions that don't have a single country flag
const regionalOptions = ['latam', 'south-america', 'emea', 'southeast-asia'];

export const CountryFlag = ({ countryCode, className = '', style }: CountryFlagProps) => {
  const normalizedCode = countryCode.toLowerCase();
  
  // Default styles for consistent sizing
  const defaultStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    display: 'inline-block',
    flexShrink: 0,
    ...style
  };
  
  // Handle regional options (not single countries)
  if (regionalOptions.includes(normalizedCode)) {
    return (
      <Globe 
        size={16} 
        className={className} 
        style={defaultStyle}
        aria-label={`Region: ${countryCode}`}
      />
    );
  }

  // Map to country code
  const code = regionToCountryCode[normalizedCode] || normalizedCode.toUpperCase();

  // Render appropriate flag component
  switch (code) {
    case 'US':
      return <US className={className} style={defaultStyle} title="United States" />;
    case 'CA':
      return <CA className={className} style={defaultStyle} title="Canada" />;
    case 'GB':
      return <GB className={className} style={defaultStyle} title="United Kingdom" />;
    case 'IN':
      return <IN className={className} style={defaultStyle} title="India" />;
    case 'KR':
      return <KR className={className} style={defaultStyle} title="South Korea" />;
    case 'CN':
      return <CN className={className} style={defaultStyle} title="China" />;
    case 'JP':
      return <JP className={className} style={defaultStyle} title="Japan" />;
    default:
      return <Globe size={16} className={className} style={defaultStyle} aria-label={countryCode} />;
  }
};

