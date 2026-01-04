import { describe, it, expect } from 'vitest';
import { tokenizeText } from './tokenizer';

describe('tokenizeText', () => {
  it('should tokenize a simple sentence correctly', () => {
    const text = "The quick brown fox";
    const tokens = tokenizeText(text);

    expect(tokens).toHaveLength(4);
    expect(tokens[0]).toEqual({ text: "The", start: 0, end: 3, index: 1 });
    expect(tokens[1]).toEqual({ text: "quick", start: 4, end: 9, index: 2 });
    expect(tokens[2]).toEqual({ text: "brown", start: 10, end: 15, index: 3 });
    expect(tokens[3]).toEqual({ text: "fox", start: 16, end: 19, index: 4 });
  });

  it('should handle punctuation correctly', () => {
    const text = "Hello, world! This is a test.";
    const tokens = tokenizeText(text);

    // "Hello", "world", "This", "is", "a", "test" -> 6 words
    expect(tokens).toHaveLength(6);
    expect(tokens[0].text).toBe("Hello");
    expect(tokens[0].index).toBe(1);
    
    expect(tokens[1].text).toBe("world");
    expect(tokens[1].index).toBe(2);

    expect(tokens[5].text).toBe("test");
    expect(tokens[5].index).toBe(6);
  });

  it('should handle complex characters and apostrophes if regex supports it', () => {
    // Regex is /\b[\p{L}\p{N}’']+\b/gu
    const text = "User's choice: 100% valid.";
    const tokens = tokenizeText(text);

    // Expected: "User's", "choice", "100", "valid"
    // Note: % might split or be ignored depending on regex boundaries, let's see.
    // \b matches word boundaries.
    
    const tokenTexts = tokens.map(t => t.text);
    // "User's" should be one token because of ' inside [\p{L}\p{N}’']
    expect(tokenTexts).toContain("User's");
    expect(tokenTexts).toContain("choice");
    expect(tokenTexts).toContain("100");
    expect(tokenTexts).toContain("valid");
  });

  it('should simulate position highlighting on a collector result', () => {
    const collectorResponse = `
      Based on the analysis, Nike shows strong brand presence. 
      However, Adidas is a key competitor in the running segment.
      Puma also has a smaller market share.
    `;
    
    const tokens = tokenizeText(collectorResponse);
    
    // Let's find indices for "Nike", "Adidas", "Puma"
    const nikeToken = tokens.find(t => t.text === "Nike");
    const adidasToken = tokens.find(t => t.text === "Adidas");
    const pumaToken = tokens.find(t => t.text === "Puma");

    expect(nikeToken).toBeDefined();
    expect(adidasToken).toBeDefined();
    expect(pumaToken).toBeDefined();

    console.log(`Nike index: ${nikeToken?.index}`);
    console.log(`Adidas index: ${adidasToken?.index}`);
    console.log(`Puma index: ${pumaToken?.index}`);

    // Verify that if we highlight these positions, we get the correct words
    const brandPositions = [nikeToken!.index]; // Nike
    const competitorPositions = [adidasToken!.index, pumaToken!.index]; // Adidas, Puma

    const highlightedBrand = tokens.filter(t => brandPositions.includes(t.index)).map(t => t.text);
    const highlightedCompetitor = tokens.filter(t => competitorPositions.includes(t.index)).map(t => t.text);

    expect(highlightedBrand).toEqual(["Nike"]);
    expect(highlightedCompetitor).toEqual(["Adidas", "Puma"]);
  });
});
