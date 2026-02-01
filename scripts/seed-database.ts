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
		name: 'Demo User',
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
		topics: ['climate', 'subsidies', 'environment', 'disaster-relief'],
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
		topics: ['housing', 'office-conversion', 'urban-development', 'san-francisco'],
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
					name: 'Mayor Daniel Lurie',
					shortName: 'Mayor Lurie',
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
		topics: ['housing', 'affordability', 'homeownership', 'mortgage'],
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
		topics: ['digital-rights', 'privacy', 'children', 'technology', 'social-media'],
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
		topics: ['labor', 'gig-economy', 'worker-rights', 'minimum-wage'],
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
		topics: ['healthcare', 'drug-pricing', 'pharmaceutical', 'insulin'],
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
	},
	// ========================================================================
	// NEW TEMPLATES - Real issues with citations
	// ========================================================================
	{
		title: 'Student Debt: $1.7T Owed, $0 Forgiven',
		description: 'Student loan forgiveness blocked while debt crushes 45 million Americans.',
		category: 'Education',
		topics: ['education', 'student-debt', 'loans', 'forgiveness'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], 45 million Americans owe $1.7 trillion.',
		message_body: `Dear [Representative Name],

45 million Americans owe $1.7 trillion in student debt.

Total student debt: $1.77 trillion (Federal Reserve Q4 2024).
Average debt per borrower: $37,850 (Education Data Initiative 2025).
Biden forgiveness blocked: $430 billion struck down (SCOTUS June 2023).
Monthly payments restarted: October 2023, delinquencies up 40%.

Sources: Federal Reserve Bank of New York, "Household Debt and Credit Report" Q4 2024; Education Data Initiative, "Student Loan Debt Statistics" 2025; Supreme Court, Biden v. Nebraska (2023)

From [Address] where graduates delay homes, families, and futures.

[Personal Connection]

A degree shouldn't mean a lifetime of debt.

Pass the Student Loan Relief Act now.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Student Loan Reform', urgency: 'high', policy_area: 'Education' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['education', 'finance']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'AI Took 14,000 Jobs Last Month, Zero Laws Passed',
		description: 'AI displaces workers at record pace while Congress debates definitions.',
		category: 'Technology',
		topics: ['ai', 'automation', 'jobs', 'technology', 'unemployment'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], AI is moving faster than democracy.',
		message_body: `Dear [Representative Name],

AI is moving faster than democracy.

Jobs displaced by AI (Jan 2025): 14,000+ in single month (Challenger Report).
Companies citing AI in layoffs: Up 300% YoY (Bloomberg Analysis).
Retraining programs funded: $0 federal dollars for AI displacement.
AI legislation passed: Zero comprehensive laws since ChatGPT launch.

Sources: Challenger, Gray & Christmas "Job Cuts Report" January 2025; Bloomberg, "AI-Related Layoffs Surge" 2025; Congressional Research Service, "AI Workforce Impact" 2024

From [Address] where my skills became obsolete overnight.

[Personal Connection]

We need transition support, not just innovation celebration.

Fund AI displacement programs and pass worker protection laws.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'AI and Employment', urgency: 'critical', policy_area: 'Technology' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['technology', 'labor']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Groceries Up 25%, Wages Up 4%',
		description: 'Food prices outpace wages 6:1 while corporate profits hit records.',
		category: 'Economy',
		topics: ['inflation', 'groceries', 'wages', 'cost-of-living', 'corporate-profits'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], Families choose between food and rent.',
		message_body: `Dear [Representative Name],

Families are choosing between food and rent.

Grocery prices since 2020: Up 25% (Bureau of Labor Statistics).
Real wages since 2020: Up 4% (adjusted for inflation).
Kroger profit margin 2024: Record $2.2 billion (SEC Filing).
SNAP benefit increase: 0% in 2025 (USDA).

Sources: Bureau of Labor Statistics, "Consumer Price Index - Food" January 2025; Kroger Co. Form 10-K FY2024; USDA Food and Nutrition Service, "SNAP Cost-of-Living Adjustments" 2025

From [Address] where the grocery bill doubled but the paycheck didn't.

[Personal Connection]

Record profits + record prices = policy failure.

Investigate grocery price-fixing and expand SNAP benefits.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Food Prices', urgency: 'high', policy_area: 'Consumer Protection' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['agriculture', 'commerce']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Rent Control Works: 1M Units Saved in NYC',
		description: 'Cities with rent control kept 1M affordable units. States without lost them.',
		category: 'Housing',
		topics: ['housing', 'rent-control', 'affordability', 'tenants-rights'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], The data is clear: rent control works.',
		message_body: `Dear [Representative Name],

The data is clear: rent control works.

NYC rent-stabilized units preserved: 1 million apartments (NYC Rent Guidelines Board).
Average rent-stabilized rent: $1,400/month vs $3,500 market rate.
States banning rent control: 31 states with preemption laws.
Affordable units lost nationally: 4.7 million since 2010 (Harvard JCHS).

Sources: NYC Rent Guidelines Board, "2024 Housing Supply Report"; Harvard Joint Center for Housing Studies, "State of the Nation's Housing" 2024; National Multifamily Housing Council, "Rent Control Laws by State" 2024

From [Address] where landlords raise rent 20% yearly.

[Personal Connection]

Let cities decide what works for their residents.

Repeal state rent control preemption laws.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Rent Stabilization', urgency: 'high', policy_area: 'Housing' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['housing', 'judiciary']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Billionaires Pay 8% Tax, Workers Pay 25%',
		description: 'The ultra-wealthy pay a lower tax rate than nurses and teachers.',
		category: 'Economy',
		topics: ['taxes', 'wealth-inequality', 'billionaires', 'tax-reform'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], Billionaires pay less than their secretaries.',
		message_body: `Dear [Representative Name],

Warren Buffett was right: billionaires pay less than their secretaries.

Effective tax rate for billionaires: 8.2% (White House 2021 Analysis).
Effective tax rate for median worker: 25% (Tax Policy Center).
Wealth held by top 1%: $45 trillion, 32% of all US wealth.
IRS audit rate for millionaires: Down 80% since 2010.

Sources: White House, "The Economics of Taxing the Wealthy" September 2021; Tax Policy Center, "Effective Tax Rates by Income" 2024; Federal Reserve, "Distribution of Household Wealth" Q3 2024

From [Address] where I pay more than Elon Musk.

[Personal Connection]

The tax code is upside down.

Pass the Billionaire Minimum Income Tax.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Tax Fairness', urgency: 'high', policy_area: 'Taxation' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['finance', 'ways-and-means']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Police Budgets Up 45%, Crime Down 12%',
		description: 'More police spending hasn\'t solved crime. Prevention programs have.',
		category: 'Public Safety',
		topics: ['policing', 'crime', 'public-safety', 'prevention', 'budget'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], We\'re spending more and getting less.',
		message_body: `Dear [Representative Name],

We're spending more on policing and getting less.

Police budgets since 2014: Up 45% ($150B → $218B nationwide).
Violent crime clearance rate: 41% (FBI 2023) - down from 47% in 2014.
Cities with violence intervention programs: 65% reduction in shootings (GIFFORDS).
Federal prevention funding: $0.50 for every $1,000 spent on policing.

Sources: Bureau of Justice Statistics, "Justice Expenditure and Employment" 2024; FBI Uniform Crime Report 2023; GIFFORDS Law Center, "Community Violence Intervention Programs" 2024

From [Address] where we need solutions, not just sirens.

[Personal Connection]

Prevention works. Let's fund what actually reduces crime.

Invest in community violence intervention programs.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Public Safety', urgency: 'medium', policy_area: 'Criminal Justice' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['judiciary', 'appropriations']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Maternal Deaths: US Worst in Developed World',
		description: 'American mothers die at 3x the rate of other wealthy nations.',
		category: 'Healthcare',
		topics: ['healthcare', 'maternal-health', 'womens-health', 'mortality'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], Giving birth shouldn\'t be deadly.',
		message_body: `Dear [Representative Name],

Giving birth in America shouldn't be deadly. But it is.

US maternal mortality rate: 32.9 per 100,000 births (CDC 2024).
UK maternal mortality rate: 10.9 per 100,000 births.
Black maternal mortality: 69.9 per 100,000 - 3x white mothers.
Maternal deaths preventable: 84% (Commonwealth Fund 2023).

Sources: CDC National Center for Health Statistics, "Maternal Mortality Rates" 2024; Commonwealth Fund, "Maternal Mortality and Morbidity in the U.S." 2023; WHO, "Trends in Maternal Mortality" 2023

From [Address] where pregnancy is riskier than in 49 other countries.

[Personal Connection]

Every mother deserves to survive childbirth.

Pass the Momnibus Act and fund maternal health programs.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Maternal Health', urgency: 'critical', policy_area: 'Healthcare' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['health', 'appropriations']
		},
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved'
	},
	{
		title: 'Broadband: $42B Spent, 0 New Homes Connected',
		description: 'Billions for rural broadband, zero homes connected after 3 years.',
		category: 'Technology',
		topics: ['broadband', 'internet', 'rural', 'infrastructure', 'digital-divide'],
		type: 'advocacy',
		deliveryMethod: 'cwc' as const,
		preview: 'Dear [Representative Name], Where did $42 billion go?',
		message_body: `Dear [Representative Name],

Where did $42 billion for broadband go?

BEAD Program funding: $42.45 billion allocated (NTIA 2022).
New homes connected to date: 0 (GAO Report January 2025).
Americans without broadband: 24 million, mostly rural.
Program timeline: 3 years in, no construction started.

Sources: National Telecommunications and Information Administration, "BEAD Program Allocations" 2022; Government Accountability Office, "Broadband: Actions Needed to Address Continuing Deployment Challenges" January 2025; FCC, "Broadband Deployment Report" 2024

From [Address] where we still can't get reliable internet.

[Personal Connection]

We were promised connectivity. We got bureaucracy.

Accelerate BEAD deployment and hold states accountable.

Sincerely,
[Name]
[Address]`,
		metrics: ZERO_METRICS,
		delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
		cwc_config: { topic: 'Rural Broadband', urgency: 'high', policy_area: 'Technology' },
		recipient_config: {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			committees: ['commerce', 'appropriations']
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
				topics: template.topics || [],
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
