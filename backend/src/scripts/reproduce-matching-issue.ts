
// Validating the fix with Longest Match First logic
class PositionExtractionFixValidation {
    public tokenizeWords(text: string): { tokens: string[]; normalizedTokens: string[] } {
        const matches = text.match(/\b[\p{L}\p{N}’']+\b/gu);
        if (!matches) {
            return { tokens: [], normalizedTokens: [] };
        }

        const tokens = matches.map(token => token);
        const normalizedTokens = tokens.map(token =>
            this.normalizeWord(token)
        );

        return { tokens, normalizedTokens };
    }

    private normalizeWord(word: string): string {
        return word
            .toLowerCase()
            .replace(/^[’']+/u, '')
            .replace(/[’']+$/u, '')
            .replace(/’s$|s’$/u, '')
            .replace(/['’]s$/u, '');
    }

    private normalizeTerm(term: string): string[] {
        const matches = term.match(/\b[\p{L}\p{N}’']+\b/gu);
        if (!matches) {
            return [];
        }
        return matches.map(word => this.normalizeWord(word));
    }

    private findTermPositions(tokens: string[], termTokens: string[]): number[] {
        if (termTokens.length === 0 || tokens.length === 0) {
            return [];
        }

        const positions: number[] = [];
        const termLength = termTokens.length;

        for (let i = 0; i <= tokens.length - termLength; i++) {
            let match = true;
            for (let j = 0; j < termLength; j++) {
                if (tokens[i + j] !== termTokens[j]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                positions.push(i + 1); // 1-indexed
            }
        }

        return positions;
    }

    public calculateWordPositionsWithFix(
        terms: string[],
        rawAnswer: string
    ): void {
        const { tokens, normalizedTokens } = this.tokenizeWords(rawAnswer);
        console.log(`Text: "${rawAnswer}"`);
        console.log("Tokens:", normalizedTokens);

        // Step 1: Gather matches
        interface ValidatedMatch {
            term: string;
            start: number;
            end: number;
            length: number;
        }

        const allMatches: ValidatedMatch[] = [];

        for (const term of terms) {
            const normalizedTerm = this.normalizeTerm(term);
            const positions = this.findTermPositions(normalizedTokens, normalizedTerm);

            positions.forEach(pos => {
                allMatches.push({
                    term,
                    start: pos,
                    end: pos + normalizedTerm.length - 1,
                    length: normalizedTerm.length
                });
            });
        }

        // Step 2: Sort by length descending
        allMatches.sort((a, b) => b.length - a.length);

        // Step 3: Resolve overlaps
        const occupiedIndices = new Set<number>();
        const acceptedMatches: ValidatedMatch[] = [];

        for (const match of allMatches) {
            let isOccupied = false;
            for (let i = match.start; i <= match.end; i++) {
                if (occupiedIndices.has(i)) {
                    isOccupied = true;
                    break;
                }
            }

            if (!isOccupied) {
                acceptedMatches.push(match);
                for (let i = match.start; i <= match.end; i++) {
                    occupiedIndices.add(i);
                }
                console.log(`✅ Accepted match: "${match.term}" at [${match.start}-${match.end}]`);
            } else {
                console.log(`🚫 Rejected overlapping match: "${match.term}" at [${match.start}-${match.end}]`);
            }
        }

        // Validation check
        const acceptedTerms = acceptedMatches.map(m => m.term);
        if (acceptedTerms.includes("Super Bowl") && !acceptedTerms.includes("Super")) {
            console.log("\nSUCCESS: 'Super Bowl' accepted, overlapping 'Super' rejected.");
        } else {
            console.log("\nFAILURE: Logic invalid.");
        }
        if (acceptedTerms.includes("super")) { // The second "super" in text
            console.log("SUCCESS: Standalone 'super' accepted.");
        }
    }

    public runTest() {
        const text = "The Super Bowl is a super event.";
        const terms = ["Super", "Super Bowl"];

        this.calculateWordPositionsWithFix(terms, text);
    }
}

new PositionExtractionFixValidation().runTest();
