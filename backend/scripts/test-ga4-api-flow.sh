#!/bin/bash
# Test the complete GA4 API flow: Save credentials -> Test connection
# This matches what the frontend does

BRAND_ID="test-brand"
CUSTOMER_ID="default-customer"
PROPERTY_ID="516904207"
API_URL="http://localhost:3000/api"

# Read the JSON file
JSON_FILE="C:\\Users\\rakit\\Downloads\\startup-444304-9384d2116ae1.json"
SERVICE_ACCOUNT_KEY=$(cat "$JSON_FILE")

echo "Step 1: Saving GA4 credentials..."
curl -X POST "${API_URL}/brands/${BRAND_ID}/analytics/credentials" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"${CUSTOMER_ID}\",
    \"property_id\": \"${PROPERTY_ID}\",
    \"service_account_key\": ${SERVICE_ACCOUNT_KEY}
  }" | jq '.'

echo ""
echo "Step 2: Testing connection..."
curl -X POST "${API_URL}/brands/${BRAND_ID}/analytics/test-connection?customer_id=${CUSTOMER_ID}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "Done!"





