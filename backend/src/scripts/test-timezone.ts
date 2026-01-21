// Test timezone offset logic
const timezoneOffset = 300; // EST is UTC-5, so 300 minutes

// Simulate the current UTC time (Jan 21 at 04:42 UTC)
const endIsoBound = "2026-01-21T04:59:59.999Z";
const startIsoBound = "2026-01-14T05:00:00.000Z";

console.log("Testing timezone offset logic:");
console.log("Timezone offset (minutes):", timezoneOffset);
console.log("UTC end bound:", endIsoBound);

// Apply the fix
const endDate = new Date(endIsoBound);
const localEnd = new Date(endDate.getTime() - (timezoneOffset * 60 * 1000));
const endDateStr = localEnd.toISOString().split('T')[0];

console.log("UTC end date object:", endDate.toISOString());
console.log("Local end date object:", localEnd.toISOString());
console.log("Extracted end date (YYYY-MM-DD):", endDateStr);
console.log("");

// Do the same for start
const startDate = new Date(startIsoBound);
const localStart = new Date(startDate.getTime() - (timezoneOffset * 60 * 1000));
const startDateStr = localStart.toISOString().split('T')[0];

console.log("UTC start date:", startDateStr);
console.log("Local start date:", startDateStr);
console.log("");

// Generate date range
const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const [startYear, startMonth, startDay] = start.split('-').map(Number);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);

    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const endUTC = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    while (current <= endUTC) {
        dates.push(current.toISOString().split('T')[0]);
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
};

const dates = generateDateRange(startDateStr, endDateStr);
console.log("Generated date range:");
console.log("First 3 dates:", dates.slice(0, 3));
console.log("Last 3 dates:", dates.slice(-3));
console.log("Total dates:", dates.length);
console.log("");
console.log("Expected last date: 2026-01-20 (local date in EST)");
console.log("Actual last date:", dates[dates.length - 1]);
console.log("Match:", dates[dates.length - 1] === "2026-01-20" ? "✅ PASS" : "❌ FAIL");
