#!/bin/bash

# Backfill Script: Raw Answer and Scoring Status
# 
# This script runs two backfill operations in sequence:
# 1. Backfills raw_answer from BrightData snapshots for collector_results
# 2. Backfills scoring_status for collector_results based on processing state
#
# Usage:
#   ./backfill-raw-answer-and-scoring-status.sh
#   or
#   bash backfill-raw-answer-and-scoring-status.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}🚀 Starting Backfill Process${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Step 1: Backfill raw_answer from BrightData snapshots
echo -e "${YELLOW}📝 Step 1: Backfilling raw_answer from BrightData snapshots...${NC}"
echo -e "${YELLOW}   This will update collector_results where raw_answer IS NULL${NC}"
echo -e "${YELLOW}   and brightdata_snapshot_id IS NOT NULL${NC}"
echo ""

if npx ts-node --transpile-only src/scripts/backfill-raw-answer-from-snapshots.ts; then
    echo ""
    echo -e "${GREEN}✅ Step 1 completed successfully${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Step 1 failed. Exiting without running Step 2.${NC}"
    echo -e "${RED}   Please fix any errors and run the script again.${NC}"
    exit 1
fi

# Step 2: Backfill scoring_status
echo -e "${YELLOW}📝 Step 2: Backfilling scoring_status...${NC}"
echo -e "${YELLOW}   This will update collector_results where scoring_status IS NULL${NC}"
echo -e "${YELLOW}   based on whether they have been fully processed${NC}"
echo ""

if npx ts-node --transpile-only src/scripts/backfill-scoring-status.ts; then
    echo ""
    echo -e "${GREEN}✅ Step 2 completed successfully${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Step 2 failed.${NC}"
    echo -e "${RED}   Step 1 completed successfully, but Step 2 encountered errors.${NC}"
    exit 1
fi

# Final summary
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}✅ Backfill Process Complete!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${GREEN}Both backfill operations completed successfully:${NC}"
echo -e "  1. ✅ Raw answer backfill from BrightData snapshots"
echo -e "  2. ✅ Scoring status backfill"
echo ""



