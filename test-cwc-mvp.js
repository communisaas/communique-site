/**
 * Quick Test for CWC MVP Demo
 * Run this to verify the straight-to-API flow works
 */

async function testCWCMVP() {
	console.log('🧪 Testing CWC MVP Straight-to-API Flow...');

	const testData = {
		templateId: 'demo-template-123',
		address: {
			street: '1 Harvard Square',
			city: 'Cambridge', 
			state: 'MA',
			zip: '02138'
		},
		personalizedMessage: 'This is a hackathon demo message to Congress!',
		userEmail: 'demo@communique.org',
		userName: 'Demo User'
	};

	try {
		console.log('📤 Calling /api/cwc/submit-mvp...');
		
		const response = await fetch('http://localhost:5173/api/cwc/submit-mvp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(testData)
		});

		if (!response.ok) {
			console.error('❌ Submit failed:', response.status, await response.text());
			return;
		}

		const result = await response.json();
		console.log('✅ Submit successful!');
		console.log('📊 Summary:', result.summary);
		console.log('🏛️ Representatives:', result.representatives);
		console.log('📋 Results:', result.results);

		// Test job status
		console.log('\n📊 Fetching job status...');
		const statusResponse = await fetch(`http://localhost:5173/api/cwc/jobs/${result.jobId}`);
		const status = await statusResponse.json();
		console.log('✅ Job status:', status.status, status.progress + '%');

		console.log('\n🎉 CWC MVP Demo Test COMPLETE!');
		console.log('🎯 Ready for hackathon presentation!');

	} catch (error) {
		console.error('❌ Test failed:', error);
	}
}

// Run test
setTimeout(() => testCWCMVP(), 2000); // Wait for server to start