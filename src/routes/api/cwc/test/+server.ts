import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CWCGenerator } from '$lib/core/congress/cwc-generator';

/**
 * CWC Implementation Test Endpoint
 *
 * This endpoint tests our CWC integration without requiring external environment setup.
 * It verifies:
 * 1. CWC XML generation with proper office codes
 * 2. Both House and Senate formats
 * 3. Personalized message integration
 * 4. XML validation
 */

const testTemplate = {
	id: 'test-template-123',
	title: 'Test Congressional Communication',
	message_body:
		'This is a test message to verify our CWC implementation is working correctly for the hackathon demo.',
	target_audience: 'congress',
	created_at: new Date(),
	updated_at: new Date()
};

const testUser = {
	id: 'test-user-456',
	name: 'Jane Smith',
	email: 'jane.smith@example.com',
	phone: '+1-555-123-4567',
	address: {
		street: '123 Main Street',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102'
	}
};

// Mock representatives for testing
const mockHouseRep = {
	bioguideId: 'P000197',
	name: 'Nancy Pelosi',
	party: 'Democratic',
	state: 'CA',
	district: '11',
	chamber: 'house' as const,
	officeCode: 'P000197'
};

const mockSenateRep = {
	bioguideId: 'F000062',
	name: 'Dianne Feinstein',
	party: 'Democratic',
	state: 'CA',
	district: '00',
	chamber: 'senate' as const,
	officeCode: 'F000062'
};

export const GET: RequestHandler = async () => {
	try {
		console.log('🧪 Starting CWC Implementation Test...\n');

		const results = {
			officeCodeGeneration: [],
			houseXML: null,
			senateXML: null,
			personalizedMessage: null,
			validation: []
		};

		// Test 1: CWC Office Code Generation
		console.log('🏛️ Test 1: CWC Office Code Generation');

		const houseOfficeCode = CWCGenerator.generateOfficeCode(mockHouseRep);
		const senateOfficeCode = CWCGenerator.generateOfficeCode(mockSenateRep);

		results.officeCodeGeneration = [
			{ rep: mockHouseRep.name, chamber: 'house', officeCode: houseOfficeCode },
			{ rep: mockSenateRep.name, chamber: 'senate', officeCode: senateOfficeCode }
		];

		console.log(`   House: ${mockHouseRep.name} -> ${houseOfficeCode}`);
		console.log(`   Senate: ${mockSenateRep.name} -> ${senateOfficeCode}`);
		console.log('');

		// Test 2: House CWC XML Generation
		console.log('🏠 Test 2: House CWC XML Generation');
		const houseXML = CWCGenerator.generateUserAdvocacyXML({
			template: testTemplate,
			user: {
				...testUser,
				representatives: {
					house: mockHouseRep,
					senate: []
				}
			},
			_targetRep: mockHouseRep,
			personalizedMessage: 'This is a personalized message for the House representative.'
		});

		results.houseXML = {
			officeCode: houseOfficeCode,
			messagePreview: houseXML.substring(0, 300) + '...',
			fullXML: houseXML
		};

		// Validate House XML
		const houseValidation = CWCGenerator.validateXML(houseXML);
		results.validation.push({
			type: 'house',
			valid: houseValidation.valid,
			errors: houseValidation.errors
		});

		console.log('✅ House XML generated successfully');
		console.log('   Validation:', houseValidation.valid ? '✅ Valid' : '❌ Invalid');
		if (!houseValidation.valid) {
			console.log('   Errors:', houseValidation.errors);
		}
		console.log('');

		// Test 3: Senate CWC XML Generation
		console.log('⚖️ Test 3: Senate CWC XML Generation');
		const senateXML = CWCGenerator.generateUserAdvocacyXML({
			template: testTemplate,
			user: {
				...testUser,
				representatives: {
					house: {
						bioguideId: '',
						name: '',
						party: '',
						state: '',
						district: '',
						chamber: 'house',
						officeCode: ''
					},
					senate: [mockSenateRep]
				}
			},
			_targetRep: mockSenateRep,
			personalizedMessage: 'This is a personalized message for the Senate.'
		});

		results.senateXML = {
			officeCode: senateOfficeCode,
			messagePreview: senateXML.substring(0, 300) + '...',
			fullXML: senateXML
		};

		// Validate Senate XML
		const senateValidation = CWCGenerator.validateXML(senateXML);
		results.validation.push({
			type: 'senate',
			valid: senateValidation.valid,
			errors: senateValidation.errors
		});

		console.log('✅ Senate XML generated successfully');
		console.log('   Validation:', senateValidation.valid ? '✅ Valid' : '❌ Invalid');
		if (!senateValidation.valid) {
			console.log('   Errors:', senateValidation.errors);
		}
		console.log('');

		// Test 4: Personalized Message Integration
		console.log('💬 Test 4: Personalized Message Integration');
		const customMessage =
			'This is a CUSTOM personalized message that should override the template body.';

		const xmlWithPersonalization = CWCGenerator.generateUserAdvocacyXML({
			template: testTemplate,
			user: {
				...testUser,
				representatives: {
					house: mockHouseRep,
					senate: []
				}
			},
			_targetRep: mockHouseRep,
			personalizedMessage: customMessage
		});

		results.personalizedMessage = {
			customMessage,
			containsCustomMessage: xmlWithPersonalization.includes(customMessage),
			preview: xmlWithPersonalization.substring(
				xmlWithPersonalization.indexOf('<Body>'),
				xmlWithPersonalization.indexOf('</Body>') + 7
			)
		};

		console.log('✅ Personalized message integration test completed');
		console.log(
			'   Custom message found in XML:',
			results.personalizedMessage.containsCustomMessage
		);
		console.log('');

		console.log('🎉 All CWC Implementation Tests Completed Successfully!');

		return json({
			success: true,
			message: 'CWC implementation test completed successfully',
			results,
			summary: {
				officeCodes: results.officeCodeGeneration.length,
				houseXML: results.validation.find((v) => v.type === 'house')?.valid || false,
				senateXML: results.validation.find((v) => v.type === 'senate')?.valid || false,
				personalizedMessages: results.personalizedMessage?.containsCustomMessage || false
			}
		});
	} catch (error) {
		console.error('❌ Test failed:', error.message);
		console.error('Stack:', error.stack);

		return json(
			{
				success: false,
				error: error.message,
				stack: error.stack
			},
			{ status: 500 }
		);
	}
};
