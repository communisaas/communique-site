/**
 * API Test for CWC MVP Endpoints
 * 
 * Test the new /api/cwc/submit-mvp and /api/cwc/jobs/[jobId] endpoints
 */

async function testCWCApiEndpoints() {
	console.log('🧪 Testing CWC MVP API endpoints...');

	// Test data
	const testData = {
		templateId: 'test-template-123',
		address: {
			street: '1 Harvard Square',
			city: 'Cambridge',
			state: 'MA',
			zip: '02138'
		},
		personalizedMessage: 'This is a test message for the CWC hackathon demo.',
		userEmail: 'test@example.com',
		userName: 'Test User'
	};

	try {
		// Test 1: Submit MVP endpoint
		console.log('📤 Testing /api/cwc/submit-mvp endpoint...');
		const submitResponse = await fetch('http://localhost:5173/api/cwc/submit-mvp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(testData)
		});

		if (!submitResponse.ok) {
			console.error('❌ Submit endpoint failed:', submitResponse.status, await submitResponse.text());
			return;
		}

		const submitResult = await submitResponse.json();
		console.log('✅ Submit result:', submitResult);

		if (!submitResult.jobId) {
			console.error('❌ No jobId returned');
			return;
		}

		// Test 2: Job status endpoint
		console.log('📊 Testing /api/cwc/jobs/[jobId] endpoint...');
		const statusResponse = await fetch(`http://localhost:5173/api/cwc/jobs/${submitResult.jobId}`);

		if (!statusResponse.ok) {
			console.error('❌ Status endpoint failed:', statusResponse.status, await statusResponse.text());
			return;
		}

		const statusResult = await statusResponse.json();
		console.log('✅ Status result:', statusResult);

		console.log('🎉 CWC MVP API endpoints test completed successfully!');

	} catch (error) {
		console.error('❌ API test failed:', error);
	}
}

// Export for use in other tests
export { testCWCApiEndpoints };

// Run test if called directly
if (typeof window === 'undefined') {
	// We're in a Node.js environment, run the test
	testCWCApiEndpoints();
}