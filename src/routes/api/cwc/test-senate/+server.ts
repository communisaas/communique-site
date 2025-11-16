import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cwcClient } from '$lib/core/congress/cwc-client';

/**
 * Senate CWC Integration Test
 * 
 * This endpoint tests direct Senate CWC submission via the real Senate API
 * to ensure our integration works for the hackathon demo.
 */

const testTemplate = {
	id: 'test-senate-direct-123',
	title: 'Test Senate Direct Communication',
	message_body: 'This is a test message for direct Senate API integration testing for our hackathon demo.',
	target_audience: 'congress',
	created_at: new Date(),
	updated_at: new Date()
};

const testUser = {
	id: 'test-user-senate-456',
	name: 'Jane Senate-Test',
	email: 'jane.senate@test.com',
	phone: '+1-555-SENATE-01',
	street: '123 Capitol Avenue',
	city: 'Washington',
	state: 'DC',
	zip: '20001'
};

const testSenators = [
	{
		bioguideId: 'F000062',
		name: 'Dianne Feinstein',
		party: 'Democratic',
		state: 'CA',
		district: '00',
		chamber: 'senate' as const,
		officeCode: 'F000062'
	},
	{
		bioguideId: 'P000145',
		name: 'Alex Padilla',
		party: 'Democratic',
		state: 'CA',
		district: '00',
		chamber: 'senate' as const,
		officeCode: 'P000145'
	}
];

export const GET: RequestHandler = async () => {
	try {
		console.log('⚖️ Starting Senate Direct API Integration Test...\n');

		const results = {
			senateSubmissions: [],
			errors: [],
			apiKeyStatus: null,
			overallSuccess: false
		};

		// Check API key status
		const apiKey = process.env.CWC_API_KEY;
		results.apiKeyStatus = {
			present: !!apiKey,
			length: apiKey ? apiKey.length : 0,
			masked: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'Not set'
		};

		console.log('🔑 API Key Status:', results.apiKeyStatus.present ? '✅ Present' : '❌ Missing');
		
		if (!apiKey) {
			results.errors.push('CWC_API_KEY not configured - Senate submissions will be simulated');
		}

		console.log('');

		// Test Senate submissions
		console.log('📤 Testing Senate Submissions');
		
		for (const senator of testSenators) {
			try {
				console.log(`   Testing ${senator.name} (${senator.state})...`);
				
				const result = await cwcClient.submitToSenate(
					testTemplate,
					testUser,
					senator,
					`This is a personalized test message for Senator ${senator.name} for our hackathon demo.`
				);
				
				results.senateSubmissions.push({
					senator: senator.name,
					state: senator.state,
					success: result.success,
					status: result.status,
					messageId: result.messageId,
					confirmationNumber: result.confirmationNumber,
					error: result.error,
					timestamp: result.timestamp
				});
				
				console.log(`   ✅ ${senator.name}: ${result.success ? 'Success' : 'Failed'} (${result.status})`);
				if (result.messageId) {
					console.log(`      Message ID: ${result.messageId}`);
				}
				if (result.confirmationNumber) {
					console.log(`      Confirmation: ${result.confirmationNumber}`);
				}
				if (result.error) {
					console.log(`      Error: ${result.error}`);
				}
				
			} catch (senatorError) {
				console.log(`   ❌ ${senator.name}: Error - ${senatorError.message}`);
				results.errors.push(`Senator ${senator.name} failed: ${senatorError.message}`);
				
				results.senateSubmissions.push({
					senator: senator.name,
					state: senator.state,
					success: false,
					error: senatorError.message,
					timestamp: new Date().toISOString()
				});
			}
			
			// Add delay between submissions to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
		
		console.log('');

		// Calculate overall success
		const successfulSubmissions = results.senateSubmissions.filter(s => s.success).length;
		results.overallSuccess = successfulSubmissions > 0;
		
		console.log('📊 Test Summary:');
		console.log(`   Total Senators Tested: ${testSenators.length}`);
		console.log(`   Successful Submissions: ${successfulSubmissions}`);
		console.log(`   Failed Submissions: ${testSenators.length - successfulSubmissions}`);
		console.log(`   Overall Success: ${results.overallSuccess ? '✅ Yes' : '❌ No'}`);
		
		if (results.errors.length > 0) {
			console.log(`   Errors: ${results.errors.length}`);
			results.errors.forEach(error => console.log(`     - ${error}`));
		}

		return json({
			success: results.overallSuccess,
			message: results.overallSuccess ? 'Senate API integration test successful' : 'Senate API integration test completed with errors',
			results,
			summary: {
				totalSenators: testSenators.length,
				successful: successfulSubmissions,
				failed: testSenators.length - successfulSubmissions,
				apiKeyPresent: results.apiKeyStatus.present,
				errors: results.errors.length
			}
		});

	} catch (error) {
		console.error('❌ Senate test failed:', error.message);
		
		return json({
			success: false,
			error: error.message,
			stack: error.stack,
			results: {
				errors: [error.message]
			}
		}, { status: 500 });
	}
};