/**
 * Example Usage of CWC SQS Client
 *
 * This file demonstrates how to use the CWCSQSClient for sending
 * congressional messages to AWS SQS queues instead of direct API calls.
 */

import { cwcSQSClient } from './sqs-client';
import type { Template } from '$lib/types/template';
import type { CongressionalOffice } from '$lib/core/congress/cwc-client';

/**
 * Example: Send a message to a Senator's office
 */
async function sendToSenatorExample(): Promise<void> {
	// Example template (would come from your database)
	const template: Template = {
		id: 'template-123',
		slug: 'climate-action-2025',
		title: 'Support Climate Action Legislation',
		message_body: 'Dear Senator, I urge you to support meaningful climate action...',
		subject: 'Support for Climate Action',
		category: 'Environment',
		// ... other template fields
		description: 'A template about climate action',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		delivery_config: {},
		recipient_config: {},
		metrics: {},
		is_public: true,
		send_count: 0,
		applicable_countries: ['US'],
		specific_locations: [],
		preview: 'Support climate action legislation'
	};

	// Example user data
	const user = {
		id: 'user-456',
		name: 'Jane Doe',
		email: 'jane.doe@example.com',
		phone: '+1-555-123-4567',
		address: {
			street: '123 Main St',
			city: 'Springfield',
			state: 'IL',
			zip: '62701'
		}
	};

	// Example senator office
	const senator: CongressionalOffice = {
		bioguideId: 'D000563',
		name: 'Dick Durbin',
		chamber: 'senate',
		officeCode: 'IL_SEN_DURBIN',
		state: 'IL',
		district: '00',
		party: 'Democratic'
	};

	try {
		const result = await cwcSQSClient.sendToSenateQueue(
			template,
			user,
			senator,
			'I am particularly concerned about the effects on my community in Springfield.',
			'high' // Priority level
		);

		if (result.success) {
			console.log('✅ Message queued successfully:', {
				messageId: result.messageId,
				timestamp: result.timestamp
			});
		} else {
			console.error('❌ Failed to queue message:', result.error);
		}
	} catch (error) {
		console.error('❌ Unexpected error:', error);
	}
}

/**
 * Example: Send messages to all user representatives
 */
async function sendToAllRepresentativesExample(): Promise<void> {
	// Mock data (same as above)
	const template: Template = {
		id: 'template-789',
		slug: 'healthcare-reform-2025',
		title: 'Support Healthcare Reform',
		message_body: 'Dear Representative, I urge you to support healthcare reform...',
		subject: 'Healthcare Reform Support',
		category: 'Healthcare',
		description: 'A template about healthcare reform',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		delivery_config: {},
		recipient_config: {},
		metrics: {},
		is_public: true,
		send_count: 0,
		applicable_countries: ['US'],
		specific_locations: [],
		preview: 'Support healthcare reform'
	};

	const user = {
		id: 'user-789',
		name: 'John Smith',
		email: 'john.smith@example.com',
		address: {
			street: '456 Oak Ave',
			city: 'Chicago',
			state: 'IL',
			zip: '60601'
		}
	};

	// User's representatives (2 senators + 1 house rep)
	const representatives: CongressionalOffice[] = [
		{
			bioguideId: 'D000563',
			name: 'Dick Durbin',
			chamber: 'senate',
			officeCode: 'IL_SEN_DURBIN',
			state: 'IL',
			district: '00',
			party: 'Democratic'
		},
		{
			bioguideId: 'D000622',
			name: 'Tammy Duckworth',
			chamber: 'senate',
			officeCode: 'IL_SEN_DUCKWORTH',
			state: 'IL',
			district: '00',
			party: 'Democratic'
		},
		{
			bioguideId: 'D000096',
			name: 'Danny K. Davis',
			chamber: 'house',
			officeCode: 'IL07',
			state: 'IL',
			district: '07',
			party: 'Democratic'
		}
	];

	try {
		const results = await cwcSQSClient.sendToAllRepresentatives(
			template,
			user,
			representatives,
			'As a Chicago resident, this issue directly affects my family.'
		);

		// Process results
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		console.log(`✅ Successfully queued ${successful.length} messages`);
		if (failed.length > 0) {
			console.log(`❌ Failed to queue ${failed.length} messages:`);
			failed.forEach((result) => {
				console.log(`  - Error: ${result.error}`);
			});
		}

		// Log all message IDs for tracking
		successful.forEach((result) => {
			console.log(`📨 Message ID: ${result.messageId}`);
		});
	} catch (error) {
		console.error('❌ Unexpected error sending to all representatives:', error);
	}
}

/**
 * Example: Test SQS connectivity
 */
async function testConnectivityExample(): Promise<void> {
	try {
		const connectionResult = await cwcSQSClient.testConnection();

		if (connectionResult.connected) {
			console.log('✅ SQS connection successful');
			console.log(`  Senate queue: ${connectionResult.senateQueue ? '✅' : '❌'}`);
			console.log(`  House queue: ${connectionResult.houseQueue ? '✅' : '❌'}`);
		} else {
			console.log('❌ SQS connection failed:', connectionResult.error);
		}

		// Show configuration (sensitive data masked)
		const config = cwcSQSClient.getConfiguration();
		console.log('Configuration:', config);
	} catch (error) {
		console.error('❌ Connection test failed:', error);
	}
}

/**
 * Environment Variables Required:
 *
 * AWS_REGION=us-east-1
 * CWC_SENATE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/cwc-senate-submissions.fifo
 * CWC_HOUSE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/cwc-house-submissions.fifo
 * AWS_ACCESS_KEY_ID=your-access-key (optional if using IAM roles)
 * AWS_SECRET_ACCESS_KEY=your-secret-key (optional if using IAM roles)
 */

// Export examples for potential testing
export { sendToSenatorExample, sendToAllRepresentativesExample, testConnectivityExample };
