import React, { useMemo } from 'react';
import { tokenizeText } from '../../utils/tokenizer';

interface PositionHighlighterProps {
  text: string;
  brandPositions?: number[];
  competitorPositions?: number[];
  highlightBrand?: boolean;
  highlightCompetitors?: boolean;
  selectionText?: string;
  className?: string;
}

export const PositionHighlighter: React.FC<PositionHighlighterProps> = ({
  text,
  brandPositions = [],
  competitorPositions = [],
  highlightBrand = false,
  highlightCompetitors = false,
  selectionText = '',
  className = '',
}) => {
  const ranges = useMemo(() => {
    const calculatedRanges: { start: number; end: number; type: string }[] = [];

    const normalizedSelection = selectionText.trim();
    if (normalizedSelection.length >= 2) {
      const haystackLower = text.toLocaleLowerCase();
      const needleLower = normalizedSelection.toLocaleLowerCase();
      let searchFrom = 0;

      while (searchFrom < haystackLower.length) {
        const matchIndex = haystackLower.indexOf(needleLower, searchFrom);
        if (matchIndex === -1) break;
        calculatedRanges.push({
          start: matchIndex,
          end: matchIndex + normalizedSelection.length,
          type: 'selection'
        });
        searchFrom = matchIndex + normalizedSelection.length;
      }
    }

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
  }, [text, brandPositions, competitorPositions, highlightBrand, highlightCompetitors, selectionText]);

  const segments = useMemo(() => {
    if (ranges.length === 0) return [];

    const boundarySet = new Set<number>([0, text.length]);
    for (const range of ranges) {
      const start = Math.max(0, Math.min(text.length, range.start));
      const end = Math.max(0, Math.min(text.length, range.end));
      boundarySet.add(start);
      boundarySet.add(end);
    }

    const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

    return boundaries
      .slice(0, -1)
      .map((start, idx) => {
        const end = boundaries[idx + 1];
        if (end <= start) return null;

        const activeTypes = new Set<string>();
        for (const r of ranges) {
          if (r.start < end && r.end > start) {
            activeTypes.add(r.type);
          }
        }
        return { start, end, activeTypes };
      })
      .filter((segment): segment is { start: number; end: number; activeTypes: Set<string> } => segment !== null);
  }, [ranges, text]);

  if (segments.length === 0) {
    return <div className={`whitespace-pre-wrap ${className}`}>{text}</div>;
  }

  const elements = segments.map((segment) => {
    const chunk = text.slice(segment.start, segment.end);
    const hasSelection = segment.activeTypes.has('selection');
    const hasBrand = segment.activeTypes.has('brand');
    const hasCompetitor = segment.activeTypes.has('competitor');

    if (!hasSelection && !hasBrand && !hasCompetitor) {
      return chunk;
    }

    let highlightClassName = '';
    if (hasSelection && hasBrand) {
      highlightClassName = 'bg-yellow-200 text-blue-800 font-medium px-0.5 rounded';
    } else if (hasSelection && hasCompetitor) {
      highlightClassName = 'bg-yellow-200 text-orange-800 font-medium px-0.5 rounded';
    } else if (hasBrand) {
      highlightClassName = 'bg-blue-100 text-blue-800 font-medium px-0.5 rounded';
    } else if (hasCompetitor) {
      highlightClassName = 'bg-orange-100 text-orange-800 font-medium px-0.5 rounded';
    } else if (hasSelection) {
      highlightClassName = 'bg-yellow-200 px-0.5 rounded';
    }

    return (
      <span key={`seg-${segment.start}-${segment.end}`} className={highlightClassName}>
        {chunk}
      </span>
    );
  });

  return <div className={`whitespace-pre-wrap ${className}`}>{elements}</div>;
};
