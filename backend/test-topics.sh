#!/bin/bash

# Topics Page Data Comparison Test Script
# Compares legacy vs optimized schema for Topics page

echo "🧪 Running Topics Page Data Comparison Test..."
echo ""

cd "$(dirname "$0")"

# Run the TypeScript test script
npx ts-node src/scripts/test-topics-comparison.ts

