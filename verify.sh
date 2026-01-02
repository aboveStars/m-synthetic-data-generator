#!/bin/bash
# Verification script to test all commands from README.md
# This ensures users can run the app without errors

set -e  # Exit on any error

echo "🧪 Testing Synthetic Data Generator Setup"
echo "=========================================="
echo ""

# Test 1: Check if dependencies are installed
echo "✓ Step 1: Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install
fi
echo "  Dependencies OK"
echo ""

# Test 2: Build the project
echo "✓ Step 2: Building project..."
npm run build > /dev/null 2>&1
echo "  Build OK"
echo ""

# Test 3: Run tests
echo "✓ Step 3: Running tests..."
npm test -- --run > /dev/null 2>&1
echo "  All tests passed"
echo ""

# Test 4: CLI help
echo "✓ Step 4: Testing CLI help..."
npm run generate -- --help > /dev/null 2>&1
echo "  CLI help OK"
echo ""

# Test 5: Dry run
echo "✓ Step 5: Testing dry-run generation..."
npm run generate -- --schema ./examples/schema.prisma --count 10 --dry-run > /dev/null 2>&1
echo "  Dry-run OK"
echo ""

# Test 6: JSON output
echo "✓ Step 6: Testing JSON output..."
npm run generate -- --schema ./examples/schema.prisma --count 5 --output ./verify-test.json > /dev/null 2>&1
if [ ! -f "./verify-test.json" ]; then
  echo "  ❌ JSON file not created"
  exit 1
fi
rm -f ./verify-test.json
echo "  JSON output OK"
echo ""

# Test 7: SQL output
echo "✓ Step 7: Testing SQL output..."
npm run generate -- --schema ./examples/schema.prisma --count 5 --format sql --output ./verify-test.sql > /dev/null 2>&1
if [ ! -f "./verify-test.sql" ]; then
  echo "  ❌ SQL file not created"
  exit 1
fi
rm -f ./verify-test.sql
echo "  SQL output OK"
echo ""

# Test 8: Config file
echo "✓ Step 8: Testing config file..."
npm run generate -- --config ./examples/config.json --dry-run > /dev/null 2>&1
echo "  Config file OK"
echo ""

echo "=========================================="
echo "✅ All tests passed successfully!"
echo ""
echo "You can now use the synthetic data generator:"
echo "  npm run generate -- --schema ./examples/schema.prisma --count 100"
echo ""
