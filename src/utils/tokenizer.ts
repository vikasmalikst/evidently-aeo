// Replicates the backend tokenization logic from position-extraction.service.ts
// Regex: /\b[\p{L}\p{N}’']+\b/gu

export interface Token {
  text: string;
  start: number;
  end: number;
  index: number; // 1-based index to match backend
}

export const tokenizeText = (text: string): Token[] => {
  if (!text) return [];

  // Backend regex: /\b[\p{L}\p{N}’']+\b/gu
  const regex = /\b[\p{L}\p{N}’']+\b/gu;
  const tokens: Token[] = [];
  let match;
  let index = 1; // Start at 1 to match backend 1-based indexing

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: regex.lastIndex,
      index: index++
    });
  }

  return tokens;
};
