import { useMemo, useState, useEffect } from 'react';

interface BrandIconProps {
  brandName: string;
  size?: number;
  className?: string;
}

// Map common brand names to their domains for favicon service
const brandNameToDomain: Record<string, string> = {
  'youtube': 'youtube.com',
  'netflix': 'netflix.com',
  'tiktok': 'tiktok.com',
  'disney+': 'disney.com',
  'disney plus': 'disney.com',
  'amazon prime video': 'amazon.com',
  'amazon prime': 'amazon.com',
  'meta': 'meta.com',
  'facebook': 'facebook.com',
  'instagram': 'instagram.com',
  'twitter': 'twitter.com',
  'x': 'x.com',
  'linkedin': 'linkedin.com',
  'microsoft': 'microsoft.com',
  'google': 'google.com',
  'apple': 'apple.com',
  'spotify': 'spotify.com',
  'adobe': 'adobe.com',
  'salesforce': 'salesforce.com',
  'oracle': 'oracle.com',
  'ibm': 'ibm.com',
  'intel': 'intel.com',
  'nvidia': 'nvidia.com',
  'amd': 'amd.com',
  'samsung': 'samsung.com',
  'sony': 'sony.com',
  'nintendo': 'nintendo.com',
  'uber': 'uber.com',
  'airbnb': 'airbnb.com',
  'stripe': 'stripe.com',
  'paypal': 'paypal.com',
  'visa': 'visa.com',
  'mastercard': 'mastercard.com',
  'shopify': 'shopify.com',
  'wordpress': 'wordpress.com',
  'github': 'github.com',
  'gitlab': 'gitlab.com',
  'docker': 'docker.com',
  'kubernetes': 'kubernetes.io',
  'aws': 'aws.amazon.com',
  'amazon web services': 'aws.amazon.com',
  'azure': 'azure.microsoft.com',
  'gcp': 'cloud.google.com',
  'google cloud': 'cloud.google.com',
};

// Get domain from brand name for favicon service
const getDomainFromBrand = (brandName: string): string => {
  const normalized = brandName.toLowerCase().trim();
  
  // Check direct mappings first
  if (brandNameToDomain[normalized]) {
    return brandNameToDomain[normalized];
  }
  
  // Try to extract domain if brand name contains a domain
  const domainMatch = normalized.match(/([a-z0-9-]+\.(com|net|org|io|co|ai|dev|edu|gov))/);
  if (domainMatch) {
    return domainMatch[1];
  }
  
  // Try common TLDs - remove common suffixes and add .com
  let brandWithoutSpaces = normalized.replace(/\s+/g, '');
  // Remove common suffixes
  brandWithoutSpaces = brandWithoutSpaces.replace(/\s*(inc|llc|corp|corporation|ltd|limited|co)$/i, '');
  return `${brandWithoutSpaces}.com`;
};

export const BrandIcon = ({ brandName, size = 24, className = '' }: BrandIconProps) => {
  const faviconUrl = useMemo(() => {
    const domain = getDomainFromBrand(brandName);
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  }, [brandName, size]);

  const [hasError, setHasError] = useState(false);

  // Reset error state when brand name changes
  useEffect(() => {
    setHasError(false);
  }, [brandName]);

  if (hasError) {
    // Default fallback icon
    return (
      <div className={`w-6 h-6 flex items-center justify-center bg-[#8b90a7] rounded-md ${className}`}>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <circle cx="12" cy="12" r="4"/>
        </svg>
      </div>
    );
  }

  // Use favicon service
  return (
    <div className={`w-6 h-6 flex items-center justify-center ${className}`}>
      <img
        src={faviconUrl}
        alt={brandName}
        className="w-6 h-6 rounded"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

