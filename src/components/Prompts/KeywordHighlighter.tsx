interface KeywordHighlighterProps {
  text: string;
  keywords: {
    brand: string[];
    products: string[];
    keywords: string[];
    competitors: string[];
  };
  highlightBrand: boolean;
  highlightProducts: boolean;
  highlightKeywords?: boolean;
  highlightCompetitors?: boolean;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const KeywordHighlighter = ({
  text,
  keywords,
  highlightBrand,
  highlightProducts,
  highlightKeywords = true,
  highlightCompetitors = true
}: KeywordHighlighterProps) => {
  const highlights: Array<{ start: number; end: number; type: string }> = [];

  const addHighlights = (words: string[], type: string) => {
    words.forEach(word => {
      if (!word || word.trim().length === 0) {
        return;
      }
      const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'giu');
      let match;
      while ((match = regex.exec(text)) !== null) {
        highlights.push({
          start: match.index,
          end: match.index + match[0].length,
          type
        });
      }
    });
  };

  if (highlightBrand && keywords.brand && keywords.brand.length > 0) addHighlights(keywords.brand, 'brand');
  if (highlightProducts && keywords.products && keywords.products.length > 0) addHighlights(keywords.products, 'product');
  if (highlightKeywords && keywords.keywords && keywords.keywords.length > 0) addHighlights(keywords.keywords, 'keyword');
  if (highlightCompetitors && keywords.competitors && keywords.competitors.length > 0) addHighlights(keywords.competitors, 'competitor');

  // Resolve overlaps by preferring higher priority and longer matches
  // Priority: product > competitor > keyword > brand
  const priorityOf = (type: string) => {
    if (type === 'product') return 4;
    if (type === 'competitor') return 3;
    if (type === 'keyword') return 2;
    if (type === 'brand') return 1;
    return 0;
  };

  // Sort by:
  // 1) priority desc
  // 2) length desc
  // 3) start asc
  const sortedByPreference = highlights
    .slice()
    .sort((a, b) => {
      const pr = priorityOf(b.type) - priorityOf(a.type);
      if (pr !== 0) return pr;
      const lenDiff = (b.end - b.start) - (a.end - a.start);
      if (lenDiff !== 0) return lenDiff;
      return a.start - b.start;
    });

  const resolvedHighlights: Array<{ start: number; end: number; type: string }> = [];
  const intersects = (x: { start: number; end: number }, y: { start: number; end: number }) =>
    !(x.end <= y.start || x.start >= y.end);

  // Greedily keep non-overlapping spans in preferred order
  for (const h of sortedByPreference) {
    if (!resolvedHighlights.some(r => intersects(h, r))) {
      resolvedHighlights.push(h);
    }
  }

  // Render in reading order
  resolvedHighlights.sort((a, b) => a.start - b.start);

  if (resolvedHighlights.length === 0) {
    return <p className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  const parts: JSX.Element[] = [];
  let lastIndex = 0;

  resolvedHighlights.forEach((highlight, idx) => {
    if (highlight.start > lastIndex) {
      parts.push(
        <span key={`text-${idx}`}>
          {text.substring(lastIndex, highlight.start)}
        </span>
      );
    }

    const getHighlightColor = (type: string) => {
      if (type === 'brand') return '#498CF9';
      if (type === 'product') return '#AC59FB';
      if (type === 'keyword') return '#10B981';
      if (type === 'competitor') return '#F59E0B';
      return '';
    };

    parts.push(
      <span
        key={`highlight-${idx}`}
        className="font-semibold"
        style={{
          color: getHighlightColor(highlight.type),
          textDecoration: 'underline',
          textDecorationThickness: '1.5px',
          textUnderlineOffset: '2px'
        }}
      >
        {text.substring(highlight.start, highlight.end)}
      </span>
    );

    lastIndex = highlight.end;
  });

  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return (
    <p className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">
      {parts}
    </p>
  );
};
