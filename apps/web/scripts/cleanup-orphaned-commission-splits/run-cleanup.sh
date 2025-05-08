#!/bin/bash

# Script to run the orphaned CommissionSplit cleanup utility
# Created to make it easier to execute the TypeScript script

# Change to the web app directory
cd "$(dirname "$0")/../.."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}RefList Database Maintenance Utility${NC}"
echo "Orphaned CommissionSplit Cleanup"
echo "--------------------------------"

# Check if --confirm flag is passed
if [[ "$*" == *--confirm* ]]; then
  echo -e "${RED}WARNING: Running in DELETION mode!${NC}"
  echo "Orphaned CommissionSplit records will be permanently deleted."
  
  # Ask for confirmation
  read -p "Are you sure you want to proceed with deletion? (y/N): " confirm
  if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "Operation canceled."
    exit 0
  fi
  
  echo "Proceeding with deletion..."
else
  echo -e "${GREEN}Running in DRY RUN mode.${NC}"
  echo "No records will be modified. Use --confirm to perform actual deletion."
fi

# Run the TypeScript script with all passed arguments
npx ts-node scripts/cleanup-orphaned-commission-splits.ts $@

# Show advice after running
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. If orphaned records were found, run with --confirm to clean them up"
echo "2. Consider updating your phone verification endpoint with the latest code"
echo "   to handle null commission references properly"
echo "" 