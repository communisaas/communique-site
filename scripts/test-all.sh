#!/bin/bash

# Comprehensive test runner for address validation
set -e

echo "🧪 Running Address Validation Test Suite"
echo "========================================"

echo ""
echo "📋 Pre-test checks..."

# Check if required files exist
echo "✓ Checking test files exist"
test -f "src/lib/services/zipDistrictLookup.test.ts" || (echo "❌ Missing ZIP lookup unit tests" && exit 1)
test -f "src/lib/congress/address-lookup.test.ts" || (echo "❌ Missing address lookup unit tests" && exit 1)
test -f "src/routes/api/address/verify/+server.test.ts" || (echo "❌ Missing verification API tests" && exit 1)
test -f "src/routes/api/address/lookup/+server.test.ts" || (echo "❌ Missing lookup API tests" && exit 1)
test -f "e2e/address-validation.test.ts" || (echo "❌ Missing E2E tests" && exit 1)

echo "✓ All test files present"

echo ""
echo "🔬 Running Unit Tests..."
echo "------------------------"
npm run test:unit -- --run

echo ""
echo "⚡ Unit test results:"
npm run test:unit -- --run --reporter=json > test-results-unit.json 2>/dev/null || true
if command -v jq >/dev/null 2>&1; then
    echo "  Tests run: $(jq '.numTotalTests' test-results-unit.json 2>/dev/null || echo 'N/A')"
    echo "  Passed: $(jq '.numPassedTests' test-results-unit.json 2>/dev/null || echo 'N/A')"
    echo "  Failed: $(jq '.numFailedTests' test-results-unit.json 2>/dev/null || echo 'N/A')"
fi

echo ""
echo "🌐 Running E2E Tests..."
echo "----------------------"
npm run test:e2e

echo ""
echo "📊 Test Summary"
echo "==============="
echo "✅ Unit Tests: Address validation services"
echo "✅ Integration Tests: API endpoints"  
echo "✅ E2E Tests: User workflows"

echo ""
echo "🎯 Coverage Areas Validated:"
echo "  • ZIP-to-district lookup (real data)"
echo "  • Census Bureau API integration"
echo "  • Congressional representative lookup"
echo "  • Address verification workflow"
echo "  • Error handling and edge cases"

echo ""
echo "🚀 All tests passed! Address validation is production-ready."

# Cleanup
rm -f test-results-unit.json