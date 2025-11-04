interface KeywordHighlighterProps {
  text: string;
  keywords: {
    brand: string[];
    target: string[];
    top: string[];
  };
  highlightBrand: boolean;
  highlightTarget: boolean;
  highlightTop: boolean;
}

export const KeywordHighlighter = ({
  text,
  keywords,
  highlightBrand,
  highlightTarget,
  highlightTop
}: KeywordHighlighterProps) => {
  let highlightedText = text;

  const highlights: Array<{ start: number; end: number; type: string }> = [];

  const addHighlights = (words: string[], type: string) => {
    words.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
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

  if (highlightBrand) addHighlights(keywords.brand, 'brand');
  if (highlightTarget) addHighlights(keywords.target, 'target');
  if (highlightTop) addHighlights(keywords.top, 'top');

  highlights.sort((a, b) => a.start - b.start);

  const resolvedHighlights: Array<{ start: number; end: number; type: string }> = [];
  highlights.forEach(highlight => {
    const overlapping = resolvedHighlights.find(
      h => h.start <= highlight.start && h.end >= highlight.start
    );
    if (!overlapping) {
      resolvedHighlights.push(highlight);
    }
  });

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
      if (type === 'target') return '#AC59FB';
      if (type === 'top') return '#F155A2';
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
