import { PrismaClient } from '@prisma/client';
import { isFeatureEnabled, FeatureStatus } from '../src/lib/features/config.js';

const db = new PrismaClient();

/**
 * Seed data for feature-flagged models
 * This script only runs if the corresponding features are enabled
 */

async function seedUserActivationData() {
	if (!isFeatureEnabled('CASCADE_ANALYTICS')) {
		console.log('⚠️  CASCADE_ANALYTICS not enabled, skipping user activation seeding');
		return;
	}

	console.log('📊 Seeding user activation cascade data...');

	try {
		// First, we need some templates and users to create realistic activation chains
		const templates = await db.template.findMany({ take: 3 });
		const users = await db.user.findMany({ take: 10 });

		if (templates.length === 0 || users.length === 0) {
			console.log('⚠️  Need templates and users before seeding activation data');
			return;
		}

		// Create sample activation cascade
		const activationData = [
			// Generation 0 - Original template creators/sharers
			{
				user_id: users[0].id,
				template_id: templates[0].id,
				source_user_id: null, // Original source
				activation_type: 'template_use',
				activation_depth: 0,
				referral_metadata: { source: 'direct_creation' }
			},
			// Generation 1 - Direct shares
			{
				user_id: users[1].id,
				template_id: templates[0].id,
				source_user_id: users[0].id,
				activation_type: 'template_use',
				activation_depth: 1,
				referral_metadata: { source: 'social_share', platform: 'twitter' }
			},
			{
				user_id: users[2].id,
				template_id: templates[0].id,
				source_user_id: users[0].id,
				activation_type: 'template_use',
				activation_depth: 1,
				referral_metadata: { source: 'email_share' }
			},
			// Generation 2 - Second-order viral spread
			{
				user_id: users[3].id,
				template_id: templates[0].id,
				source_user_id: users[1].id,
				activation_type: 'template_use',
				activation_depth: 2,
				referral_metadata: { source: 'social_share', platform: 'twitter' }
			}
		];

		// Clear existing activation data
		await db.user_activation.deleteMany({});

		// Insert activation data
		for (const activation of activationData) {
			await db.user_activation.create({
				data: activation
			});
		}

		console.log(`✅ Seeded ${activationData.length} user activation records`);

		// Create sample coordinate data if users exist
		if (isFeatureEnabled('CASCADE_ANALYTICS')) {
			const coordinateData = [
				{
					user_id: users[0].id,
					latitude: 37.7749,
					longitude: -122.4194,
					accuracy: 100,
					source: 'manual'
				},
				{
					user_id: users[1].id,
					latitude: 40.7128,
					longitude: -74.006,
					accuracy: 150,
					source: 'ip'
				}
			];

			await db.user_coordinates.deleteMany({});

			for (const coord of coordinateData) {
				await db.user_coordinates.create({
					data: coord
				});
			}

			console.log(`✅ Seeded ${coordinateData.length} user coordinate records`);
		}
	} catch (error) {
		console.error('❌ Error seeding user activation data:', error);
		throw error;
	}
}

async function seedAIFeatureData() {
	if (!isFeatureEnabled('AI_SUGGESTIONS')) {
		console.log('⚠️  AI_SUGGESTIONS not enabled, skipping AI feature seeding');
		return;
	}

	console.log('🤖 Seeding AI suggestions data...');

	try {
		const templates = await db.template.findMany({ take: 3 });
		if (templates.length === 0) {
			console.log('⚠️  Need templates before seeding AI suggestions');
			return;
		}

		// Sample AI suggestions
		const aiSuggestionsData = [
			{
				template_id: templates[0].id,
				user_id: null, // Global suggestions
				variable_name: 'Personal Connection',
				suggestion:
					'As a parent of two school-age children, I see firsthand how housing costs affect our teachers and our schools.',
				confidence: 0.85,
				context: {
					user_context: 'parent',
					template_category: 'education',
					location_context: 'urban'
				},
				feedback: null,
				used: false
			},
			{
				template_id: templates[0].id,
				user_id: null,
				variable_name: 'Personal Connection',
				suggestion:
					'As a teacher who commutes 90 minutes each day, I understand the real cost of the housing crisis on education.',
				confidence: 0.92,
				context: {
					user_context: 'educator',
					template_category: 'education',
					location_context: 'urban'
				},
				feedback: null,
				used: true
			}
		];

		await db.ai_suggestions.deleteMany({});

		for (const suggestion of aiSuggestionsData) {
			await db.ai_suggestions.create({
				data: suggestion
			});
		}

		console.log(`✅ Seeded ${aiSuggestionsData.length} AI suggestion records`);
	} catch (error) {
		console.error('❌ Error seeding AI feature data:', error);
		throw error;
	}
}

async function seedTemplatePersonalization() {
	if (!isFeatureEnabled('TEMPLATE_PERSONALIZATION')) {
		console.log('⚠️  TEMPLATE_PERSONALIZATION not enabled, skipping personalization seeding');
		return;
	}

	console.log('👤 Seeding template personalization data...');

	try {
		const templates = await db.template.findMany({ take: 2 });
		const users = await db.user.findMany({ take: 3 });

		if (templates.length === 0 || users.length === 0) {
			console.log('⚠️  Need templates and users before seeding personalization data');
			return;
		}

		const personalizationData = [
			{
				user_id: users[0].id,
				template_id: templates[0].id,
				variable_name: 'Personal Connection',
				custom_value:
					'As a teacher in this district for over 15 years, I have seen the housing crisis directly impact our ability to retain quality educators.',
				usage_count: 3
			},
			{
				user_id: users[0].id,
				template_id: templates[0].id,
				variable_name: 'Address',
				custom_value: '1234 Main Street, San Francisco, CA 94110',
				usage_count: 5
			},
			{
				user_id: users[1].id,
				template_id: templates[1].id,
				variable_name: 'Personal Connection',
				custom_value:
					'As a parent who struggles to afford rent despite working full-time, I understand how impossible it has become for families.',
				usage_count: 1
			}
		];

		await db.template_personalization.deleteMany({});

		for (const personalization of personalizationData) {
			await db.template_personalization.create({
				data: personalization
			});
		}

		console.log(`✅ Seeded ${personalizationData.length} template personalization records`);
	} catch (error) {
		console.error('❌ Error seeding template personalization data:', error);
		throw error;
	}
}

async function seedTemplateAnalytics() {
	if (!isFeatureEnabled('CASCADE_ANALYTICS')) {
		console.log('⚠️  CASCADE_ANALYTICS not enabled, skipping template analytics seeding');
		return;
	}

	console.log('📈 Seeding template analytics data...');

	try {
		const templates = await db.template.findMany({ take: 3 });
		if (templates.length === 0) {
			console.log('⚠️  Need templates before seeding analytics data');
			return;
		}

		const analyticsData = [
			{
				template_id: templates[0].id,
				metric_type: 'engagement',
				metric_value: 0.73,
				time_period: 'daily',
				geographic_region: 'US-CA',
				confidence_interval: { lower: 0.68, upper: 0.78 }
			},
			{
				template_id: templates[0].id,
				metric_type: 'conversion',
				metric_value: 0.45,
				time_period: 'weekly',
				geographic_region: 'US',
				confidence_interval: { lower: 0.41, upper: 0.49 }
			},
			{
				template_id: templates[1].id,
				metric_type: 'sharing',
				metric_value: 2.3,
				time_period: 'daily',
				geographic_region: 'US-NY',
				confidence_interval: { lower: 2.1, upper: 2.5 }
			}
		];

		await db.template_analytics.deleteMany({});

		for (const analytics of analyticsData) {
			await db.template_analytics.create({
				data: analytics
			});
		}

		console.log(`✅ Seeded ${analyticsData.length} template analytics records`);
	} catch (error) {
		console.error('❌ Error seeding template analytics data:', error);
		throw error;
	}
}

async function seedFeatureData() {
	console.log('🧪 Starting feature-flagged data seeding...');
	console.log('='.repeat(50));

	try {
		// Check which features are enabled
		const enabledFeatures = [
			'CASCADE_ANALYTICS',
			'AI_SUGGESTIONS',
			'TEMPLATE_PERSONALIZATION',
			'LEGISLATIVE_CHANNELS'
		].filter((feature) => isFeatureEnabled(feature as any));

		if (enabledFeatures.length === 0) {
			console.log('⚠️  No feature flags enabled');
			console.log('   Enable features with environment variables:');
			console.log('   • ENABLE_BETA=true (for cascade analytics, legislative channels)');
			console.log('   • Features in ROADMAP status require explicit enablement');
			return;
		}

		console.log('🚀 Enabled features:', enabledFeatures.join(', '));
		console.log('');

		// Seed each feature's data
		await seedUserActivationData();
		await seedAIFeatureData();
		await seedTemplatePersonalization();
		await seedTemplateAnalytics();

		// Summary
		const counts = {};

		if (isFeatureEnabled('CASCADE_ANALYTICS')) {
			counts['User Activations'] = await db.user_activation.count();
			counts['User Coordinates'] = await db.user_coordinates.count();
			counts['Template Analytics'] = await db.template_analytics.count();
		}

		if (isFeatureEnabled('AI_SUGGESTIONS')) {
			counts['AI Suggestions'] = await db.ai_suggestions.count();
		}

		if (isFeatureEnabled('TEMPLATE_PERSONALIZATION')) {
			counts['Template Personalizations'] = await db.template_personalization.count();
		}

		console.log('\n📊 Feature Data Summary:');
		console.log('========================');
		Object.entries(counts).forEach(([model, count]) => {
			console.log(`${model}: ${count}`);
		});

		console.log('\n🎉 Feature data seeding completed!\n');
		console.log('💡 Next Steps:');
		console.log('  • Test feature-flagged functionality');
		console.log('  • Monitor feature usage and performance');
		console.log('  • Graduate successful beta features to production');
		console.log('  • Add more seed data as features develop\n');
	} catch (error) {
		console.error('❌ Error seeding feature data:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}

	process.exit(0);
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seedFeatureData();
}
