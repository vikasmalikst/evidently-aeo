
const content = `{"version":"5.0","brandName":"Magnet Kitchens Limited","contentTitle":"Fitted Kitchen Prices UK 2026 – What to Expect & How Magnet Delivers Value","content":"# Magnet Kitchens Limited: A 2026 Strategic Guide to Fitted Kitchen Prices\\n\\n## Unlocking the Secrets of Fitted Kitchen Prices in 2026\\n> Magnet’s Kitchen Limited, a leading UK fitted kitchen supplier, delivers high-quality, affordable kitchens across the country. With over 30 years of experience, the company supplies custom cabinets, appliances and design services to homeowners and builders, positioning itself as a trusted partner in the UK market. Its extensive showroom network and online tools further support customers.\\n\\n## The Evolving Landscape of UK Fitted Kitchens in 2026\\nRecent shifts in Feb 2026 show a 12% rise in demand for eco-friendly cabinetry..."}`;

function normalize(content) {
    if (!content) return '';

    let processed = content;

    // 1. Ensure initial string state or handle object
    if (typeof processed !== 'string') {
        try {
            processed = JSON.stringify(processed);
        } catch (e) {
            processed = String(processed);
        }
    }

    const safeTrim = (str) => (typeof str === 'string' ? str.trim() : '');

    // 2. Unwrap double-quoted strings
    if (safeTrim(processed).startsWith('"') && safeTrim(processed).endsWith('"')) {
        try {
            const parsed = JSON.parse(safeTrim(processed));
            if (typeof parsed === 'string') processed = parsed;
        } catch (e) { }
    }

    // 3. Extract 'content' field from JSON objects
    if (typeof processed === 'string' && safeTrim(processed).startsWith('{')) {
        try {
            console.log('Attempting to parse JSON...');
            const parsed = JSON.parse(processed);
            console.log('Parsed keys:', Object.keys(parsed));
            if (parsed.content) console.log('Found content field');

            if (parsed && typeof parsed === 'object' && parsed.content && typeof parsed.content === 'string') {
                console.log('Extraction success!');
                processed = parsed.content;
            } else {
                console.log('Extraction condition failed');
                if (!parsed) console.log('!parsed');
                if (typeof parsed !== 'object') console.log('not object');
                if (!parsed.content) console.log('no content field');
                if (typeof parsed.content !== 'string') console.log('content not string:', typeof parsed.content);
            }
        } catch (e) {
            console.log('JSON parse failed:', e.message);
            const contentMatch = processed.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (contentMatch) {
                processed = contentMatch[1];
            }
        }
    }

    // 4. Final safety check before string operations
    if (typeof processed !== 'string') {
        processed = String(processed);
    }

    // Handle escaped newlines
    processed = processed
        .replace(/\\\\n/g, '\n')
        .replace(/\\n/g, '\n');

    // Strip leading H1 title
    processed = processed.replace(/^#\s+.+\n+/, '').trim();

    return processed;
}

const result = normalize(content);
console.log('--- RESULT START ---');
console.log(result.slice(0, 100));
console.log('--- RESULT END ---');

const objectInput = JSON.parse(content);
const resultObj = normalize(objectInput);
console.log('--- OBJECT INPUT RESULT START ---');
console.log(resultObj.slice(0, 100));
console.log('--- OBJECT INPUT RESULT END ---');
