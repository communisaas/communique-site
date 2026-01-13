import { processDecisionMakers } from '../src/lib/utils/decision-maker-processing';

function main() {
	console.log('Testing processDecisionMakers logic...');

	const mockInput = [
		{
			name: 'Test Person 1',
			title: 'Director',
			organization: 'Org A',
			provenance: 'Old provenance with source: http://legacy-url.com',
			reasoning: 'New reasoning',
			source_url: 'https://new-url.com' // Should be prioritized
		},
		{
			name: 'Test Person 2',
			title: 'Manager',
			organization: 'Org B',
			provenance: 'Legacy provenance only. Source: http://legacy-only.com'
			// No source_url field
		},
		{
			name: 'Test Person 3',
			title: 'VP',
			organization: 'Org C',
			// No provenance either
			source_url: 'https://explicit-url.com'
		}
	];

	const processed = processDecisionMakers(mockInput);

	// Test 1: Prioritization
	if (processed[0].source === 'https://new-url.com') {
		console.log('✅ Test 1 Passed: source_url prioritized over provenance extraction.');
	} else {
		console.error("❌ Test 1 Failed: Expected 'https://new-url.com', got", processed[0].source);
		process.exit(1);
	}

	// Test 2: Fallback
	if (processed[1].source === 'http://legacy-only.com') {
		console.log('✅ Test 2 Passed: Fallback to extraction working.');
	} else {
		console.error("❌ Test 2 Failed: Expected 'http://legacy-only.com', got", processed[1].source);
		process.exit(1);
	}

	// Test 3: Explicit only
	if (processed[2].source === 'https://explicit-url.com') {
		console.log('✅ Test 3 Passed: Explicit source_url works without provenance.');
	} else {
		console.error(
			"❌ Test 3 Failed: Expected 'https://explicit-url.com', got",
			processed[2].source
		);
		process.exit(1);
	}

	console.log('All tests passed!');
}

main();
