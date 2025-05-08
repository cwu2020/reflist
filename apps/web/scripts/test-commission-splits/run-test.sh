#!/bin/bash

# Set environment to development
export NODE_ENV=development

echo "Running commission splits test..."

# Run the script directly in the current directory
cd "$(dirname "$0")"
npx tsx ./test-commission-splits.ts

echo "Test completed." 