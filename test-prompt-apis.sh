#!/bin/bash

# Prompt Management API Testing Script
# Usage: ./test-prompt-apis.sh

echo "🧪 Prompt Management API Testing Script"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"

# Check if TOKEN is set
if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Error: TOKEN environment variable not set${NC}"
  echo "Please set your JWT token:"
  echo "  export TOKEN='your-jwt-token-here'"
  exit 1
fi

# Check if BRAND_ID is set
if [ -z "$BRAND_ID" ]; then
  echo -e "${RED}❌ Error: BRAND_ID environment variable not set${NC}"
  echo "Please set your brand ID:"
  echo "  export BRAND_ID='your-brand-id'"
  exit 1
fi

echo -e "${BLUE}API URL:${NC} $API_URL"
echo -e "${BLUE}Brand ID:${NC} $BRAND_ID"
echo ""

# Test 1: Get Active Prompts
echo -e "${YELLOW}Test 1: Get Active Prompts${NC}"
echo "GET /api/brands/$BRAND_ID/prompts/manage"
RESPONSE=$(curl -s -X GET \
  "$API_URL/api/brands/$BRAND_ID/prompts/manage" \
  -H "Authorization: Bearer $TOKEN")

SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
  TOTAL_PROMPTS=$(echo $RESPONSE | jq -r '.data.summary.totalPrompts')
  TOTAL_TOPICS=$(echo $RESPONSE | jq -r '.data.summary.totalTopics')
  CURRENT_VERSION=$(echo $RESPONSE | jq -r '.data.currentVersion')
  echo -e "${GREEN}✅ Success!${NC}"
  echo "   Total Prompts: $TOTAL_PROMPTS"
  echo "   Total Topics: $TOTAL_TOPICS"
  echo "   Current Version: $CURRENT_VERSION"
else
  ERROR=$(echo $RESPONSE | jq -r '.error')
  echo -e "${RED}❌ Failed: $ERROR${NC}"
fi
echo ""

# Test 2: Get Version History
echo -e "${YELLOW}Test 2: Get Version History${NC}"
echo "GET /api/brands/$BRAND_ID/prompts/versions"
RESPONSE=$(curl -s -X GET \
  "$API_URL/api/brands/$BRAND_ID/prompts/versions" \
  -H "Authorization: Bearer $TOKEN")

SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
  VERSION_COUNT=$(echo $RESPONSE | jq -r '.data.versions | length')
  CURRENT_VERSION=$(echo $RESPONSE | jq -r '.data.currentVersion')
  echo -e "${GREEN}✅ Success!${NC}"
  echo "   Total Versions: $VERSION_COUNT"
  echo "   Current Version: $CURRENT_VERSION"
  
  if [ "$VERSION_COUNT" -gt 0 ]; then
    echo "   Versions:"
    echo $RESPONSE | jq -r '.data.versions[] | "     v\(.version) - \(.changeType) - \(.changeSummary // "No summary")"'
  fi
else
  ERROR=$(echo $RESPONSE | jq -r '.error')
  echo -e "${RED}❌ Failed: $ERROR${NC}"
fi
echo ""

# Test 3: Add a Test Prompt
echo -e "${YELLOW}Test 3: Add a Test Prompt${NC}"
echo "POST /api/brands/$BRAND_ID/prompts"
RESPONSE=$(curl -s -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What are your API rate limits? (TEST PROMPT - IGNORE)",
    "topic": "API Testing"
  }')

SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
  PROMPT_ID=$(echo $RESPONSE | jq -r '.data.promptId')
  echo -e "${GREEN}✅ Success!${NC}"
  echo "   New Prompt ID: $PROMPT_ID"
else
  ERROR=$(echo $RESPONSE | jq -r '.error')
  echo -e "${RED}❌ Failed: $ERROR${NC}"
fi
echo ""

# Test 4: Calculate Impact
echo -e "${YELLOW}Test 4: Calculate Impact of Adding 2 Prompts${NC}"
echo "POST /api/brands/$BRAND_ID/prompts/calculate-impact"
RESPONSE=$(curl -s -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/calculate-impact" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "added": [
        {"text": "Test prompt 1", "topic": "Testing"},
        {"text": "Test prompt 2", "topic": "Testing"}
      ],
      "removed": [],
      "edited": []
    }
  }')

SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
  CURRENT_COV=$(echo $RESPONSE | jq -r '.data.estimatedImpact.coverage.current')
  PROJECTED_COV=$(echo $RESPONSE | jq -r '.data.estimatedImpact.coverage.projected')
  CHANGE=$(echo $RESPONSE | jq -r '.data.estimatedImpact.coverage.change')
  echo -e "${GREEN}✅ Success!${NC}"
  echo "   Coverage Impact:"
  echo "     Current: $CURRENT_COV"
  echo "     Projected: $PROJECTED_COV"
  echo "     Change: +$CHANGE"
  
  WARNING_COUNT=$(echo $RESPONSE | jq -r '.data.estimatedImpact.warnings | length')
  if [ "$WARNING_COUNT" -gt 0 ]; then
    echo "   Warnings:"
    echo $RESPONSE | jq -r '.data.estimatedImpact.warnings[] | "     - \(.)"'
  fi
else
  ERROR=$(echo $RESPONSE | jq -r '.error')
  echo -e "${RED}❌ Failed: $ERROR${NC}"
fi
echo ""

# Test 5: Apply Batch Changes (if no versions exist)
if [ "$VERSION_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}Test 5: Create Initial Version${NC}"
  echo "POST /api/brands/$BRAND_ID/prompts/batch"
  RESPONSE=$(curl -s -X POST \
    "$API_URL/api/brands/$BRAND_ID/prompts/batch" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "changes": {
        "added": [],
        "removed": [],
        "edited": []
      },
      "changeSummary": "Initial version (created by test script)"
    }')

  SUCCESS=$(echo $RESPONSE | jq -r '.success')
  if [ "$SUCCESS" == "true" ]; then
    NEW_VERSION=$(echo $RESPONSE | jq -r '.data.newVersion')
    CONFIG_ID=$(echo $RESPONSE | jq -r '.data.configurationId')
    echo -e "${GREEN}✅ Success!${NC}"
    echo "   New Version: $NEW_VERSION"
    echo "   Configuration ID: $CONFIG_ID"
  else
    ERROR=$(echo $RESPONSE | jq -r '.error')
    echo -e "${RED}❌ Failed: $ERROR${NC}"
  fi
  echo ""
else
  echo -e "${BLUE}ℹ️  Skipping version creation (versions already exist)${NC}"
  echo ""
fi

# Summary
echo "========================================"
echo -e "${GREEN}🎉 Testing Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Check if all tests passed (✅)"
echo "  2. Review the output above for any errors"
echo "  3. Run SQL verification queries (see test-backend-setup.sql)"
echo "  4. Check backend logs for any issues"
echo ""
echo "For detailed testing guide, see: TEST_BACKEND_APIS.md"

