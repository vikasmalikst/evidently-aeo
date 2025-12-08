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
    // Default fallback icon - show first letter of brand name
    const firstLetter = brandName.charAt(0).toUpperCase();
    const sizeClass = size >= 32 ? 'w-10 h-10 text-sm' : size >= 24 ? 'w-6 h-6 text-xs' : 'w-4 h-4 text-[10px]';
    return (
      <div className={`${sizeClass} flex items-center justify-center bg-[#8b90a7] rounded-md text-white font-semibold ${className}`}>
        {firstLetter}
      </div>
    );
  }

  // Use favicon service
  const sizeClass = size >= 32 ? 'w-10 h-10' : size >= 24 ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className={`${sizeClass} flex items-center justify-center ${className}`}>
      <img
        src={faviconUrl}
        alt={brandName}
        className={`${sizeClass} rounded object-contain`}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

