#!/bin/bash

# Set environment to development
export NODE_ENV=development

# Check if DATABASE_URL was provided as an argument
if [ "$1" ]; then
  export DATABASE_URL="$1"
  echo "Using provided DATABASE_URL"
else
  echo "No DATABASE_URL provided. Using default if available in environment."
fi

echo "Running commission splits test..."

# Run the script directly in the current directory
cd "$(dirname "$0")"
npx tsx ./test-commission-splits.ts

echo "Test completed." 