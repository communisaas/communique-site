import { PrismaClient } from '@prisma/client';
import { isFeatureEnabled } from '../src/lib/features/config.js';

const db = new PrismaClient();

const legislativeChannelsData = [
	// TIER 1: Full Email Access Countries
	{
		channel_id: 'ca-parliament',
		name: 'Parliament of Canada',
		type: 'email',
		jurisdiction_level: 'federal',
		country_code: 'CA',
		state_code: null,
		district: null,
		delivery_config: {
			email_pattern: 'firstname.lastname@parl.gc.ca',
			email_domain: 'parl.gc.ca',
			requires_constituent: false,
			requires_real_address: false,
			supported_languages: ['en', 'fr']
		},
		is_active: true
	},
	{
		channel_id: 'gb-parliament',
		name: 'UK Parliament',
		type: 'email',
		jurisdiction_level: 'federal',
		country_code: 'GB',
		state_code: null,
		district: null,
		delivery_config: {
			email_pattern: 'varies',
			email_domain: 'parliament.uk',
			requires_constituent: true,
			requires_real_address: true,
			supported_languages: ['en', 'cy', 'gd']
		},
		is_active: true
	},
	{
		channel_id: 'fr-assemblee',
		name: 'French National Assembly',
		type: 'email',
		jurisdiction_level: 'federal',
		country_code: 'FR',
		state_code: null,
		district: null,
		delivery_config: {
			email_pattern: 'firstname.lastname@assemblee-nationale.fr',
			email_domain: 'assemblee-nationale.fr',
			requires_constituent: false,
			requires_real_address: false,
			supported_languages: ['fr']
		},
		is_active: true
	},

	// TIER 2: Form-Based Access
	{
		channel_id: 'us-congress',
		name: 'US Congress',
		type: 'cwc',
		jurisdiction_level: 'federal',
		country_code: 'US',
		state_code: null,
		district: null,
		delivery_config: {
			api_endpoint: 'https://www.congressweb.com/cwc',
			requires_constituent: true,
			requires_real_address: true,
			supported_languages: ['en'],
			policy_areas: [
				'Environmental Protection',
				'Health',
				'Economics and Public Finance',
				'Government Operations and Politics',
				'Education',
				'Immigration',
				'Crime and Law Enforcement',
				'Housing and Community Development',
				'Armed Forces and National Security',
				'Transportation and Public Works'
			]
		},
		is_active: true
	},
	{
		channel_id: 'de-bundestag',
		name: 'German Bundestag',
		type: 'form',
		jurisdiction_level: 'federal',
		country_code: 'DE',
		state_code: null,
		district: null,
		delivery_config: {
			form_endpoint: 'https://www.bundestag.de/kontakt',
			requires_constituent: false,
			requires_real_address: true,
			supported_languages: ['de', 'en']
		},
		is_active: true
	},

	// US State Examples
	{
		channel_id: 'us-ca-assembly',
		name: 'California State Assembly',
		type: 'email',
		jurisdiction_level: 'state',
		country_code: 'US',
		state_code: 'CA',
		district: null,
		delivery_config: {
			email_pattern: 'assemblymember.lastname@assembly.ca.gov',
			email_domain: 'assembly.ca.gov',
			requires_constituent: true,
			requires_real_address: true,
			supported_languages: ['en', 'es']
		},
		is_active: true
	},
	{
		channel_id: 'us-ny-assembly',
		name: 'New York State Assembly',
		type: 'form',
		jurisdiction_level: 'state',
		country_code: 'US',
		state_code: 'NY',
		district: null,
		delivery_config: {
			form_endpoint: 'https://nyassembly.gov/mem/contact',
			requires_constituent: true,
			requires_real_address: true,
			supported_languages: ['en', 'es']
		},
		is_active: true
	}
];

const legislativeBodiesData = [
	// Federal Bodies
	{
		name: 'House of Commons (Canada)',
		type: 'lower_house',
		country_code: 'CA',
		state_code: null,
		jurisdiction_level: 'federal',
		is_active: true
	},
	{
		name: 'Senate (Canada)',
		type: 'upper_house',
		country_code: 'CA',
		state_code: null,
		jurisdiction_level: 'federal',
		is_active: true
	},
	{
		name: 'House of Commons (UK)',
		type: 'lower_house',
		country_code: 'GB',
		state_code: null,
		jurisdiction_level: 'federal',
		is_active: true
	},
	{
		name: 'House of Lords (UK)',
		type: 'upper_house',
		country_code: 'GB',
		state_code: null,
		jurisdiction_level: 'federal',
		is_active: true
	},
	{
		name: 'US House of Representatives',
		type: 'lower_house',
		country_code: 'US',
		state_code: null,
		jurisdiction_level: 'federal',
		is_active: true
	},
	{
		name: 'US Senate',
		type: 'upper_house',
		country_code: 'US',
		state_code: null,
		jurisdiction_level: 'federal',
		is_active: true
	},

	// State Bodies
	{
		name: 'California State Assembly',
		type: 'lower_house',
		country_code: 'US',
		state_code: 'CA',
		jurisdiction_level: 'state',
		is_active: true
	},
	{
		name: 'California State Senate',
		type: 'upper_house',
		country_code: 'US',
		state_code: 'CA',
		jurisdiction_level: 'state',
		is_active: true
	},
	{
		name: 'New York State Assembly',
		type: 'lower_house',
		country_code: 'US',
		state_code: 'NY',
		jurisdiction_level: 'state',
		is_active: true
	},
	{
		name: 'New York State Senate',
		type: 'upper_house',
		country_code: 'US',
		state_code: 'NY',
		jurisdiction_level: 'state',
		is_active: true
	}
];

async function seedLegislativeChannels() {
	console.log('🏛️  Starting legislative channels seeding...');

	if (!isFeatureEnabled('LEGISLATIVE_CHANNELS')) {
		console.log('⚠️  LEGISLATIVE_CHANNELS feature not enabled, skipping seeding');
		console.log('   Enable with: ENABLE_BETA=true');
		return;
	}

	try {
		// Clear existing data
		await db.legislative_body.deleteMany({});
		await db.legislative_channel.deleteMany({});
		console.log('✅ Cleared existing legislative data');

		// Insert legislative channels
		const createdChannels = [];
		for (const channelData of legislativeChannelsData) {
			const createdChannel = await db.legislative_channel.create({
				data: channelData
			});
			createdChannels.push(createdChannel);
			console.log(`📡 Created channel: ${channelData.name} (${channelData.country_code})`);
		}

		// Insert legislative bodies
		const createdBodies = [];
		for (const bodyData of legislativeBodiesData) {
			const createdBody = await db.legislative_body.create({
				data: bodyData
			});
			createdBodies.push(createdBody);
			console.log(`🏛️  Created body: ${bodyData.name}`);
		}

		console.log(`✅ Seeded ${createdChannels.length} legislative channels`);
		console.log(`✅ Seeded ${createdBodies.length} legislative bodies`);

		// Summary report
		console.log('\n📊 Legislative System Summary:');
		console.log('===============================');

		const channelsByType = createdChannels.reduce(
			(acc, channel) => {
				acc[channel.type] = (acc[channel.type] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>
		);

		console.log('Channel Types:');
		Object.entries(channelsByType).forEach(([type, count]) => {
			console.log(`  • ${type}: ${count} channel${count > 1 ? 's' : ''}`);
		});

		const channelsByCountry = createdChannels.reduce(
			(acc, channel) => {
				acc[channel.country_code] = (acc[channel.country_code] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>
		);

		console.log('\nCountry Coverage:');
		Object.entries(channelsByCountry).forEach(([country, count]) => {
			console.log(`  • ${country}: ${count} channel${count > 1 ? 's' : ''}`);
		});

		const bodiesByJurisdiction = createdBodies.reduce(
			(acc, body) => {
				acc[body.jurisdiction_level] = (acc[body.jurisdiction_level] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>
		);

		console.log('\nJurisdiction Levels:');
		Object.entries(bodiesByJurisdiction).forEach(([level, count]) => {
			console.log(`  • ${level}: ${count} bod${count > 1 ? 'ies' : 'y'}`);
		});

		console.log('\n🌐 Global Delivery Capabilities:');
		console.log('• Email-based: CA, GB, FR, CA state, some US state');
		console.log('• Form-based: DE, NY state');
		console.log('• API-based: US Congress (CWC)');
	} catch (error) {
		console.error('❌ Error seeding legislative channels:', error);
		throw error;
	}
}

async function seedLegislativeSystem() {
	console.log('🌱 Starting legislative system seed...');
	console.log('='.repeat(50));

	try {
		await seedLegislativeChannels();

		// Verify the data
		const counts = {
			channels: await db.legislative_channel.count(),
			bodies: await db.legislative_body.count()
		};

		console.log('\n📊 Final Legislative System Stats:');
		console.log('==================================');
		console.log(`Legislative Channels: ${counts.channels}`);
		console.log(`Legislative Bodies: ${counts.bodies}`);

		console.log('\n🎉 Legislative system seeding completed!\n');
		console.log('💡 Next Steps:');
		console.log('  • Test template delivery with different channels');
		console.log('  • Configure channel priorities in delivery logic');
		console.log('  • Add more countries as needed');
		console.log('  • Monitor delivery success rates by channel\n');
	} catch (error) {
		console.error('❌ Error seeding legislative system:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}

	process.exit(0);
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seedLegislativeSystem();
}
