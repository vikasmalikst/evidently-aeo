import React, { useMemo } from 'react';
import { tokenizeText } from '../../utils/tokenizer';

interface PositionHighlighterProps {
  text: string;
  brandPositions?: number[];
  competitorPositions?: number[];
  highlightBrand?: boolean;
  highlightCompetitors?: boolean;
  className?: string;
}

export const PositionHighlighter: React.FC<PositionHighlighterProps> = ({
  text,
  brandPositions = [],
  competitorPositions = [],
  highlightBrand = false,
  highlightCompetitors = false,
  className = '',
}) => {
  const ranges = useMemo(() => {
    const calculatedRanges: { start: number; end: number; type: string }[] = [];

    // Position-based ranges
    if ((highlightBrand && brandPositions.length > 0) || (highlightCompetitors && competitorPositions.length > 0)) {
      const tokens = tokenizeText(text);
      const brandPosSet = new Set(brandPositions);
      const compPosSet = new Set(competitorPositions);

      tokens.forEach(token => {
        if (highlightBrand && brandPosSet.has(token.index)) {
          calculatedRanges.push({ start: token.start, end: token.end, type: 'brand' });
        } else if (highlightCompetitors && compPosSet.has(token.index)) {
          calculatedRanges.push({ start: token.start, end: token.end, type: 'competitor' });
        }
      });
    }

    return calculatedRanges;
  }, [text, brandPositions, competitorPositions, highlightBrand, highlightCompetitors]);

  // Resolve overlaps
  const resolvedRanges = useMemo(() => {
    const priorityOf = (type: string) => {
      if (type === 'brand') return 4; // Position-based matches are highest confidence
      if (type === 'competitor') return 4;
      return 0;
    };

    const sorted = ranges.slice().sort((a, b) => {
      const pr = priorityOf(b.type) - priorityOf(a.type);
      if (pr !== 0) return pr;
      const lenDiff = (b.end - b.start) - (a.end - a.start);
      if (lenDiff !== 0) return lenDiff;
      return a.start - b.start;
    });

    const result: { start: number; end: number; type: string }[] = [];
    const intersects = (x: { start: number; end: number }, y: { start: number; end: number }) =>
      !(x.end <= y.start || x.start >= y.end);

    for (const h of sorted) {
      if (!result.some(r => intersects(h, r))) {
        result.push(h);
      }
    }
    return result.sort((a, b) => a.start - b.start);
  }, [ranges]);

  if (resolvedRanges.length === 0) {
    return <div className={`whitespace-pre-wrap ${className}`}>{text}</div>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  resolvedRanges.forEach((range, i) => {
    if (range.start > lastIndex) {
      elements.push(text.slice(lastIndex, range.start));
    }

    const chunk = text.slice(range.start, range.end);
    if (range.type === 'brand') {
       elements.push(<span key={`r-${i}`} className="bg-blue-100 text-blue-800 font-medium px-0.5 rounded">{chunk}</span>);
    } else if (range.type === 'competitor') {
       elements.push(<span key={`r-${i}`} className="bg-orange-100 text-orange-800 font-medium px-0.5 rounded">{chunk}</span>);
    } else {
       elements.push(chunk);
    }
    
    lastIndex = range.end;
  });

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return <div className={`whitespace-pre-wrap ${className}`}>{elements}</div>;
};
