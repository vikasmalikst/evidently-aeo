
export const generateSynonyms = (name: string, url?: string): string[] => {
    const synonyms = new Set<string>();

    // 1. Brand Name (e.g. "On the Beach")
    if (name) {
        const cleanName = name.trim();
        synonyms.add(cleanName);

        // 1b. Strip common legal suffixes (e.g. "On the Beach Group plc" -> "On the Beach")
        const legalSuffixes = [
            /\s+Group\s+plc/i,
            /\s+plc/i,
            /\s+Ltd/i,
            /\s+Limited/i,
            /\s+Inc/i,
            /\s+Incorporated/i,
            /\s+Corp/i,
            /\s+Corporation/i,
            /\s+SA/i,
            /\s+AG/i,
            /\s+S\.p\.A\./i,
            /\s+NV/i
        ];

        let baseName = cleanName;
        let stripped = false;
        for (const suffix of legalSuffixes) {
            if (suffix.test(baseName)) {
                baseName = baseName.replace(suffix, '').trim();
                stripped = true;
                break;
            }
        }

        if (stripped && baseName && baseName !== cleanName) {
            synonyms.add(baseName);
        }
    }

    // 2. Shortforms / Initials (e.g. "OTB")
    if (name) {
        const initials = name.split(/\s+/).map(w => w[0]).join('').toUpperCase();
        if (initials.length > 1 && initials.length < 6) {
            synonyms.add(initials);
        }
    }

    // 3. Name without Spaces (e.g. "OnTheBeach")
    if (name) {
        const noSpaces = name.replace(/\s+/g, '');
        if (noSpaces !== name) {
            synonyms.add(noSpaces);
        }
    }

    // 4. Website Domain (e.g. "www.onthebeach.com", "onthebeach.com")
    if (url) {
        try {
            // Remove protocol
            const cleanUrl = url.replace(/(^\w+:|^)\/\//, '').replace(/\/$/, '');
            synonyms.add(cleanUrl); // "www.onthebeach.co.uk"

            // Also add domain without www if present
            if (cleanUrl.startsWith('www.')) {
                synonyms.add(cleanUrl.replace('www.', ''));
            }
        } catch (e) {
            // ignore invalid urls
        }
    }

    return Array.from(synonyms);
};
