/**
 * Manual test script for DC and territory representative lookup
 * Tests real ZIP codes for DC and Puerto Rico
 */

import { addressLookupService } from '../src/lib/core/congress/address-lookup';

interface TestCase {
	name: string;
	address: {
		street: string;
		city: string;
		state: string;
		zip: string;
	};
	expected: {
		hasSenators: boolean;
		delegateType: 'delegate' | 'resident_commissioner' | null;
		isVotingMember: boolean;
	};
}

const testCases: TestCase[] = [
	{
		name: 'Washington DC - White House',
		address: {
			street: '1600 Pennsylvania Ave NW',
			city: 'Washington',
			state: 'DC',
			zip: '20500'
		},
		expected: {
			hasSenators: false,
			delegateType: 'delegate',
			isVotingMember: false
		}
	},
	{
		name: 'Washington DC - Capitol Hill',
		address: {
			street: '100 Maryland Ave NE',
			city: 'Washington',
			state: 'DC',
			zip: '20002'
		},
		expected: {
			hasSenators: false,
			delegateType: 'delegate',
			isVotingMember: false
		}
	},
	{
		name: 'Puerto Rico - San Juan',
		address: {
			street: 'Calle del Cristo 255',
			city: 'San Juan',
			state: 'PR',
			zip: '00901'
		},
		expected: {
			hasSenators: false,
			delegateType: 'resident_commissioner',
			isVotingMember: false
		}
	},
	{
		name: 'Puerto Rico - Ponce',
		address: {
			street: 'Calle Mayor',
			city: 'Ponce',
			state: 'PR',
			zip: '00730'
		},
		expected: {
			hasSenators: false,
			delegateType: 'resident_commissioner',
			isVotingMember: false
		}
	},
	{
		name: 'US Virgin Islands - Charlotte Amalie',
		address: {
			street: '21-22 Kongens Gade',
			city: 'Charlotte Amalie',
			state: 'VI',
			zip: '00802'
		},
		expected: {
			hasSenators: false,
			delegateType: 'delegate',
			isVotingMember: false
		}
	},
	{
		name: 'Guam - Hagatna',
		address: {
			street: '173 Aspinall Ave',
			city: 'Hagatna',
			state: 'GU',
			zip: '96910'
		},
		expected: {
			hasSenators: false,
			delegateType: 'delegate',
			isVotingMember: false
		}
	}
];

async function runTest(testCase: TestCase): Promise<void> {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`Testing: ${testCase.name}`);
	console.log(`Address: ${testCase.address.street}, ${testCase.address.city}, ${testCase.address.state} ${testCase.address.zip}`);
	console.log(`${'='.repeat(60)}`);

	try {
		const result = await addressLookupService.lookupRepsByAddress(testCase.address);

		// Check district
		console.log(`\n📍 District: ${result.district.state}-${result.district.district}`);

		// Check house representative (delegate)
		console.log(`\n🏛️ House Representative/Delegate:`);
		console.log(`   Name: ${result.house.name}`);
		console.log(`   Party: ${result.house.party}`);
		console.log(`   State: ${result.house.state}`);
		console.log(`   Is Voting Member: ${result.house.is_voting_member ?? 'true (default)'}`);
		console.log(`   Delegate Type: ${result.house.delegate_type || 'N/A (regular rep)'}`);
		console.log(`   Office Code: ${result.house.office_code}`);

		// Check senators
		console.log(`\n👥 Senators:`);
		if (result.senate.length === 0) {
			console.log(`   No senators (DC or territory)`);
		} else {
			result.senate.forEach((senator, i) => {
				console.log(`   ${i + 1}. ${senator.name} (${senator.party})`);
			});
		}

		// Check special status
		if (result.special_status) {
			console.log(`\n⚠️ Special Status:`);
			console.log(`   Type: ${result.special_status.type}`);
			console.log(`   Has Senators: ${result.special_status.has_senators}`);
			console.log(`   Has Voting Rep: ${result.special_status.has_voting_representative}`);
			console.log(`\n📝 Message for user:`);
			console.log(`   ${result.special_status.message}`);
		}

		// Validate expectations
		console.log(`\n✅ Validation:`);
		const validations = [
			{
				name: 'Senator count',
				expected: testCase.expected.hasSenators ? 2 : 0,
				actual: result.senate.length,
				pass: (testCase.expected.hasSenators ? result.senate.length === 2 : result.senate.length === 0)
			},
			{
				name: 'Delegate type',
				expected: testCase.expected.delegateType || 'N/A',
				actual: result.house.delegate_type || 'N/A',
				pass: result.house.delegate_type === testCase.expected.delegateType
			},
			{
				name: 'Voting member status',
				expected: testCase.expected.isVotingMember,
				actual: result.house.is_voting_member ?? true,
				pass: (result.house.is_voting_member ?? true) === testCase.expected.isVotingMember
			}
		];

		validations.forEach(v => {
			const icon = v.pass ? '✅' : '❌';
			console.log(`   ${icon} ${v.name}: expected ${v.expected}, got ${v.actual}`);
		});

		const allPass = validations.every(v => v.pass);
		if (allPass) {
			console.log(`\n🎉 Test PASSED for ${testCase.name}`);
		} else {
			console.log(`\n❌ Test FAILED for ${testCase.name}`);
		}

	} catch (error) {
		console.error(`\n❌ Error occurred:`, error);
		console.log(`\n🔴 Test FAILED for ${testCase.name}`);
	}
}

async function main() {
	console.log('🚀 Testing DC and Territory Representative Lookup');
	console.log('This script tests that DC and territories return delegates instead of senators\n');

	for (const testCase of testCases) {
		await runTest(testCase);
	}

	console.log('\n' + '='.repeat(60));
	console.log('All tests completed!');
	console.log('='.repeat(60));
}

main().catch(console.error);
