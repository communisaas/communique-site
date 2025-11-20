import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cwcClient } from '$lib/core/congress/cwc-client';

/**
 * House Proxy Integration Test
 *
 * This endpoint tests the House CWC submission via GCP proxy to ensure:
 * 1. Proxy connection works
 * 2. Request format is correct
 * 3. Response handling works
 * 4. Error cases are handled properly
 */

const testTemplate = {
	id: 'test-house-proxy-123',
	title: 'Test House Proxy Communication',
	message_body: 'This is a test message for House proxy integration testing.',
	target_audience: 'congress',
	created_at: new Date(),
	updated_at: new Date()
};

const testUser = {
	id: 'test-user-house-456',
	name: 'John House-Test',
	email: 'john.house@test.com',
	phone: '+1-555-HOUSE-01',
	street: '456 Capitol Hill',
	city: 'Washington',
	state: 'DC',
	zip: '20001'
};

const testHouseRep = {
	bioguideId: 'P000197',
	name: 'Nancy Pelosi',
	party: 'Democratic',
	state: 'CA',
	district: '11',
	chamber: 'house' as const,
	officeCode: 'HCA11'
};

export const GET: RequestHandler = async () => {
	try {
		console.log('🏠 Starting House Proxy Integration Test...\n');

		const results = {
			proxyConnection: null,
			submissionResult: null,
			responseData: null,
			errors: []
		};

		// Test 1: Proxy Connection Test
		console.log('🔗 Test 1: Proxy Connection Test');
		const proxyUrl = process.env.GCP_PROXY_URL || 'http://34.171.151.252:8080';
		const proxyAuthToken = process.env.GCP_PROXY_AUTH_TOKEN;

		console.log(`   Proxy URL: ${proxyUrl}`);
		console.log(`   Auth Token: ${proxyAuthToken ? 'Present' : 'Not set'}`);

		// Test multiple endpoints
		const endpoints = ['/health', '/api/health', '/', '/api'];
		let connectionSuccess = false;

		for (const endpoint of endpoints) {
			try {
				console.log(`   Attempting connection to: ${proxyUrl}${endpoint}`);
				const healthCheck = await fetch(`${proxyUrl}${endpoint}`, {
					method: 'GET',
					headers: {
						Authorization: proxyAuthToken ? `Bearer ${proxyAuthToken}` : '',
						'User-Agent': 'Communique-Test/1.0'
					},
					timeout: 10000 // 10 second timeout
				});

				results.proxyConnection = {
					url: proxyUrl,
					endpoint: endpoint,
					status: healthCheck.status,
					statusText: healthCheck.statusText,
					headers: Object.fromEntries(healthCheck.headers.entries()),
					success: healthCheck.ok
				};

				console.log(`   ✅ Found working endpoint: ${endpoint} (${healthCheck.status})`);
				connectionSuccess = true;
				break;
			} catch (endpointError) {
				console.log(`   ❌ Endpoint ${endpoint} failed: ${endpointError.message}`);

				if (endpoint === endpoints[endpoints.length - 1]) {
					// Last endpoint failed, record the error
					console.log(`   Connection error: ${endpointError.message}`);
					console.log(`   Error type: ${endpointError.constructor.name}`);
					console.log(`   Proxy URL: ${proxyUrl}`);

					// Enhanced error details
					const errorDetails = {
						message: endpointError.message,
						type: endpointError.constructor.name,
						code: (endpointError as any).code,
						errno: (endpointError as any).errno,
						syscall: (endpointError as any).syscall
					};

					results.errors.push(`All proxy endpoints failed. Last error: ${endpointError.message}`);
					results.proxyConnection = {
						url: proxyUrl,
						error: endpointError.message,
						errorDetails,
						success: false
					};
				}
			}
		}
		console.log('');

		// Test 2: House CWC Submission via Proxy
		console.log('📤 Test 2: House CWC Submission via Proxy');

		try {
			const submissionResult = await cwcClient.submitToHouse(
				testTemplate,
				testUser,
				testHouseRep,
				'This is a personalized test message for House proxy submission.'
			);

			results.submissionResult = submissionResult;

			console.log(`   Submission result: ${submissionResult.success ? '✅ Success' : '❌ Failed'}`);
			console.log(`   Status: ${submissionResult.status}`);
			console.log(`   Office: ${submissionResult.office}`);
			console.log(`   Message ID: ${submissionResult.messageId || 'Not provided'}`);
			console.log(`   Confirmation: ${submissionResult.confirmationNumber || 'Not provided'}`);

			if (!submissionResult.success && submissionResult.error) {
				console.log(`   Error: ${submissionResult.error}`);
				results.errors.push(`Submission failed: ${submissionResult.error}`);
			}
		} catch (submissionError) {
			console.log(`   Submission error: ${submissionError.message}`);
			results.errors.push(`Submission error: ${submissionError.message}`);
			results.submissionResult = {
				success: false,
				error: submissionError.message
			};
		}
		console.log('');

		// Test 3: Direct Proxy API Test (bypassing client)
		console.log('🎯 Test 3: Direct Proxy API Test');

		const directSubmission = {
			jobId: `direct-test-${Date.now()}`,
			officeCode: testHouseRep.officeCode,
			recipientName: testHouseRep.name,
			recipientEmail: `${testHouseRep.bioguideId}@house.gov`,
			subject: testTemplate.title,
			message: 'Direct proxy test message',
			senderName: testUser.name,
			senderEmail: testUser.email,
			senderAddress: `${testUser.street}, ${testUser.city}, ${testUser.state} ${testUser.zip}`,
			senderPhone: testUser.phone,
			priority: 'normal',
			metadata: {
				templateId: testTemplate.id,
				userId: testUser.id,
				bioguideId: testHouseRep.bioguideId,
				test: true,
				submissionTime: new Date().toISOString()
			}
		};

		try {
			console.log('   Sending direct POST to proxy...');
			const directResponse = await fetch(`${proxyUrl}/api/house/submit`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: proxyAuthToken ? `Bearer ${proxyAuthToken}` : '',
					'X-Request-ID': directSubmission.jobId,
					'User-Agent': 'Communique-Test/1.0'
				},
				body: JSON.stringify(directSubmission)
			});

			console.log(`   Response status: ${directResponse.status} ${directResponse.statusText}`);

			const responseText = await directResponse.text();
			console.log(`   Response body: ${responseText}`);

			let responseData;
			try {
				responseData = JSON.parse(responseText);
			} catch {
				responseData = { raw: responseText };
			}

			results.responseData = {
				status: directResponse.status,
				statusText: directResponse.statusText,
				headers: Object.fromEntries(directResponse.headers.entries()),
				data: responseData
			};

			if (directResponse.ok) {
				console.log('✅ Direct proxy test successful');
			} else {
				console.log('❌ Direct proxy test failed');
				results.errors.push(`Direct proxy test failed: ${directResponse.status} ${responseText}`);
			}
		} catch (directError) {
			console.log(`   Direct proxy error: ${directError.message}`);
			results.errors.push(`Direct proxy error: ${directError.message}`);
			results.responseData = {
				error: directError.message
			};
		}

		console.log('');

		// Test 4: Response Format Validation
		console.log('✅ Test 4: Response Format Validation');

		const expectedResponseFormat = {
			submissionId: 'string',
			status: 'string',
			message: 'string',
			officeCode: 'string',
			timestamp: 'string'
		};

		if (results.responseData?.data) {
			const responseFields = Object.keys(results.responseData.data);
			console.log(`   Response fields: ${responseFields.join(', ')}`);

			// Check if response has expected structure
			const hasExpectedFields = Object.keys(expectedResponseFormat).some((field) =>
				results.responseData.data.hasOwnProperty(field)
			);

			if (hasExpectedFields) {
				console.log('✅ Response contains expected fields');
			} else {
				console.log('⚠️ Response format differs from expected');
				console.log('   Expected format:', expectedResponseFormat);
			}
		} else {
			console.log('⚠️ No response data available for format validation');
		}

		console.log('\n🎉 House Proxy Integration Test Completed!');

		return json({
			success: true,
			message: 'House proxy integration test completed',
			results,
			summary: {
				proxyConnection: results.proxyConnection?.success || false,
				submissionAttempted: !!results.submissionResult,
				directApiTest: !!results.responseData,
				errors: results.errors.length,
				errorDetails: results.errors
			}
		});
	} catch (error) {
		console.error('❌ House proxy test failed:', error.message);

		return json(
			{
				success: false,
				error: error.message,
				stack: error.stack,
				results: {
					errors: [error.message]
				}
			},
			{ status: 500 }
		);
	}
};
