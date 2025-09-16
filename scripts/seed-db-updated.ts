import { PrismaClient } from '@prisma/client';
import { isFeatureEnabled } from '../src/lib/features/config.js';

const db: PrismaClient = new PrismaClient();

// Congressional Policy Areas mapping for CWC API compatibility
const _policyAreaMap = {
	Environment: 'Environmental Protection',
	Healthcare: 'Health',
	Economy: 'Economics and Public Finance',
	Democracy: 'Government Operations and Politics',
	Education: 'Education',
	Immigration: 'Immigration',
	Justice: 'Crime and Law Enforcement',
	Housing: 'Housing and Community Development',
	Defense: 'Armed Forces and National Security',
	Transportation: 'Transportation and Public Works',
	'Public Safety': 'Crime and Law Enforcement'
};

const seedTemplates = [
	{
		title: "The Math Doesn't Work: Climate Edition",
		description: 'Expose the numbers behind fossil fuel subsidies while communities flood.',
		category: 'Environment',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		subject: 'The Math on Climate Subsidies',
		preview: "Dear [Representative Name], The math doesn't work anymore.",
		message_body: `Dear [Representative Name],

The math doesn't work anymore.

Oil companies get $20 billion in subsidies.
Climate disasters cost us $165 billion last year.
The gap: $145 billion we pay twice.

From [Address] where flood insurance is now unaffordable.

[Personal Connection]

Which number do you defend?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 8234,
			opened: 0,
			clicked: 0,
			responded: 8234,
			districts_covered: 417,
			total_districts: 435,
			district_coverage_percent: 96
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			policy_area: 'Environmental Protection',
			topic: 'Climate Subsidies',
			urgency: 'high'
		},
		recipient_config: {
			target_type: 'congressional',
			chambers: ['house', 'senate'],
			committees: ['energy', 'environment']
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true
	},
	{
		title: 'Teachers Need 2 Jobs for 1 Bedroom',
		description: 'Expose how private equity owns 44% of homes while teachers work multiple jobs.',
		category: 'Housing',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'The Math on Teacher Housing',
		preview: "The math doesn't work anymore.",
		message_body: `Dear Seattle City Council,

The math doesn't work anymore.

Private equity owns 44% of single-family homes.
Teachers earn $65,000 but need $85,000 for rent.
The gap: 2 jobs to afford 1 bedroom.

From [Address] where teachers commute 90 minutes each way.

[Personal Connection]

How many jobs should a teacher need?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: { sent: 0, opened: 0, clicked: 0, responded: 0 },
		delivery_config: {
			timing: 'immediate',
			followUp: false,
			cwcEnabled: false
		},
		recipient_config: {
			emails: ['council@seattle.gov'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['Seattle'],
		is_public: true
	},
	{
		title: 'SF Teachers Commute 2 Hours, Students Skip School',
		description:
			'Expose how housing costs force teachers to commute while students become homeless.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'The Math on Student Housing',
		preview: "The math doesn't work anymore.",
		message_body: `Dear San Francisco Board of Education,

The math doesn't work anymore.

Teachers commute 2+ hours because they can't afford SF.
Students miss 30+ school days due to housing instability.
The connection: No stable adults, no stable learning.

From [Address] where classrooms have substitute teachers and empty desks.

[Personal Connection]

How do we teach when no one can afford to stay?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: { sent: 3421, opened: 0, clicked: 0, responded: 3421 },
		delivery_config: {
			timing: 'immediate',
			followUp: false,
			cwcEnabled: false
		},
		recipient_config: {
			emails: ['board@sfusd.edu'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true
	},
	{
		title: 'We Pay More for Broken Trains',
		description: 'Expose how transit costs rise while service gets worse.',
		category: 'Transportation',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'The Math on Transit Failure',
		preview: "The math doesn't work anymore.",
		message_body: `Dear Mayor Adams and NYC Council,

The math doesn't work anymore.

MetroCard cost: $2.90 (up 28% since 2019)
On-time performance: 75% (down from 85%)
We pay more for worse service.

From [Address] where commutes cost $150/month for delays.

[Personal Connection]

When do we get what we pay for?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 5234,
			opened: 0,
			clicked: 0,
			responded: 5234,
			districts_covered: 1,
			total_districts: 1,
			district_coverage_percent: 100
		},
		delivery_config: {
			timing: 'immediate',
			followUp: false,
			cwcEnabled: false
		},
		recipient_config: {
			emails: ['info@cityhall.nyc.gov', 'speakeradams@council.nyc.gov'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['New York City'],
		is_public: true
	},
	{
		title: 'Chicago Spends $4.9B on Police, $50M on Prevention',
		description: 'Expose police budget vs. violence prevention funding.',
		category: 'Public Safety',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'The Math on Violence Prevention',
		preview: "The math doesn't work anymore.",
		message_body: `Dear Mayor Johnson and Chicago City Council,

The math doesn't work anymore.

Police budget: $4.9 billion this year.
Cure Violence programs: $50 million total.
The ratio: 98 to 1 punishment over prevention.

From [Address] where we want both safety AND investment.

[Personal Connection]

What if we tried prevention at scale?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 4567,
			opened: 0,
			clicked: 0,
			responded: 4567,
			districts_covered: 1,
			total_districts: 1,
			district_coverage_percent: 100
		},
		delivery_config: {
			timing: 'immediate',
			followUp: false,
			cwcEnabled: false
		},
		recipient_config: {
			emails: ['mayor@cityofchicago.org', 'ccc@cityofchicago.org'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['Chicago'],
		is_public: true
	}
];

// Generate URL-friendly slug from title
function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.substring(0, 50);
}

async function seedCoreTemplates() {
	console.log('🌱 Starting core template seeding...');

	try {
		// Clear existing templates
		await db.template.deleteMany({});
		console.log('✅ Cleared existing templates');

		// Insert templates
		const createdTemplates = [];
		for (const template of seedTemplates) {
			const slug = generateSlug(template.title);

			const createdTemplate = await db.template.create({
				data: {
					title: template.title,
					slug,
					description: template.description,
					category: template.category,
					type: template.type,
					deliveryMethod: template.deliveryMethod,
					subject: template.subject,
					preview: template.preview,
					message_body: template.message_body,
					metrics: template.metrics,
					delivery_config: template.delivery_config,
					cwc_config: template.cwc_config || {},
					recipient_config: template.recipient_config,
					applicable_countries: template.applicable_countries || [],
					jurisdiction_level: template.jurisdiction_level,
					specific_locations: template.specific_locations || [],
					is_public: template.is_public,
					status: 'published'
				}
			});

			createdTemplates.push(createdTemplate);
			console.log(`📝 Created: "${template.title}" → ${slug}`);
		}

		console.log(`✅ Seeded ${seedTemplates.length} core templates`);
		return createdTemplates;
	} catch (error) {
		console.error('❌ Error seeding core templates:', error);
		throw error;
	}
}

async function seedCongressionalData() {
	console.log('🏛️  Seeding congressional representatives...');

	try {
		// Sample congressional representatives data
		const representatives = [
			{
				bioguide_id: 'P000197',
				name: 'Nancy Pelosi',
				party: 'D',
				state: 'CA',
				district: '11',
				chamber: 'house',
				office_code: 'CA11',
				phone: '(202) 225-4965',
				email: 'sf.nancy@mail.house.gov',
				is_active: true
			},
			{
				bioguide_id: 'S000510',
				name: 'Adam Smith',
				party: 'D',
				state: 'WA',
				district: '09',
				chamber: 'house',
				office_code: 'WA09',
				phone: '(202) 225-8901',
				email: null, // Some don't have public emails
				is_active: true
			},
			{
				bioguide_id: 'F000062',
				name: 'Dianne Feinstein',
				party: 'D',
				state: 'CA',
				district: 'Senior',
				chamber: 'senate',
				office_code: 'CA-Senior',
				phone: '(202) 224-3841',
				email: null,
				is_active: false // Historical data
			}
		];

		// Clear existing data
		await db.representative.deleteMany({});
		await db.congressional_office.deleteMany({});

		// Insert representatives
		for (const rep of representatives) {
			await db.representative.create({
				data: rep
			});

			// Create corresponding office record
			await db.congressional_office.create({
				data: {
					office_code: rep.office_code,
					state: rep.state,
					district: rep.district,
					member_name: rep.name,
					party: rep.party,
					is_active: rep.is_active
				}
			});
		}

		console.log(`✅ Seeded ${representatives.length} representatives and offices`);
	} catch (error) {
		console.error('❌ Error seeding congressional data:', error);
		throw error;
	}
}

async function seedBetaFeatures() {
	console.log('🧪 Seeding beta feature data...');

	if (!isFeatureEnabled('CASCADE_ANALYTICS')) {
		console.log('⚠️  CASCADE_ANALYTICS not enabled, skipping cascade seeding');
		return;
	}

	try {
		// Sample user activation data for cascade analytics
		// This would typically be generated from real user interactions
		console.log('✅ Beta feature seeding completed (placeholder)');
	} catch (error) {
		console.error('❌ Error seeding beta features:', error);
		throw error;
	}
}

async function seedDatabase() {
	console.log('🌱 Starting comprehensive database seed...');
	console.log('='.repeat(50));

	try {
		// Seed core production data
		const templates = await seedCoreTemplates();

		// Seed congressional/representative data
		await seedCongressionalData();

		// Seed beta features if enabled
		await seedBetaFeatures();

		// Verify the data
		const counts = {
			templates: await db.template.count(),
			representatives: await db.representative.count(),
			offices: await db.congressional_office.count()
		};

		console.log('\n📊 Database Summary:');
		console.log('===================');
		console.log(`Templates: ${counts.templates}`);
		console.log(`Representatives: ${counts.representatives}`);
		console.log(`Congressional Offices: ${counts.offices}`);

		// Show URLs
		console.log('\n🌐 Available Templates:');
		console.log('=====================');
		templates.forEach((t) => {
			console.log(`📍 https://communique.app/${t.slug}`);
			console.log(`   "${t.title}" (${t.category} → ${t.jurisdiction_level})`);
			console.log('');
		});

		console.log('📋 Template Distribution:');
		const categories = [...new Set(templates.map((t) => t.category))];
		categories.forEach((cat) => {
			const count = templates.filter((t) => t.category === cat).length;
			console.log(`  • ${cat}: ${count} template${count > 1 ? 's' : ''}`);
		});

		const jurisdictions = [...new Set(templates.map((t) => t.jurisdiction_level))];
		console.log('\n🏛️  Jurisdiction Levels:');
		jurisdictions.forEach((jur) => {
			const count = templates.filter((t) => t.jurisdiction_level === jur).length;
			console.log(`  • ${jur}: ${count} template${count > 1 ? 's' : ''}`);
		});

		console.log('\n🎉 Database seeding completed successfully!\n');
		console.log('💡 Next Steps:');
		console.log('  • Templates are ready for production use');
		console.log('  • Congressional data supports US routing');
		console.log('  • Enable beta features with ENABLE_BETA=true');
		console.log('  • Legislative channels require separate seeding');
		console.log('  • Feature-flagged models available but empty\n');
	} catch (error) {
		console.error('❌ Error seeding database:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}

	process.exit(0);
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seedDatabase();
}
