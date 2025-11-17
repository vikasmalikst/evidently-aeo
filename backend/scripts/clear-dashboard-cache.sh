#!/bin/bash
# Script to clear dashboard cache for troubleshooting

echo "Clearing dashboard cache..."
psql $DATABASE_URL -f backend/scripts/clear-dashboard-cache.sql
echo "Cache cleared!"
