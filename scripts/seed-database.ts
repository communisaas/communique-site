import { PrismaClient, type User, type Template } from '@prisma/client';
import { isFeatureEnabled } from '../src/lib/features/config.js';

const db: PrismaClient = new PrismaClient();

// ============================================================================
// ZERO ENGAGEMENT SEED DATA
// All templates and users start fresh with no fake metrics
// ============================================================================

// Fresh users - no engagement history
const seedUserData = [
	{
		id: 'user-demo-1',
		email: 'demo@communique.app',
		name: 'ETHDenver Demo',
		is_verified: true,
		verification_method: 'didit',
		verified_at: new Date(),
		document_type: 'passport',
		authority_level: 4,
		birth_year: 1990,
		trust_score: 100,
		reputation_tier: 'verified',
		role: 'Civic Technologist',
		organization: 'ETHDenver',
		location: 'Denver, CO',
		profile_completed_at: new Date(),
		profile_visibility: 'public',
		templates_contributed: 0,
		template_adoption_rate: 0.0,
		peer_endorsements: 0,
		active_months: 0,
		challenge_wins: 0,
		challenge_losses: 0,
		citation_count: 0,
		pending_rewards: '0',
		total_earned: '0'
	},
	{
		id: 'user-demo-2',
		email: 'test@communique.app',
		name: 'Test User',
		is_verified: false,
		trust_score: 0,
		reputation_tier: 'novice',
		templates_contributed: 0,
		template_adoption_rate: 0.0,
		peer_endorsements: 0,
		active_months: 0,
		challenge_wins: 0,
		challenge_losses: 0,
		citation_count: 0,
		pending_rewards: '0',
		total_earned: '0'
	}
];

// Zero metrics for all templates
const ZERO_METRICS = {
	sent: 0,
	opened: 0,
	clicked: 0,
	responded: 0,
	districts_covered: 0,
	total_districts: 435,
	district_coverage_percent: 0
};

// Templates with real content but zero engagement
const templateData = [
	{
		title: "The Math Doesn't Work: Climate Edition",
		description: "Climate subsidies vs disaster costs: the math doesn't add up.",
		category: 'Environment',
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: "Dear [Representative Name], The math doesn't work anymore.",
		message_body: `Dear [Representative Name],

The math doesn't work anymore.

Climate disasters cost: $178 billion in 2024 (NOAA).
Fossil fuel subsidies: $7.4 billion (Treasury Department).
The gap: $170 billion we pay for destruction.

Sources: National Oceanic and Atmospheric Administration, "Billion-Dollar Weather and Climate Disasters" 2024; U.S. Treasury Department, "Energy Tax Expenditures" FY2024

From [Address] where flood insurance is now unaffordable.

[Personal Connection]

Why subsidize the cause of the damage?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: {
			policy_area: 'Environmental Protection',
			topic: 'Climate Subsidies',
			urgency: 'high'
		},
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['energy', 'environment']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: '35% Offices Empty, Only 1 Building Converting',
		description: 'SF office-to-housing conversion failure: 35% vacancy, 1 building converting.',
		category: 'Housing',
		type: 'advocacy',
		deliveryMethod: 'email' as const,
		preview: "The math doesn't work anymore.",
		message_body: `Dear Mayor Lurie and Board of Supervisors,

The math doesn't work anymore.

Office vacancy rate: 35% (SF Controller Q2 2025).
Potential housing units in empty offices: 61,000 (Axios SF).
Actual conversions in pipeline: 1 building, 120 units.

Sources: San Francisco Controller's Office Economic Report Q2 2025; Axios San Francisco, "Empty Offices Could Become 61,000 Housing Units" June 2025

From [Address] where we see ghost towers while families sleep in cars.

[Personal Connection]

We have the space. Where's the will?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
		recipient_config: {
			reach: 'location-specific',
			decisionMakers: [
				{
					name: 'Mayor London Breed',
					shortName: 'Mayor Breed',
					role: 'Mayor',
					organization: 'City of San Francisco'
				},
				{
					name: 'Board of Supervisors',
					shortName: 'SF Board',
					role: 'Board',
					organization: 'City of San Francisco'
				}
			],
			location: { city: 'San Francisco', state: 'CA', jurisdiction: 'San Francisco, CA' },
			emails: ['mayorlurie@sfgov.org', 'board.of.supervisors@sfgov.org']
		},
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true,
		verification_status: 'pending'
	},
	{
		title: 'Housing: $2,400 Rent, $400k Starter Home',
		description: 'Housing math broken: $400k homes, $75k income.',
		category: 'Housing',
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], The housing math has broken America.',
		message_body: `Dear [Representative Name],

The housing math has broken America.

Median home price: $400,000 (Census Bureau 2024, up 47% since 2019).
Median household income: $75,000 (up 12% since 2019).
Years to save 20% down payment: 11 years.
Monthly mortgage at 7%: $3,200 (Freddie Mac data).

Sources: U.S. Department of Housing and Urban Development, "Fair Market Rent Report" 2025; U.S. Census Bureau, "Housing Price Index" 2024; Freddie Mac, "Primary Mortgage Market Survey" 2024

From [Address] where families spend 50% of income on housing.

[Personal Connection]

When did shelter become a luxury?

We need comprehensive housing reform now.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: {
			topic: 'Housing Crisis',
			urgency: 'critical',
			policy_area: 'Housing and Urban Development'
		},
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['financial', 'housing']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: "Kids' Brains for Sale: Zero Privacy Laws",
		description: "Kids's data harvested, mental health destroyed, laws unchanged since 1998.",
		category: 'Digital Rights',
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear Senator, Our kids are the product being sold.',
		message_body: `Dear Senator [Representative Name],

Our kids are the product being sold.

Hours kids spend online daily: 7 (Surgeon General Advisory 2024).
Data points collected per child: 72 million/year (FTC Children's Report).
Mental health crisis age: Down to 8 years old (CDC Youth Survey).
Federal privacy laws for kids: Unchanged since 1998 (COPPA still from 1998).

Sources: U.S. Surgeon General, "Social Media and Youth Mental Health Advisory" 2024; Federal Trade Commission, "Children's Online Privacy Protection Report" 2024; Centers for Disease Control, "Youth Risk Behavior Surveillance" 2024

From [Address] where parents fight algorithms for their children.

[Personal Connection]

Why do tech companies know our kids better than we do?

Pass KOSA and real privacy protection now.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: {
			topic: 'Child Online Safety',
			urgency: 'critical',
			policy_area: 'Commerce and Technology'
		},
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['commerce', 'judiciary']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Uber Nets $9.8B, Drivers Get $318/Week',
		description: 'Gig companies profit billions while workers earn below minimum wage.',
		category: 'Labor Rights',
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Gig economy: record profits, poverty wages.',
		message_body: `Dear [Representative Name],

Gig economy: record profits, poverty wages.

Uber net income (2024): $9.8 billion, "strongest quarter ever" (Uber Q4 Report).
DoorDash revenue growth: 24% YoY to $10.72 billion (DoorDash Annual Report).
Lyft driver earnings: $318/week average, down 13.9% from 2023 (HRW Study).
Federal worker protections: Zero for gig workers (Department of Labor).

Sources: Human Rights Watch, "The Gig Trap" 2025; Uber Technologies Q4 2024 Earnings Report; Massachusetts Attorney General Settlement 2024

Federal: Classify gig workers as employees, mandate benefits, enforce minimum wage.
Corporate: Uber, Lyft, DoorDash, Instacart must provide employee protections.

From [Address] where app workers can't afford rent.

[Personal Connection]

"Independent contractor" means no healthcare, no sick leave, no future.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: {
			topic: 'Gig Worker Rights',
			urgency: 'high',
			policy_area: 'Labor and Employment'
		},
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['labor', 'commerce']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Pharma: $4 Production, $315 Retail, 100x Markup',
		description: 'Insulin costs $4 to make, sells for $315, government pays 100x markup.',
		category: 'Healthcare',
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Pharmaceutical markup: 100x production cost.',
		message_body: `Dear [Representative Name],

Pharmaceutical companies charge 100x production cost with taxpayer money.

Insulin production cost: $2-4 per vial (2018 Study, Yale).
Retail pharmacy price: $315+ per vial (KFF Health News).
Profitable biosimilar price: $61-111/year (97% less than current prices, 2024 Analysis).
Government procurement: 2-9x production cost, sometimes 100x (WHO Report).

Sources: Yale School of Medicine, "Diabetes Medicine Production Costs" 2024; KFF Health News, "Why Does Insulin Cost So Much?" 2024; World Health Organization, "Insulin Pricing Study" 2023

Federal: Mandate cost-based pricing for government purchases, cap retail prices, break pharmacy middleman monopoly.
Corporate: Eli Lilly, Novo Nordisk, Sanofi must justify 100x markup or face generic competition.

From [Address] where rationing insulin means rationing life.

[Personal Connection]

$4 to make, $315 to survive. That's not healthcare, it's extortion.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Drug Pricing', urgency: 'critical', policy_area: 'Healthcare' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['health', 'judiciary']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	}
];

// ============================================================================
// COMPLETE DATABASE TEARDOWN
// ============================================================================

async function teardownDatabase() {
	console.log('🧹 Starting complete database teardown...');
	console.log('='.repeat(50));

	// Delete in dependency order (children before parents)
	const deletions = [
		// Analytics & tracking
		{ name: 'analytics_event', fn: () => db.analytics_event.deleteMany({}) },
		{ name: 'analytics_session', fn: () => db.analytics_session.deleteMany({}) },
		{ name: 'analytics_experiment', fn: () => db.analytics_experiment.deleteMany({}) },

		// Challenges & stakes
		{ name: 'challenge_stake', fn: () => db.challengeStake.deleteMany({}) },
		{ name: 'challenge', fn: () => db.challenge.deleteMany({}) },

		// Audit & actions
		{ name: 'audit_log', fn: () => db.auditLog.deleteMany({}) },
		{ name: 'civic_action', fn: () => db.civicAction.deleteMany({}) },
		{ name: 'reward_calculation', fn: () => db.rewardCalculation.deleteMany({}) },

		// Template relations
		{ name: 'template_jurisdiction', fn: () => db.templateJurisdiction.deleteMany({}) },
		{ name: 'template_scope', fn: () => db.templateScope.deleteMany({}) },
		{ name: 'template_personalization', fn: () => db.template_personalization.deleteMany({}) },
		{ name: 'template_analytics', fn: () => db.template_analytics.deleteMany({}) },
		{ name: 'template_campaign', fn: () => db.template_campaign.deleteMany({}) },
		{ name: 'template_morphism', fn: () => db.template_morphism.deleteMany({}) },
		{ name: 'template_adaptation', fn: () => db.template_adaptation.deleteMany({}) },
		{ name: 'ai_suggestions', fn: () => db.ai_suggestions.deleteMany({}) },
		{ name: 'user_activation', fn: () => db.user_activation.deleteMany({}) },
		{ name: 'message', fn: () => db.message.deleteMany({}) },
		{ name: 'scope_correction', fn: () => db.scopeCorrection.deleteMany({}) },

		// Delivery & jobs
		{ name: 'delivery_log', fn: () => db.deliveryLog.deleteMany({}) },
		{ name: 'cwc_job', fn: () => db.cWCJob.deleteMany({}) },
		{ name: 'submission', fn: () => db.submission.deleteMany({}) },

		// User relations
		{ name: 'user_representatives', fn: () => db.user_representatives.deleteMany({}) },
		{ name: 'user_writing_style', fn: () => db.user_writing_style.deleteMany({}) },
		{ name: 'user_email', fn: () => db.userEmail.deleteMany({}) },
		{ name: 'user_expertise', fn: () => db.userExpertise.deleteMany({}) },
		{ name: 'encrypted_delivery_data', fn: () => db.encryptedDeliveryData.deleteMany({}) },
		{ name: 'shadow_atlas_registration', fn: () => db.shadowAtlasRegistration.deleteMany({}) },
		{ name: 'session', fn: () => db.session.deleteMany({}) },
		{ name: 'account', fn: () => db.account.deleteMany({}) },

		// Agent tracking
		{ name: 'agent_dissent', fn: () => db.agentDissent.deleteMany({}) },
		{ name: 'agent_performance', fn: () => db.agentPerformance.deleteMany({}) },
		{ name: 'cost_tracking', fn: () => db.costTracking.deleteMany({}) },

		// Legislative
		{ name: 'legislative_body', fn: () => db.legislative_body.deleteMany({}) },
		{ name: 'legislative_channel', fn: () => db.legislative_channel.deleteMany({}) },

		// Shadow atlas
		{ name: 'shadow_atlas_tree', fn: () => db.shadowAtlasTree.deleteMany({}) },

		// Core tables (delete last)
		{ name: 'template', fn: () => db.template.deleteMany({}) },
		{ name: 'representative', fn: () => db.representative.deleteMany({}) },
		{ name: 'user', fn: () => db.user.deleteMany({}) }
	];

	for (const { name, fn } of deletions) {
		try {
			const result = await fn();
			if (result.count > 0) {
				console.log(`  ✓ Deleted ${result.count} ${name} records`);
			}
		} catch (error) {
			// Some tables might not exist in all environments
			console.log(`  ⚠ Skipped ${name} (table may not exist)`);
		}
	}

	console.log('✅ Database teardown complete\n');
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.substring(0, 50);
}

async function seedUsers() {
	console.log('👥 Seeding users (zero engagement)...');

	const createdUsers = [];
	for (const userData of seedUserData) {
		const createdUser = await db.user.create({ data: userData });
		createdUsers.push(createdUser);
		console.log(`  ✓ Created: "${userData.name}" (${userData.email})`);
	}

	console.log(`✅ Seeded ${seedUserData.length} users with ZERO engagement\n`);
	return createdUsers;
}

async function seedTemplates(users: User[]) {
	console.log('📝 Seeding templates (zero metrics)...');

	const createdTemplates = [];
	for (let i = 0; i < templateData.length; i++) {
		const template = templateData[i];
		const slug = generateSlug(template.title);
		const assignedUser = users[i % users.length];

		const createdTemplate = await db.template.create({
			data: {
				title: template.title,
				slug,
				description: template.description,
				category: template.category,
				type: template.type,
				deliveryMethod: template.deliveryMethod,
				preview: template.preview,
				message_body: template.message_body,
				metrics: template.metrics,
				delivery_config: template.delivery_config,
				cwc_config: template.cwc_config || {},
				recipient_config: template.recipient_config,
				is_public: template.is_public,
				status: 'published',
				verification_status: template.verification_status || 'pending',
				// ALL ZERO
				verified_sends: 0,
				unique_districts: 0,
				reputation_delta: 0,
				reputation_applied: false,
				...(assignedUser ? { user: { connect: { id: assignedUser.id } } } : {})
			}
		});

		// Create jurisdiction
		if (template.jurisdiction_level === 'federal') {
			await db.templateJurisdiction.create({
				data: {
					template_id: createdTemplate.id,
					jurisdiction_type: 'federal',
					state_code: null,
					congressional_district: null
				}
			});
		} else if (template.jurisdiction_level === 'municipal' && template.specific_locations) {
			for (const location of template.specific_locations) {
				if (location === 'San Francisco') {
					await db.templateJurisdiction.create({
						data: {
							template_id: createdTemplate.id,
							jurisdiction_type: 'city',
							state_code: 'CA',
							city_name: 'San Francisco',
							county_name: 'San Francisco County'
						}
					});
				}
			}
		}

		createdTemplates.push(createdTemplate);
		console.log(`  ✓ "${template.title}" → /${slug}`);
	}

	console.log(`✅ Seeded ${templateData.length} templates with ZERO metrics\n`);
	return createdTemplates;
}

async function seedRepresentatives() {
	console.log('🏛️  Seeding congressional representatives...');

	const representatives = [
		{
			bioguide_id: 'P000197',
			name: 'Nancy Pelosi',
			party: 'D',
			state: 'CA',
			district: '11',
			chamber: 'house',
			office_code: 'CA11',
			email: 'sf.nancy@mail.house.gov',
			is_active: true,
			office_address: '1236 3rd Street, Suite 1',
			office_city: 'San Francisco',
			office_state: 'CA',
			office_zip: '94158',
			term_start: new Date('2023-01-03'),
			term_end: new Date('2025-01-03'),
			current_term: 19,
			data_source: 'congress_api',
			source_updated_at: new Date('2024-01-15')
		},
		{
			bioguide_id: 'S000510',
			name: 'Adam Smith',
			party: 'D',
			state: 'WA',
			district: '09',
			chamber: 'house',
			office_code: 'WA09',
			email: null,
			is_active: true,
			office_address: '101 Evergreen Building, 15 S Grady Way',
			office_city: 'Renton',
			office_state: 'WA',
			office_zip: '98057',
			term_start: new Date('2023-01-03'),
			term_end: new Date('2025-01-03'),
			current_term: 14,
			data_source: 'congress_api',
			source_updated_at: new Date('2024-01-15')
		}
	];

	for (const rep of representatives) {
		await db.representative.create({ data: rep });
		console.log(`  ✓ ${rep.name} (${rep.state}-${rep.district})`);
	}

	console.log(`✅ Seeded ${representatives.length} representatives\n`);
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedDatabase() {
	console.log('\n🌱 FRESH DATABASE SEED');
	console.log('='.repeat(50));
	console.log('All engagement data starts at ZERO\n');

	try {
		// Step 1: Complete teardown
		await teardownDatabase();

		// Step 2: Seed fresh data
		const users = await seedUsers();
		const templates = await seedTemplates(users);
		await seedRepresentatives();

		// Step 3: Verify
		const counts = {
			users: await db.user.count(),
			templates: await db.template.count(),
			representatives: await db.representative.count()
		};

		console.log('📊 Database Summary');
		console.log('='.repeat(50));
		console.log(`Users:          ${counts.users} (all unverified, zero engagement)`);
		console.log(`Templates:      ${counts.templates} (all zero sends, zero metrics)`);
		console.log(`Representatives: ${counts.representatives}`);

		console.log('\n✅ Fresh seed complete - all engagement data is ZERO\n');
	} catch (error) {
		console.error('❌ Seed failed:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}

	process.exit(0);
}

// Run if executed directly
if (process.argv[1]?.endsWith('seed-database.ts')) {
	seedDatabase();
}
