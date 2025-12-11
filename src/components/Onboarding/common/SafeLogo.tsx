import { useEffect, useMemo, useState } from 'react';

interface SafeLogoProps {
  src?: string;
  domain?: string;
  alt: string;
  className?: string;
  size?: number | string;
}

const buildLogoSources = (src?: string, domain?: string) => {
  const cleanDomain = domain
    ?.replace(/^https?:\/\//, '')
    .split('/')[0]
    .trim();

  const logoDevToken = 'pk_LnBYF-jRQ9S_vlHK3xyZzg';

  const candidates = [
    src,
    cleanDomain ? `https://logo.clearbit.com/${cleanDomain}` : null,
    cleanDomain ? `https://img.logo.dev/${cleanDomain}?token=${logoDevToken}` : null,
    cleanDomain ? `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico` : null,
    cleanDomain ? `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128` : null,
  ];

  // Remove falsy and duplicate entries while preserving order
  const seen = new Set<string>();
  return candidates.filter((url): url is string => {
    if (!url) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

export const SafeLogo = ({ src, domain, alt, className = '', size }: SafeLogoProps) => {
  const sources = useMemo(() => buildLogoSources(src, domain), [src, domain]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [sources]);

  if (!sources.length || index >= sources.length) {
    const initial = alt?.charAt(0)?.toUpperCase?.() || '';
    const dimension = typeof size === 'number' ? `${size}px` : size;
    const boxStyle = dimension
      ? { width: dimension, height: dimension, minWidth: dimension, minHeight: dimension }
      : undefined;

    return (
      <div
        className={`safe-logo-fallback ${className}`.trim()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          backgroundColor: '#eef2f7',
          color: '#475569',
          fontWeight: 600,
          fontSize: dimension ? undefined : 12,
          ...boxStyle,
        }}
        aria-label={alt}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={sources[index]}
      alt={alt}
      className={className}
      crossOrigin="anonymous"
      style={size ? { width: size, height: size } : undefined}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
};
