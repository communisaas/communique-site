import type { Template } from '$lib/types/template';

/**
 * Calculate coordination scale from send count (logarithmic scale)
 * 1 send = 0.0, 10 = 0.33, 100 = 0.67, 1000+ = 1.0
 */
function calculateCoordinationScale(sendCount: number): number {
	if (sendCount <= 1) return 0.0;
	if (sendCount >= 1000) return 1.0;
	return Math.log10(sendCount) / 3; // log10(1000) = 3
}

/**
 * Mock template data for Week 1-2 UX development
 *
 * Phase 1 Strategy: Build UX layer FIRST with mock data to validate user flow
 *
 * These templates demonstrate:
 * - Congressional (CWC) vs Direct email delivery methods
 * - Aggregate metrics (verified_sends, unique_districts)
 * - Privacy-preserving stats (no individual tracking)
 * - Various categories (healthcare, climate, education, justice)
 *
 * Backend integration: Week 5-6 (will replace with real Postgres data)
 */
export const mockTemplates: Template[] = [
	{
		id: 'mock-1',
		slug: 'support-medicare-expansion',
		title: 'Support Medicare Expansion',
		description:
			'Urge your representatives to expand Medicare coverage to include dental, vision, and hearing benefits for all seniors.',
		category: 'Healthcare',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			"I am writing to urge you to support the Medicare Expansion Act. As a constituent in your district, I believe that all seniors deserve access to comprehensive healthcare, including dental, vision, and hearing coverage.\n\nThis is not just about healthcare—it's about dignity and quality of life for millions of Americans who have worked hard their entire lives.",
		subject: 'Support Medicare Expansion - Constituent Request',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 1247,
			districts_covered: 89,
			total_districts: 435,
			district_coverage_percent: 20
		},
		send_count: 1247,
		coordinationScale: calculateCoordinationScale(1247),
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Urge your representatives to expand Medicare coverage to include dental, vision, and hearing benefits...',
		verification_status: 'approved',
		quality_score: 92,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	},
	{
		id: 'mock-2',
		slug: 'climate-action-now',
		title: 'Demand Climate Action Now',
		description:
			'Call on Congress to pass comprehensive climate legislation that invests in renewable energy and protects our environment for future generations.',
		category: 'Climate',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			'The climate crisis is the defining challenge of our generation. I am writing to demand that you support bold climate action, including investments in renewable energy, electric vehicle infrastructure, and protection of our natural resources.\n\nWe cannot afford to wait. The science is clear, and the time for action is now.',
		subject: 'Urgent: Support Climate Action Legislation',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 2834,
			districts_covered: 142,
			total_districts: 435,
			district_coverage_percent: 33
		},
		send_count: 2834,
		coordinationScale: 1.0000,
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Call on Congress to pass comprehensive climate legislation that invests in renewable energy...',
		verification_status: 'approved',
		quality_score: 95,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	},
	{
		id: 'mock-3',
		slug: 'student-debt-relief',
		title: 'Cancel Student Debt',
		description:
			'Support comprehensive student debt cancellation to relieve the burden on millions of Americans and stimulate economic growth.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			"Student debt is crushing an entire generation of Americans. I am writing to ask you to support comprehensive student debt cancellation.\n\nThis is not just about individual relief—it's about economic justice and enabling young people to buy homes, start businesses, and contribute fully to our economy.",
		subject: 'Support Student Debt Cancellation',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 3912,
			districts_covered: 201,
			total_districts: 435,
			district_coverage_percent: 46
		},
		send_count: 3912,
		coordinationScale: 1.0000,
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Support comprehensive student debt cancellation to relieve the burden on millions of Americans...',
		verification_status: 'approved',
		quality_score: 89,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	},
	{
		id: 'mock-4',
		slug: 'protect-voting-rights',
		title: 'Protect Voting Rights',
		description:
			'Demand that Congress pass legislation to protect and expand voting rights for all Americans.',
		category: 'Democracy',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			'Voting is the foundation of our democracy. I am writing to urge you to support legislation that protects and expands voting rights, including early voting, mail-in voting, and automatic voter registration.\n\nEvery eligible American should have easy access to the ballot box.',
		subject: 'Protect Voting Rights - Urgent Action Needed',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 1589,
			districts_covered: 67,
			total_districts: 435,
			district_coverage_percent: 15
		},
		send_count: 1589,
		coordinationScale: 1.0000,
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Demand that Congress pass legislation to protect and expand voting rights for all Americans...',
		verification_status: 'approved',
		quality_score: 91,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	},
	{
		id: 'mock-5',
		slug: 'criminal-justice-reform',
		title: 'End Mass Incarceration',
		description:
			'Support comprehensive criminal justice reform to end mass incarceration and address systemic inequities.',
		category: 'Justice',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			'Mass incarceration is a moral crisis and a failed policy. I am writing to ask you to support comprehensive criminal justice reform, including ending mandatory minimum sentences, investing in rehabilitation programs, and addressing racial disparities in sentencing.\n\nWe can create a safer, more just society without locking up millions of Americans.',
		subject: 'Support Criminal Justice Reform',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 742,
			districts_covered: 45,
			total_districts: 435,
			district_coverage_percent: 10
		},
		send_count: 742,
		coordinationScale: 0.9568,
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Support comprehensive criminal justice reform to end mass incarceration and address systemic inequities...',
		verification_status: 'approved',
		quality_score: 88,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	},
	{
		id: 'mock-6',
		slug: 'affordable-housing',
		title: 'Fund Affordable Housing',
		description:
			'Demand federal investment in affordable housing to address the housing crisis affecting millions of Americans.',
		category: 'Housing',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			'The housing crisis is pushing families into poverty and homelessness. I am writing to urge you to support federal investment in affordable housing, including increased funding for public housing and rent assistance programs.\n\nHousing is a human right, and no one should have to choose between paying rent and buying food.',
		subject: 'Support Affordable Housing Investment',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 967,
			districts_covered: 58,
			total_districts: 435,
			district_coverage_percent: 13
		},
		send_count: 967,
		coordinationScale: 0.9951,
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Demand federal investment in affordable housing to address the housing crisis affecting millions...',
		verification_status: 'approved',
		quality_score: 90,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	},
	{
		id: 'mock-7',
		slug: 'raise-minimum-wage',
		title: 'Raise the Minimum Wage',
		description:
			'Support legislation to raise the federal minimum wage to $15 per hour to ensure working families can afford basic necessities.',
		category: 'Economy',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			'No one who works full-time should live in poverty. I am writing to ask you to support raising the federal minimum wage to $15 per hour.\n\nThis is about basic economic justice and ensuring that working families can afford rent, food, and healthcare.',
		subject: 'Support $15 Minimum Wage',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 2145,
			districts_covered: 112,
			total_districts: 435,
			district_coverage_percent: 26
		},
		send_count: 2145,
		coordinationScale: 1.0000,
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Support legislation to raise the federal minimum wage to $15 per hour to ensure working families can afford...',
		verification_status: 'approved',
		quality_score: 93,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	},
	{
		id: 'mock-8',
		slug: 'universal-healthcare',
		title: 'Support Medicare for All',
		description:
			'Urge Congress to pass Medicare for All legislation to guarantee healthcare as a human right for every American.',
		category: 'Healthcare',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		message_body:
			'Healthcare should be a human right, not a privilege for those who can afford it. I am writing to urge you to support Medicare for All.\n\nThis system would save money, improve health outcomes, and ensure that no American goes bankrupt because of medical bills.',
		subject: 'Support Medicare for All',
		delivery_config: {},
		recipient_config: {},
		metrics: {
			sent: 4521,
			districts_covered: 234,
			total_districts: 435,
			district_coverage_percent: 54
		},
		send_count: 4521,
		coordinationScale: 1.0000,
		isNew: false,
		is_public: true,
		status: 'approved',
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		specific_locations: [],
		preview:
			'Urge Congress to pass Medicare for All legislation to guarantee healthcare as a human right...',
		verification_status: 'approved',
		quality_score: 96,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	}
];
