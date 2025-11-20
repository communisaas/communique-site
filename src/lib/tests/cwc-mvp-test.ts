import { cwcClient } from '$lib/core/congress/cwc-client';
import { getRepresentativesForAddress } from '$lib/core/congress/address-lookup';

/**
 * Test script for CWC MVP submission endpoint
 * Run this to verify the submission flow works end-to-end
 */

async function testCWCSubmission() {
	console.log('🧪 Testing CWC MVP submission flow...');

	// Test address (Cambridge, MA - Elizabeth Warren's office)
	const testAddress = {
		street: '1 Harvard Square',
		city: 'Cambridge',
		state: 'MA',
		zip: '02138'
	};

	const testTemplate = {
		id: 'test-template-123',
		title: 'Test Message to Congress',
		message_body: 'This is a test message for the CWC hackathon demo.',
		slug: 'test-message'
	};

	const testUser = {
		id: 'test-user-123',
		name: 'Test User',
		email: 'test@example.com',
		street: testAddress.street,
		city: testAddress.city,
		state: testAddress.state,
		zip: testAddress.zip
	};

	try {
		// Step 1: Get representatives for address
		console.log('📍 Looking up representatives for address:', testAddress);
		const representatives = await getRepresentativesForAddress(testAddress);

		if (!representatives || representatives.length === 0) {
			console.error('❌ No representatives found for address');
			return;
		}

		console.log(
			'✅ Found representatives:',
			representatives.map((r) => ({
				name: r.name,
				chamber: r.chamber,
				state: r.state,
				district: r.district
			}))
		);

		// Step 2: Test Senate submission
		const senators = representatives.filter((r) => r.chamber === 'senate');
		if (senators.length > 0) {
			console.log('🏛️ Testing Senate submission to:', senators[0].name);
			const senateResult = await cwcClient.submitToSenate(
				testTemplate,
				testUser,
				senators[0],
				testTemplate.message_body
			);
			console.log('✅ Senate result:', senateResult);
		}

		// Step 3: Test House submission
		const houseReps = representatives.filter((r) => r.chamber === 'house');
		if (houseReps.length > 0) {
			console.log('🏛️ Testing House submission to:', houseReps[0].name);
			const houseResult = await cwcClient.submitToHouse(
				testTemplate,
				testUser,
				houseReps[0],
				testTemplate.message_body
			);
			console.log('✅ House result:', houseResult);
		}

		// Step 4: Test batch submission
		console.log('📤 Testing batch submission to all representatives...');
		const batchResults = await cwcClient.submitToAllRepresentatives(
			testTemplate,
			testUser,
			representatives,
			testTemplate.message_body
		);
		console.log('✅ Batch results:', batchResults);

		console.log('🎉 CWC MVP test completed successfully!');
	} catch (error) {
		console.error('❌ CWC MVP test failed:', error);
	}
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	testCWCSubmission();
}

export { testCWCSubmission };
