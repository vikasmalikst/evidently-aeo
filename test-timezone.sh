#!/bin/bash

echo "Testing timezone fix..."
echo "Current local time: $(date)"
echo "Current UTC time: $(date -u)"
echo ""
echo "Making API request with timezoneOffset=300 (EST)..."
echo ""

# Make the API call and save response
RESPONSE=$(curl -s "http://localhost:3000/api/brands/583be119-67da-47bb-8a29-2950eb4da3ea/dashboard?startDate=2026-01-14T05:00:00.000Z&endDate=2026-01-21T04:59:59.999Z&timezoneOffset=300")

# Check if response is valid JSON
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    echo "✅ API Response received"
    
    # Extract dates from timeSeries
    DATES=$(echo "$RESPONSE" | jq -r '.data.llmVisibility[0].timeSeries.dates // []')
    
    if [ "$DATES" != "[]" ] && [ "$DATES" != "null" ]; then
        FIRST_DATE=$(echo "$DATES" | jq -r '.[0]')
        LAST_DATE=$(echo "$DATES" | jq -r '.[-1]')
        DATE_COUNT=$(echo "$DATES" | jq 'length')
        
        echo "First date: $FIRST_DATE"
        echo "Last date: $LAST_DATE"
        echo "Total dates: $DATE_COUNT"
        echo ""
        
        if [ "$LAST_DATE" == "2026-01-20" ]; then
            echo "✅ PASS: Last date is 2026-01-20 (local date in EST)"
        elif [ "$LAST_DATE" == "2026-01-21" ]; then
            echo "❌ FAIL: Last date is 2026-01-21 (UTC date, timezone fix not working)"
        else
            echo "⚠️  UNEXPECTED: Last date is $LAST_DATE"
        fi
    else
        echo "❌ No timeSeries dates found in response"
        echo "Response structure:"
        echo "$RESPONSE" | jq '.data | keys'
    fi
else
    echo "❌ Invalid JSON response or API error"
    echo "Response: $RESPONSE"
fi
