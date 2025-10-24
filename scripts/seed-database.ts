import { PrismaClient, type User, type Template } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { isFeatureEnabled } from '../src/lib/features/config.js';

// Representative type (Prisma generates lowercase table names)
type Representative = {
	id: string;
	bioguide_id: string;
	name: string;
	party: string;
	state: string;
	district: string;
	chamber: string;
	office_code: string;
	email: string | null;
	is_active: boolean;
	office_address: string;
	office_city: string;
	office_state: string;
	office_zip: string;
	term_start: Date;
	term_end: Date;
	current_term: number;
	data_source: string;
	source_updated_at: Date;
};

// Type definitions for seed data
interface SeedTemplateData {
	title: string;
	description: string;
	category: string;
	type: string;
	deliveryMethod: 'email' | 'certified' | 'direct' | 'cwc';
	preview: string;
	message_body: string;
	metrics: Record<string, unknown>;
	delivery_config: Record<string, unknown>;
	cwc_config?: Record<string, unknown>;
	recipient_config: Record<string, unknown>;
	applicable_countries: string[];
	jurisdiction_level: string;
	specific_locations?: string[];
	is_public: boolean;
	// Verification fields
	verification_status?: string;
	quality_score?: number;
	agent_votes?: Prisma.JsonValue | null;
	consensus_score?: number | null;
	severity_level?: number | null;
	grammar_score?: number | null;
	clarity_score?: number | null;
	completeness_score?: number | null;
	correction_log?: Prisma.JsonValue | null;
	original_content?: Prisma.JsonValue | null;
	corrected_at?: Date | null;
	reviewed_at?: Date | null;
	reputation_delta?: number;
	reputation_applied?: boolean;
	send_count?: number;
	last_sent_at?: Date | null;
}

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
		description: "Climate subsidies vs disaster costs: the math doesn't add up.",
		category: 'Environment',
		type: 'advocacy',
		deliveryMethod: 'cwc',
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
		is_public: true,
		// === VERIFICATION FIELDS ===
		verification_status: 'approved',
		quality_score: 92,
		agent_votes: {
			openai: {
				score: 0.94,
				reasoning: 'Strong data-driven arguments with clear impact metrics',
				confidence: 0.88
			},
			gemini: {
				score: 0.89,
				reasoning: 'Compelling narrative with factual support',
				confidence: 0.91
			}
		},
		consensus_score: 0.915,
		severity_level: 8,
		grammar_score: 95,
		clarity_score: 90,
		completeness_score: 88,
		correction_log: [
			{
				timestamp: '2024-12-15T10:30:00Z',
				type: 'grammar',
				changes: ['Fixed comma splice in opening paragraph'],
				agent: 'openai'
			}
		],
		original_content: {
			body: 'Original text before corrections...'
		},
		corrected_at: new Date('2024-12-15T10:30:00Z'),
		reviewed_at: new Date('2024-12-15T14:20:00Z'),
		reputation_delta: 15.5,
		reputation_applied: true,
		send_count: 8234,
		last_sent_at: new Date('2024-12-20T16:45:00Z')
	},
	{
		title: '35% Offices Empty, Only 1 Building Converting',
		description: 'SF office-to-housing conversion failure: 35% vacancy, 1 building converting.',
		category: 'Housing',
		type: 'advocacy',
		deliveryMethod: 'email',
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
		metrics: { sent: 0, opened: 0, clicked: 0, responded: 0 },
		delivery_config: {
			timing: 'immediate',
			followUp: false,
			cwcEnabled: false
		},
		recipient_config: {
			emails: ['mayorlurie@sfgov.org', 'board.of.supervisors@sfgov.org'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true,
		// === VERIFICATION FIELDS ===
		verification_status: 'pending',
		quality_score: 50,
		agent_votes: null,
		consensus_score: null,
		severity_level: null,
		grammar_score: null,
		clarity_score: null,
		completeness_score: null,
		correction_log: null,
		original_content: null,
		corrected_at: null,
		reviewed_at: null,
		reputation_delta: 0,
		reputation_applied: false,
		send_count: 0,
		last_sent_at: null
	},
	{
		title: 'SF Teachers Commute 2 Hours, Students Skip School',
		description: 'How teacher housing costs hurt SF student outcomes.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'email',
		preview: "The math doesn't work anymore.",
		message_body: `Dear San Francisco Board of Education,

The math doesn't work anymore.

Teachers commute 2+ hours because they can't afford SF (SFUSD Survey 2025).
Students miss 30+ school days due to housing instability (CA Dept of Education).
The connection: No stable adults, no stable learning.

Sources: San Francisco Unified School District Teacher Housing Survey 2025; SF Chronicle, "Housing Crisis Hits Education" January 2025; California Department of Education, "Student Housing Instability Report" 2024

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
		is_public: true,
		// === VERIFICATION FIELDS ===
		verification_status: 'reviewing',
		quality_score: 78,
		agent_votes: {
			openai: {
				score: 0.82,
				reasoning:
					'Good connection between housing and education, needs minor clarity improvements',
				confidence: 0.85
			},
			gemini: {
				score: 0.75,
				reasoning: 'Solid argument but could use more specific local data',
				confidence: 0.79
			}
		},
		consensus_score: 0.785,
		severity_level: 6,
		grammar_score: 88,
		clarity_score: 75,
		completeness_score: 72,
		correction_log: [
			{
				timestamp: '2024-12-18T09:15:00Z',
				type: 'clarity',
				changes: ['Improved flow between housing costs and education impact'],
				agent: 'gemini'
			}
		],
		original_content: {
			body: 'Original version before clarity improvements...'
		},
		corrected_at: new Date('2024-12-18T09:15:00Z'),
		reviewed_at: null,
		reputation_delta: 0,
		reputation_applied: false,
		send_count: 3421,
		last_sent_at: new Date('2024-12-19T11:30:00Z')
	},
	{
		title: '750,000 Sq Ft Ghost Town: Union Square Retail Collapse',
		description: 'Union Square retail collapse: 750k sq ft empty downtown.',
		category: 'Economic Development',
		type: 'advocacy',
		deliveryMethod: 'email',
		preview: "The math doesn't work anymore.",
		message_body: `Dear Mayor Lurie and Board of Supervisors,

The math doesn't work anymore.

Union Square retail vacancy: 22% (CoStar Group Q2 2025).
Empty square footage: 750,000 sq ft in city center.
Lost retail jobs: Thousands fleeing to suburbs.

Sources: CoStar Group Commercial Real Estate Research Q2 2025; Union Square Business Improvement District, "Retail Vacancy Crisis" 2025

From [Address] where our downtown becomes a ghost town.

[Personal Connection]

No shoppers = No city center.

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
			emails: ['mayorlurie@sfgov.org', 'oewd@sfgov.org'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true,
		// === VERIFICATION FIELDS ===
		verification_status: 'approved',
		quality_score: 85,
		agent_votes: {
			openai: {
				score: 0.87,
				reasoning: 'Clear data comparison with strong emotional appeal',
				confidence: 0.92
			},
			gemini: {
				score: 0.83,
				reasoning: 'Effective use of concrete numbers and personal impact',
				confidence: 0.88
			}
		},
		consensus_score: 0.85,
		severity_level: 7,
		grammar_score: 92,
		clarity_score: 85,
		completeness_score: 80,
		correction_log: [
			{
				timestamp: '2024-12-16T14:20:00Z',
				type: 'grammar',
				changes: ['Fixed inconsistent number formatting'],
				agent: 'openai'
			},
			{
				timestamp: '2024-12-16T14:25:00Z',
				type: 'clarity',
				changes: ['Strengthened transition between statistics and personal impact'],
				agent: 'gemini'
			}
		],
		original_content: {
			body: 'Original content before formatting and clarity improvements...'
		},
		corrected_at: new Date('2024-12-16T14:25:00Z'),
		reviewed_at: new Date('2024-12-16T18:00:00Z'),
		reputation_delta: 12.3,
		reputation_applied: true,
		send_count: 5234,
		last_sent_at: new Date('2024-12-21T08:15:00Z')
	},
	{
		title: 'SFUSD Lost 5,000 Kids to Housing Crisis',
		description: 'Schools close as families flee to affordable cities.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'email',
		preview: "The math doesn't work anymore.",
		message_body: `Dear Board of Education and Mayor Lurie,

The math doesn't work anymore.

SFUSD enrollment drop: 5,000 students since 2017 (SFUSD 2025).
Budget deficit: $400 million.
Positions being cut: 535, including 300+ teachers.

Sources: San Francisco Unified School District Budget Development FAQs 2025-26; SF Chronicle, "SFUSD Closures as Enrollment Declines" 2024

From [Address] where schools empty as families flee to affordable cities.

[Personal Connection]

No families = No future for SF.

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
			emails: ['board@sfusd.edu', 'mayorlurie@sfgov.org'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true,
		// === VERIFICATION FIELDS ===
		verification_status: 'rejected',
		quality_score: 68,
		agent_votes: {
			openai: {
				score: 0.65,
				reasoning: 'Potentially divisive framing, needs balanced approach to public safety',
				confidence: 0.82
			},
			gemini: {
				score: 0.71,
				reasoning: 'Good data but oversimplifies complex public safety challenges',
				confidence: 0.77
			}
		},
		consensus_score: 0.68,
		severity_level: 4,
		grammar_score: 85,
		clarity_score: 78,
		completeness_score: 65,
		correction_log: [
			{
				timestamp: '2024-12-17T13:45:00Z',
				type: 'content',
				changes: ['Suggested more nuanced framing of prevention vs enforcement'],
				agent: 'openai'
			},
			{
				timestamp: '2024-12-17T14:00:00Z',
				type: 'balance',
				changes: ['Recommended acknowledging value of both approaches'],
				agent: 'gemini'
			}
		],
		original_content: {
			body: 'Original version with less balanced framing...'
		},
		corrected_at: new Date('2024-12-17T14:00:00Z'),
		reviewed_at: new Date('2024-12-17T16:30:00Z'),
		reputation_delta: -5.2,
		reputation_applied: true,
		send_count: 4567,
		last_sent_at: new Date('2024-12-20T12:00:00Z')
	},
	{
		title: 'Congress Just Spent $858B on Defense, $0 on Child Care',
		description: 'Defense gets $858B, childcare gets $0.',
		category: 'Family Policy',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		preview: "Dear Representative, The math doesn't work for families.",
		message_body: `Dear Representative [Representative Name],

The math doesn't work for families.

Defense budget: $858 billion (NDAA FY2024, passed unanimously).
Federal child care funding: $0 additional (CBO Budget Analysis).
The message: Weapons matter more than children.

Sources: National Defense Authorization Act for Fiscal Year 2024; Congressional Budget Office, "Federal Budget Analysis FY2024"; Department of Health and Human Services, "Child Care Funding Gap Report" 2024

From [Address] where childcare costs $2,400/month.

[Personal Connection]

When do families get the same priority as fighter jets?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 12450,
			opened: 0,
			clicked: 0,
			responded: 12450,
			districts_covered: 325,
			total_districts: 435,
			district_coverage_percent: 75
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'Family Policy',
			urgency: 'high',
			policy_area: 'Social Services'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['budget', 'education'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved',
		quality_score: 88,
		agent_votes: {
			openai: {
				score: 0.89,
				reasoning: 'Strong contrast between defense and family priorities, compelling data',
				confidence: 0.92
			},
			gemini: {
				score: 0.87,
				reasoning: 'Effective use of numbers to highlight budget contradictions',
				confidence: 0.89
			}
		},
		consensus_score: 0.88,
		severity_level: 8,
		grammar_score: 92,
		clarity_score: 88,
		completeness_score: 85,
		correction_log: [],
		original_content: null,
		corrected_at: null,
		reviewed_at: new Date('2024-12-15T10:30:00Z'),
		reputation_delta: 8.5,
		reputation_applied: true,
		send_count: 12450,
		last_sent_at: new Date('2024-12-19T14:20:00Z')
	},
	{
		title: 'Medicare Pays $3,000 for $300 Insulin',
		description: 'Insulin costs $10 to make, Medicare pays $300.',
		category: 'Healthcare',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		preview: "Dear Senator, The math doesn't work for patients.",
		message_body: `Dear Senator [Representative Name],

The math doesn't work for patients.

Insulin production cost: $10 per vial (HHS OIG Report).
Medicare reimburses: $300 per vial (CMS data).
Patient pays: Still $35 copay (Part D analysis).
Pharma profit: 900% markup on taxpayer dollars.

Sources: Department of Health and Human Services Office of Inspector General, "Insulin Pricing and Access Report" 2024; Centers for Medicare & Medicaid Services, "Part D Drug Spending Dashboard" 2024

From [Address] where diabetes shouldn't mean bankruptcy.

[Personal Connection]

When do patients get fair pricing?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 18234,
			opened: 0,
			clicked: 0,
			responded: 18234,
			districts_covered: 398,
			total_districts: 435,
			district_coverage_percent: 91
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'Healthcare Costs',
			urgency: 'high',
			policy_area: 'Healthcare'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['health', 'judiciary'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved',
		quality_score: 95,
		agent_votes: {
			openai: {
				score: 0.96,
				reasoning: 'Excellent use of specific pricing data, highly relatable healthcare issue',
				confidence: 0.94
			},
			gemini: {
				score: 0.94,
				reasoning: 'Powerful combination of cost data and personal impact',
				confidence: 0.91
			}
		},
		consensus_score: 0.95,
		severity_level: 9,
		grammar_score: 96,
		clarity_score: 94,
		completeness_score: 92,
		correction_log: [],
		original_content: null,
		corrected_at: null,
		reviewed_at: new Date('2024-12-14T15:45:00Z'),
		reputation_delta: 12.3,
		reputation_applied: true,
		send_count: 18234,
		last_sent_at: new Date('2024-12-20T09:15:00Z')
	},
	{
		title: 'Student Loans: $1.7T Debt, $0 Job Guarantee',
		description: 'Graduates pay $393/month for degrees that guarantee nothing.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		preview: "Dear Representative, The math doesn't work for students.",
		message_body: `Dear Representative [Representative Name],

The math doesn't work for students.

Total student debt: $1.7 trillion (Federal Reserve Q3 2024).
Federal job guarantee: $0 (Department of Education).
Average monthly payment: $393 (Fed Student Aid data).
Real wage growth since 1980: -2.3% (Bureau of Labor Statistics).

Sources: Federal Reserve Bank, "Quarterly Report on Household Debt" Q3 2024; U.S. Department of Education, "Federal Student Aid Portfolio Summary" 2024; Bureau of Labor Statistics, "Real Earnings Summary" 2024

From [Address] where degrees cost fortunes but guarantee nothing.

[Personal Connection]

When do graduates get what they paid for?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 9876,
			opened: 0,
			clicked: 0,
			responded: 9876,
			districts_covered: 287,
			total_districts: 435,
			district_coverage_percent: 66
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'Student Debt',
			urgency: 'medium',
			policy_area: 'Education'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['education', 'budget'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'pending',
		quality_score: 82,
		agent_votes: {
			openai: {
				score: 0.83,
				reasoning: 'Strong data on student debt crisis, could use more specific policy asks',
				confidence: 0.85
			},
			gemini: {
				score: 0.81,
				reasoning: 'Good framing of education investment vs outcomes',
				confidence: 0.82
			}
		},
		consensus_score: 0.82,
		severity_level: 7,
		grammar_score: 89,
		clarity_score: 81,
		completeness_score: 78,
		correction_log: [
			{
				timestamp: '2024-12-18T11:20:00Z',
				type: 'clarity',
				changes: ['Suggested adding specific policy recommendations'],
				agent: 'openai'
			}
		],
		original_content: {
			body: 'Original version with less specific data...'
		},
		corrected_at: new Date('2024-12-18T11:20:00Z'),
		reviewed_at: null,
		reputation_delta: 0,
		reputation_applied: false,
		send_count: 9876,
		last_sent_at: new Date('2024-12-19T16:45:00Z')
	},
	{
		title: 'Housing: $2,400 Rent, $400k Starter Home',
		description: 'Housing math broken: $400k homes, $75k income.',
		category: 'Housing',
		type: 'advocacy',
		deliveryMethod: 'cwc',
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
		metrics: {
			sent: 28340,
			opened: 0,
			clicked: 0,
			responded: 28340,
			districts_covered: 415,
			total_districts: 435,
			district_coverage_percent: 95
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'Housing Crisis',
			urgency: 'critical',
			policy_area: 'Housing and Urban Development'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['financial', 'housing'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved',
		quality_score: 94,
		agent_votes: {
			openai: {
				score: 0.95,
				reasoning: 'Exceptional use of housing data, directly impacts every district',
				confidence: 0.96
			},
			gemini: {
				score: 0.93,
				reasoning: 'Universal issue with clear policy ask (ROAD Act)',
				confidence: 0.94
			}
		},
		consensus_score: 0.94,
		severity_level: 10,
		grammar_score: 95,
		clarity_score: 93,
		completeness_score: 91,
		correction_log: [],
		original_content: null,
		corrected_at: null,
		reviewed_at: new Date('2024-12-16T09:00:00Z'),
		reputation_delta: 15.2,
		reputation_applied: true,
		send_count: 28340,
		last_sent_at: new Date('2024-12-20T10:30:00Z')
	},
	{
		title: 'AI Decides Everything, Congress Regulates Nothing',
		description: '8 billion AI decisions daily, zero federal safety standards.',
		category: 'Technology',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		preview: "Dear [Representative Name], AI is rewriting society's rules.",
		message_body: `Dear [Representative Name],

AI is rewriting society's rules while Congress watches.

AI decisions per day: 8 billion (Senate Judiciary Committee testimony).
Congressional AI bills passed: 0 comprehensive laws (Congress.gov tracker).
Jobs automated this year: 4.7 million (Bureau of Labor Statistics).
Federal AI safety standards: None (NIST AI Risk Management Framework).

Sources: U.S. Senate Judiciary Committee, "AI Oversight Hearings" 2024; National Institute of Standards and Technology, "AI Risk Management Framework" 2024; Bureau of Labor Statistics, "Automation Impact Report" 2024

From [Address] where algorithms decide loans, jobs, and healthcare.

[Personal Connection]

Who's accountable when AI fails?

Pass comprehensive AI regulation now.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 15670,
			opened: 0,
			clicked: 0,
			responded: 15670,
			districts_covered: 380,
			total_districts: 435,
			district_coverage_percent: 87
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'AI Regulation',
			urgency: 'high',
			policy_area: 'Technology and Innovation'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['technology', 'commerce'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved',
		quality_score: 90,
		agent_votes: {
			openai: {
				score: 0.91,
				reasoning: 'Timely issue with clear urgency, good use of statistics',
				confidence: 0.9
			},
			gemini: {
				score: 0.89,
				reasoning: 'Important emerging issue, could be more specific on regulation asks',
				confidence: 0.88
			}
		},
		consensus_score: 0.9,
		severity_level: 8,
		grammar_score: 94,
		clarity_score: 90,
		completeness_score: 87,
		correction_log: [],
		original_content: null,
		corrected_at: null,
		reviewed_at: new Date('2024-12-17T11:20:00Z'),
		reputation_delta: 10.8,
		reputation_applied: true,
		send_count: 15670,
		last_sent_at: new Date('2024-12-20T13:45:00Z')
	},
	{
		title: "Kids' Brains for Sale: Zero Privacy Laws",
		description: "Kids's data harvested, mental health destroyed, laws unchanged since 1998.",
		category: 'Digital Rights',
		type: 'advocacy',
		deliveryMethod: 'cwc',
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
		metrics: {
			sent: 31250,
			opened: 0,
			clicked: 0,
			responded: 31250,
			districts_covered: 425,
			total_districts: 435,
			district_coverage_percent: 98
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'Child Online Safety',
			urgency: 'critical',
			policy_area: 'Commerce and Technology'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['commerce', 'judiciary'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved',
		quality_score: 96,
		agent_votes: {
			openai: {
				score: 0.97,
				reasoning: 'Powerful emotional appeal with shocking statistics, bipartisan issue',
				confidence: 0.95
			},
			gemini: {
				score: 0.95,
				reasoning: 'Excellent framing of child safety crisis, specific policy ask (KOSA)',
				confidence: 0.93
			}
		},
		consensus_score: 0.96,
		severity_level: 10,
		grammar_score: 96,
		clarity_score: 95,
		completeness_score: 93,
		correction_log: [],
		original_content: null,
		corrected_at: null,
		reviewed_at: new Date('2024-12-15T14:30:00Z'),
		reputation_delta: 18.5,
		reputation_applied: true,
		send_count: 31250,
		last_sent_at: new Date('2024-12-20T08:00:00Z')
	},
	{
		title: 'Debt Ceiling Theatre: $34T Tab, Zero Solutions',
		description: 'Interest costs more than defense, Congress plays theater.',
		category: 'Economy',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		preview: 'Dear Representative, The debt math threatens our future.',
		message_body: `Dear Representative [Representative Name],

The debt math threatens our future.

National debt: $34 trillion (U.S. Treasury, December 2024).
Interest payments: $1 trillion/year (CBO Budget Outlook, more than defense).
Your share: $100,000 per citizen (Treasury per capita calculation).
Solutions proposed: Political theater (Congressional voting record).

Sources: U.S. Department of the Treasury, "Daily Treasury Statement" December 2024; Congressional Budget Office, "Budget and Economic Outlook" 2024; Government Accountability Office, "Fiscal Health Report" 2024

From [Address] where we pay taxes for interest, not investment.

[Personal Connection]

When does fiscal responsibility matter?

Stop the games. Address the debt crisis.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 22100,
			opened: 0,
			clicked: 0,
			responded: 22100,
			districts_covered: 390,
			total_districts: 435,
			district_coverage_percent: 90
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'Fiscal Policy',
			urgency: 'high',
			policy_area: 'Budget and Finance'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['budget', 'finance'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'approved',
		quality_score: 87,
		agent_votes: {
			openai: {
				score: 0.88,
				reasoning: 'Important fiscal issue, though politically divisive framing',
				confidence: 0.86
			},
			gemini: {
				score: 0.86,
				reasoning: 'Clear data on debt crisis, bipartisan concern',
				confidence: 0.85
			}
		},
		consensus_score: 0.87,
		severity_level: 9,
		grammar_score: 93,
		clarity_score: 88,
		completeness_score: 85,
		correction_log: [
			{
				timestamp: '2024-12-18T08:00:00Z',
				type: 'tone',
				changes: ['Softened partisan language for broader appeal'],
				agent: 'gemini'
			}
		],
		original_content: {
			body: 'Original version with more partisan framing...'
		},
		corrected_at: new Date('2024-12-18T08:00:00Z'),
		reviewed_at: new Date('2024-12-18T10:00:00Z'),
		reputation_delta: 7.3,
		reputation_applied: true,
		send_count: 22100,
		last_sent_at: new Date('2024-12-20T15:00:00Z')
	},
	{
		title: 'Border Crisis: No Plan, Just Politics',
		description: 'Immigration needs solutions, not 38 years of political theater.',
		category: 'Immigration',
		type: 'advocacy',
		deliveryMethod: 'cwc',
		preview: 'Dear [Representative Name], Immigration needs solutions, not soundbites.',
		message_body: `Dear [Representative Name],

Immigration needs solutions, not soundbites.

Undocumented residents: 11 million (DHS Population Estimates 2024).
Years since comprehensive reform: 38 (last major reform 1986).
Economic contribution: $12 billion in taxes (CBO Immigration Report).
Border encounters: 2.5 million/year (CBP Southwest Border Statistics).

Sources: U.S. Customs and Border Protection, "Southwest Border Land Encounters" 2024; Department of Homeland Security, "Population Estimates" 2024; Congressional Budget Office, "Immigration's Impact on Federal Budget" 2024

From [Address] where communities need clarity, not chaos.

[Personal Connection]

When will Congress deliver real immigration reform?

Work across the aisle. Fix this now.

Sincerely,
[Name]
[Address]`,
		metrics: {
			sent: 19800,
			opened: 0,
			clicked: 0,
			responded: 19800,
			districts_covered: 370,
			total_districts: 435,
			district_coverage_percent: 85
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: 'Immigration Reform',
			urgency: 'high',
			policy_area: 'Immigration and Border Security'
		},
		recipient_config: {
			chambers: ['house', 'senate'],
			committees: ['judiciary', 'homeland'],
			target_type: 'congressional'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'federal',
		is_public: true,
		verification_status: 'reviewing',
		quality_score: 83,
		agent_votes: {
			openai: {
				score: 0.84,
				reasoning: 'Balanced approach to divisive issue, calls for bipartisan action',
				confidence: 0.83
			},
			gemini: {
				score: 0.82,
				reasoning: 'Attempts neutrality on polarizing topic, good data usage',
				confidence: 0.81
			}
		},
		consensus_score: 0.83,
		severity_level: 8,
		grammar_score: 92,
		clarity_score: 84,
		completeness_score: 80,
		correction_log: [
			{
				timestamp: '2024-12-19T07:30:00Z',
				type: 'balance',
				changes: ['Adjusted tone to appeal across political spectrum'],
				agent: 'openai'
			}
		],
		original_content: {
			body: 'Original version with different framing...'
		},
		corrected_at: new Date('2024-12-19T07:30:00Z'),
		reviewed_at: null,
		reputation_delta: 0,
		reputation_applied: false,
		send_count: 19800,
		last_sent_at: new Date('2024-12-20T11:15:00Z')
	},
	// Additional SF Municipal Templates
	{
		title: 'Waymo: 696 Crashes, Zero Accountability',
		description: 'Robotaxis ignore pedestrians, regulators ignore crashes.',
		category: 'Public Safety',
		type: 'advocacy',
		deliveryMethod: 'email',
		preview: "The math doesn't work anymore.",
		message_body: `Dear Board of Supervisors and CPUC,

The math doesn't work anymore.

Waymo accidents 2021-2024: 696 (NHTSA).
Pedestrians ignored at crosswalks: Documented dozens of times.
Regulatory accountability: Split between DMV and CPUC, effectively zero.

Sources: National Highway Traffic Safety Administration Crash Data 2025; Planetizen News, "Waymo Robotaxis Often Fail to Stop for Pedestrians" December 2024

From [Address] where robotaxis treat our streets like test labs.

[Personal Connection]

Who's liable when the algorithm kills?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: { sent: 4567, opened: 0, clicked: 0, responded: 4567 },
		delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
		recipient_config: {
			emails: ['board.of.supervisors@sfgov.org', 'cpuc@ca.gov'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true,
		verification_status: 'approved',
		quality_score: 85,
		send_count: 4567,
		last_sent_at: new Date('2025-01-08T16:45:00Z')
	},
	{
		title: 'Ellis Act: Evict Grandma, Build Luxury Condos',
		description: 'Pay $30k to evict grandma, sell condo for millions.',
		category: 'Housing',
		type: 'advocacy',
		deliveryMethod: 'email',
		preview: "The math doesn't work anymore.",
		message_body: `Dear Board of Supervisors and Rent Board,

The math doesn't work anymore.

Ellis Act payout to evict: Up to $30,000 per household.
Condo conversion profit: Millions.
Rent-controlled tenants displaced yearly: Hundreds.

Sources: San Francisco Tenants Union, "Ellis Act Evictions" 2025; Stimmel Law, "Ellis Act: State Law Restricting Change in Use" 2025

From [Address] where neighbors of 30 years vanish overnight.

[Personal Connection]

Legal doesn't mean moral.

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: { sent: 6789, opened: 0, clicked: 0, responded: 6789 },
		delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
		recipient_config: {
			emails: ['board.of.supervisors@sfgov.org', 'rentboard@sfgov.org'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true,
		verification_status: 'approved',
		quality_score: 87,
		send_count: 6789,
		last_sent_at: new Date('2025-01-05T11:30:00Z')
	},
	{
		title: 'Muni Cuts Service, Creates Death Spiral',
		description: 'Less service = fewer riders = less money = more cuts.',
		category: 'Transportation',
		type: 'advocacy',
		deliveryMethod: 'email',
		preview: "The math doesn't work anymore.",
		message_body: `Dear SFMTA Board and Mayor Lurie,

The math doesn't work anymore.

Muni budget deficit: $322 million (SFMTA 2025).
Service being cut: 2% now, potential 33% later.
Death spiral logic: Cut service → Lose riders → Less revenue → Cut more.

Sources: San Francisco Standard, "Muni Routes to Save $50M" January 2025; SFMTA Summer 2025 Service Cuts Documentation

From [Address] where buses don't come and people buy cars.

[Personal Connection]

Climate goals die with transit cuts.

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
		metrics: { sent: 8234, opened: 0, clicked: 0, responded: 8234 },
		delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
		recipient_config: {
			emails: ['mtaboard@sfmta.com', 'mayorlurie@sfgov.org'],
			target_type: 'municipal'
		},
		applicable_countries: ['US'],
		jurisdiction_level: 'municipal',
		specific_locations: ['San Francisco'],
		is_public: true,
		verification_status: 'approved',
		quality_score: 84,
		send_count: 8234,
		last_sent_at: new Date('2025-01-03T13:20:00Z')
	}
];

// Sample users with comprehensive VOTER Protocol data
const seedUserData = [
	{
		email: 'sarah.teacher@gmail.com',
		name: 'Sarah Martinez',
		avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612c4a8?w=150',

		// Address Fields
		city: 'San Francisco',
		state: 'CA',
		zip: '94115',
		congressional_district: 'CA-11',

		// Coordinates (San Francisco)
		latitude: 37.7749,
		longitude: -122.4194,
		political_embedding: [0.8, -0.2, 0.6, 0.1, -0.3],
		community_sheaves: {
			education: 0.9,
			housing: 0.8,
			environment: 0.7
		},
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-15T10:30:00Z'),

		// Verification
		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_abc123',
			timestamp: '2024-01-10T14:22:33Z'
		},
		verified_at: new Date('2024-01-10T14:22:33Z'),

		// VOTER Protocol
		wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
		district_hash: 'hash_ca11_sf_2024',
		trust_score: 85,
		reputation_tier: 'established',
		pending_rewards: '2500000000000000000', // 2.5 VOTER tokens
		total_earned: '15750000000000000000', // 15.75 VOTER tokens
		last_certification: new Date('2024-01-14T09:15:00Z'),
		challenge_score: 92,
		civic_score: 88,
		discourse_score: 81,

		// Profile
		role: 'teacher',
		organization: 'San Francisco Unified School District',
		location: 'Pacific Heights, San Francisco',
		connection: 'Education advocate fighting housing costs',
		profile_completed_at: new Date('2024-01-05T16:45:00Z'),
		profile_visibility: 'public'
	},
	{
		email: 'mike.seattle@protonmail.com',
		name: 'Michael Chen',
		avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',

		// Address Fields
		city: 'Seattle',
		state: 'WA',
		zip: '98121',
		congressional_district: 'WA-07',

		// Coordinates (Seattle)
		latitude: 47.6062,
		longitude: -122.3321,
		political_embedding: [0.6, 0.4, -0.1, 0.8, 0.2],
		community_sheaves: {
			tech: 0.9,
			transit: 0.8,
			climate: 0.7
		},
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-12T08:20:00Z'),

		// Verification
		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_def456',
			timestamp: '2024-01-08T11:15:22Z'
		},
		verified_at: new Date('2024-01-08T11:15:22Z'),

		// VOTER Protocol
		wallet_address: '0x2345678901bcdef12345678901bcdef123456789',
		district_hash: 'hash_wa07_seattle_2024',
		trust_score: 73,
		reputation_tier: 'emerging',
		pending_rewards: '1200000000000000000', // 1.2 VOTER tokens
		total_earned: '8400000000000000000', // 8.4 VOTER tokens
		last_certification: new Date('2024-01-13T15:30:00Z'),
		challenge_score: 78,
		civic_score: 82,
		discourse_score: 75,

		// Profile
		role: 'software engineer',
		organization: 'Microsoft',
		location: 'Belltown, Seattle',
		connection: 'Tech worker concerned about transit equity',
		profile_completed_at: new Date('2024-01-03T12:30:00Z'),
		profile_visibility: 'public'
	},
	{
		email: 'anna.organizer@riseup.net',
		name: 'Anna Rodriguez',
		avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',

		// Address Fields
		city: 'New York',
		state: 'NY',
		zip: '10451',
		congressional_district: 'NY-15',

		// Coordinates (Bronx, NYC)
		latitude: 40.8176,
		longitude: -73.9182,
		political_embedding: [-0.7, 0.8, 0.9, -0.2, 0.6],
		community_sheaves: {
			justice: 0.95,
			housing: 0.9,
			immigration: 0.8
		},
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-11T14:45:00Z'),

		// Verification
		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_ghi789',
			timestamp: '2024-01-06T13:45:11Z'
		},
		verified_at: new Date('2024-01-06T13:45:11Z'),

		// VOTER Protocol
		wallet_address: '0x3456789012cdef123456789012cdef12345678901',
		district_hash: 'hash_ny15_bronx_2024',
		trust_score: 94,
		reputation_tier: 'trusted',
		pending_rewards: '3750000000000000000', // 3.75 VOTER tokens
		total_earned: '22100000000000000000', // 22.1 VOTER tokens
		last_certification: new Date('2024-01-15T11:20:00Z'),
		challenge_score: 96,
		civic_score: 93,
		discourse_score: 89,

		// Profile
		role: 'community organizer',
		organization: 'Bronx Housing Coalition',
		location: 'South Bronx, New York',
		connection: 'Fighting gentrification and displacement',
		profile_completed_at: new Date('2024-01-02T09:15:00Z'),
		profile_visibility: 'public'
	},
	{
		email: 'jordan.student@utexas.edu',
		name: 'Jordan Kim',
		avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',

		// Address Fields
		city: 'Austin',
		state: 'TX',
		zip: '78705',
		congressional_district: 'TX-25',

		// Coordinates (Austin)
		latitude: 30.2672,
		longitude: -97.7431,
		political_embedding: [0.2, 0.5, -0.3, 0.7, -0.1],
		community_sheaves: {
			education: 0.8,
			climate: 0.7,
			democracy: 0.6
		},
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-09T16:00:00Z'),

		// Verification
		is_verified: false,
		verification_method: null,
		verification_data: null,
		verified_at: null,

		// VOTER Protocol (lower scores for unverified)
		wallet_address: '0x4567890123def1234567890123def123456789012',
		district_hash: 'hash_tx25_austin_2024',
		trust_score: 28,
		reputation_tier: 'novice',
		pending_rewards: '0', // 0 VOTER tokens
		total_earned: '500000000000000000', // 0.5 VOTER tokens
		last_certification: null,
		challenge_score: 15,
		civic_score: 32,
		discourse_score: 45,

		// Profile
		role: 'student',
		organization: 'University of Texas at Austin',
		location: 'West Campus, Austin',
		connection: 'Student activist for climate action',
		profile_completed_at: new Date('2024-01-07T14:20:00Z'),
		profile_visibility: 'private'
	},
	{
		email: 'maria.miami@gmail.com',
		name: 'Maria Gonzalez',
		avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',

		// Address Fields
		city: 'Miami',
		state: 'FL',
		zip: '33129',
		congressional_district: 'FL-27',

		// Coordinates (Miami)
		latitude: 25.7617,
		longitude: -80.1918,
		political_embedding: [0.1, -0.4, 0.8, 0.3, 0.6],
		community_sheaves: {
			climate: 0.9,
			immigration: 0.8,
			housing: 0.7
		},
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-13T12:10:00Z'),

		// Verification
		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_jkl012',
			timestamp: '2024-01-04T10:30:15Z'
		},
		verified_at: new Date('2024-01-04T10:30:15Z'),

		// VOTER Protocol
		wallet_address: '0x5678901234ef12345678901234ef123456789012',
		district_hash: 'hash_fl27_miami_2024',
		trust_score: 67,
		reputation_tier: 'emerging',
		pending_rewards: '1800000000000000000', // 1.8 VOTER tokens
		total_earned: '6300000000000000000', // 6.3 VOTER tokens
		last_certification: new Date('2024-01-12T08:45:00Z'),
		challenge_score: 71,
		civic_score: 75,
		discourse_score: 68,

		// Profile
		role: 'nurse',
		organization: 'Jackson Memorial Hospital',
		location: 'Brickell, Miami',
		connection: 'Healthcare worker advocating for climate resilience',
		profile_completed_at: new Date('2024-01-01T20:45:00Z'),
		profile_visibility: 'public'
	},
	// Additional users for variety...
	{
		email: 'alex.coder@berkeley.edu',
		name: 'Alex Thompson',
		avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',

		city: 'Berkeley',
		state: 'CA',
		zip: '94720',
		congressional_district: 'CA-12',

		latitude: 37.8715,
		longitude: -122.2588,
		political_embedding: [0.9, 0.1, -0.2, 0.4, 0.7],
		community_sheaves: { tech: 0.9, education: 0.6, privacy: 0.8 },
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-10T18:30:00Z'),

		is_verified: false,
		verification_method: null,
		verification_data: null,
		verified_at: null,

		wallet_address: '0x6789012345f123456789012345f1234567890123',
		district_hash: 'hash_ca12_berkeley_2024',
		trust_score: 22,
		reputation_tier: 'novice',
		pending_rewards: '0',
		total_earned: '200000000000000000', // 0.2 VOTER tokens
		last_certification: null,
		challenge_score: 8,
		civic_score: 25,
		discourse_score: 38,

		role: 'graduate student',
		organization: 'UC Berkeley',
		location: 'Berkeley, CA',
		connection: 'Computer science researcher studying digital democracy',
		profile_completed_at: new Date('2024-01-09T22:15:00Z'),
		profile_visibility: 'private'
	},
	{
		email: 'jenny.doctor@ohsu.edu',
		name: 'Dr. Jennifer Walsh',
		avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150',

		city: 'Portland',
		state: 'OR',
		zip: '97239',
		congressional_district: 'OR-01',

		latitude: 45.4988,
		longitude: -122.6853,
		political_embedding: [0.6, 0.7, 0.3, -0.1, 0.5],
		community_sheaves: { healthcare: 0.95, climate: 0.8, social_justice: 0.7 },
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-14T07:20:00Z'),

		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_mno345',
			timestamp: '2024-01-05T16:45:30Z'
		},
		verified_at: new Date('2024-01-05T16:45:30Z'),

		wallet_address: '0x789012345f6123456789012345f61234567890123',
		district_hash: 'hash_or01_portland_2024',
		trust_score: 88,
		reputation_tier: 'established',
		pending_rewards: '3200000000000000000', // 3.2 VOTER tokens
		total_earned: '18600000000000000000', // 18.6 VOTER tokens
		last_certification: new Date('2024-01-14T13:10:00Z'),
		challenge_score: 91,
		civic_score: 87,
		discourse_score: 84,

		role: 'physician',
		organization: 'Oregon Health & Science University',
		location: 'South Portland, OR',
		connection: 'Emergency medicine doctor advocating for healthcare access',
		profile_completed_at: new Date('2024-01-04T11:30:00Z'),
		profile_visibility: 'public'
	},
	// Additional users to reach 15-20 total
	{
		email: 'carlos.organizer@gmail.com',
		name: 'Carlos Rivera',
		avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',

		city: 'San Francisco',
		state: 'CA',
		zip: '94158',
		congressional_district: 'CA-11',

		latitude: 37.7749,
		longitude: -122.4194,
		political_embedding: [0.7, 0.8, 0.4, -0.2, 0.5],
		community_sheaves: { labor: 0.9, immigration: 0.8, justice: 0.7 },
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-08T16:45:00Z'),

		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_pqr678',
			timestamp: '2024-01-07T09:30:45Z'
		},
		verified_at: new Date('2024-01-07T09:30:45Z'),

		wallet_address: '0x890123456f7123456789012345f712345678901234',
		district_hash: 'hash_ca11_sf_mission_2024',
		trust_score: 91,
		reputation_tier: 'trusted',
		pending_rewards: '4100000000000000000', // 4.1 VOTER tokens
		total_earned: '26700000000000000000', // 26.7 VOTER tokens
		last_certification: new Date('2024-01-15T14:25:00Z'),
		challenge_score: 95,
		civic_score: 92,
		discourse_score: 88,

		role: 'labor organizer',
		organization: 'Service Employees International Union',
		location: 'Mission District, San Francisco',
		connection: 'Labor rights advocate organizing service workers',
		profile_completed_at: new Date('2024-01-06T08:15:00Z'),
		profile_visibility: 'public'
	},
	{
		email: 'rachel.policy@georgetown.edu',
		name: 'Dr. Rachel Thompson',
		avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',

		city: 'Washington',
		state: 'DC',
		zip: '20057',
		congressional_district: 'DC-AL',

		latitude: 38.9072,
		longitude: -77.0369,
		political_embedding: [0.5, 0.6, 0.8, 0.4, 0.3],
		community_sheaves: { policy: 0.95, democracy: 0.9, education: 0.8 },
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-14T11:30:00Z'),

		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_stu901',
			timestamp: '2024-01-03T15:45:22Z'
		},
		verified_at: new Date('2024-01-03T15:45:22Z'),

		wallet_address: '0x901234567f8123456789012345f812345678901234',
		district_hash: 'hash_dc_georgetown_2024',
		trust_score: 87,
		reputation_tier: 'established',
		pending_rewards: '2900000000000000000', // 2.9 VOTER tokens
		total_earned: '19800000000000000000', // 19.8 VOTER tokens
		last_certification: new Date('2024-01-14T16:10:00Z'),
		challenge_score: 89,
		civic_score: 94,
		discourse_score: 91,

		role: 'policy researcher',
		organization: 'Georgetown Public Policy Institute',
		location: 'Georgetown, Washington DC',
		connection: 'Democracy policy expert researching digital governance',
		profile_completed_at: new Date('2024-01-02T13:45:00Z'),
		profile_visibility: 'public'
	},
	{
		email: 'dev.unverified@protonmail.com',
		name: 'Devon Chen',
		avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150',

		city: 'San Francisco',
		state: 'CA',
		zip: '94107',
		congressional_district: 'CA-11',

		latitude: 37.7816,
		longitude: -122.3928,
		political_embedding: [0.3, 0.1, -0.4, 0.9, 0.2],
		community_sheaves: { tech: 0.8, privacy: 0.9, crypto: 0.7 },
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-11T20:15:00Z'),

		is_verified: false,
		verification_method: null,
		verification_data: null,
		verified_at: null,

		wallet_address: '0x012345678f9123456789012345f912345678901234',
		district_hash: 'hash_ca11_soma_2024',
		trust_score: 12,
		reputation_tier: 'novice',
		pending_rewards: '0',
		total_earned: '100000000000000000', // 0.1 VOTER tokens
		last_certification: null,
		challenge_score: 5,
		civic_score: 18,
		discourse_score: 22,

		role: 'software developer',
		organization: 'Freelance',
		location: 'SOMA, San Francisco',
		connection: 'Crypto developer interested in decentralized governance',
		profile_completed_at: new Date('2024-01-10T22:30:00Z'),
		profile_visibility: 'private'
	},
	{
		email: 'lisa.attorney@eff.org',
		name: 'Lisa Park',
		avatar: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=150',

		city: 'San Francisco',
		state: 'CA',
		zip: '94109',
		congressional_district: 'CA-11',

		latitude: 37.7837,
		longitude: -122.4135,
		political_embedding: [0.8, 0.9, 0.6, 0.2, 0.7],
		community_sheaves: { privacy: 0.95, tech: 0.8, justice: 0.9 },
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-13T09:45:00Z'),

		is_verified: true,
		verification_method: 'didit_zk',
		verification_data: {
			proof_hash: 'zk_proof_vwx234',
			timestamp: '2024-01-02T11:20:18Z'
		},
		verified_at: new Date('2024-01-02T11:20:18Z'),

		wallet_address: '0x123456789f0123456789012345f0123456789012345',
		district_hash: 'hash_ca11_tenderloin_2024',
		trust_score: 93,
		reputation_tier: 'trusted',
		pending_rewards: '3800000000000000000', // 3.8 VOTER tokens
		total_earned: '24500000000000000000', // 24.5 VOTER tokens
		last_certification: new Date('2024-01-15T08:30:00Z'),
		challenge_score: 97,
		civic_score: 91,
		discourse_score: 94,

		role: 'civil rights attorney',
		organization: 'Electronic Frontier Foundation',
		location: 'Tenderloin, San Francisco',
		connection: 'Digital rights lawyer fighting for online privacy',
		profile_completed_at: new Date('2024-01-01T16:45:00Z'),
		profile_visibility: 'public'
	},
	{
		email: 'marcus.student@nyu.edu',
		name: 'Marcus Williams',
		avatar: 'https://images.unsplash.com/photo-1556157382-0b0c6b8ac6ae?w=150',

		city: 'New York',
		state: 'NY',
		zip: '10003',
		congressional_district: 'NY-12',

		latitude: 40.7282,
		longitude: -73.9942,
		political_embedding: [0.4, 0.6, 0.2, 0.8, 0.1],
		community_sheaves: { education: 0.7, democracy: 0.6, arts: 0.8 },
		embedding_version: 'v1',
		coordinates_updated_at: new Date('2024-01-09T15:20:00Z'),

		is_verified: false,
		verification_method: null,
		verification_data: null,
		verified_at: null,

		wallet_address: '0x234567890f1123456789012345f112345678901234',
		district_hash: 'hash_ny12_greenwich_2024',
		trust_score: 35,
		reputation_tier: 'novice',
		pending_rewards: '0',
		total_earned: '800000000000000000', // 0.8 VOTER tokens
		last_certification: null,
		challenge_score: 18,
		civic_score: 42,
		discourse_score: 51,

		role: 'graduate student',
		organization: 'New York University',
		location: 'Greenwich Village, New York',
		connection: 'Political science student researching digital democracy',
		profile_completed_at: new Date('2024-01-08T19:30:00Z'),
		profile_visibility: 'private'
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

async function seedUsers() {
	console.log('👥 Starting user seeding...');

	try {
		// Clear dependent data first to avoid foreign key constraint violations
		await db.challengeStake.deleteMany({});
		await db.challenge.deleteMany({});
		await db.auditLog.deleteMany({});
		await db.civicAction.deleteMany({});
		await db.user_representatives.deleteMany({});

		// Clear existing users (this will cascade to related data)
		await db.user.deleteMany({});
		console.log('✅ Cleared existing users');

		// Insert users
		const createdUsers = [];
		for (const userData of seedUserData) {
			const createdUser = await db.user.create({
				data: userData
			});

			createdUsers.push(createdUser);
			console.log(
				`👤 Created: "${userData.name}" (${userData.email}) → ${userData.trust_score} trust, ${userData.reputation_tier}`
			);
		}

		console.log(`✅ Seeded ${seedUserData.length} users with comprehensive VOTER Protocol data`);
		return createdUsers;
	} catch (error) {
		console.error('❌ Error seeding users:', error);
		throw error;
	}
}

async function seedCoreTemplates(users: User[]) {
	console.log('🌱 Starting core template seeding...');

	try {
		// Clear existing templates
		await db.template.deleteMany({});
		console.log('✅ Cleared existing templates');

		// Insert templates with user assignments
		const createdTemplates = [];
		for (let i = 0; i < seedTemplates.length; i++) {
			const template = seedTemplates[i];
			const slug = generateSlug(template.title);

			// Assign template to a user (distribute across verified users)
			const verifiedUsers = users.filter((u) => u.is_verified);
			const assignedUser = verifiedUsers[i % verifiedUsers.length];

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
					applicable_countries: template.applicable_countries || [],
					jurisdiction_level: template.jurisdiction_level,
					specific_locations: template.specific_locations || [],
					is_public: template.is_public,
					status: 'published',
					userId: assignedUser?.id || null,

					// === CONSOLIDATED VERIFICATION FIELDS (Phase 4) ===
					verification_status: (template as SeedTemplateData).verification_status || 'pending',
					quality_score: (template as SeedTemplateData).quality_score || 50,
					agent_votes: ((template as SeedTemplateData).agent_votes as Prisma.JsonValue) || null,
					consensus_score: (template as SeedTemplateData).consensus_score || null,
					severity_level: (template as SeedTemplateData).severity_level || null,
					grammar_score: (template as SeedTemplateData).grammar_score || null,
					clarity_score: (template as SeedTemplateData).clarity_score || null,
					completeness_score: (template as SeedTemplateData).completeness_score || null,
					correction_log:
						((template as SeedTemplateData).correction_log as Prisma.JsonValue) || null,
					original_content:
						((template as SeedTemplateData).original_content as Prisma.JsonValue) || null,
					corrected_at: (template as SeedTemplateData).corrected_at || null,
					reviewed_at: (template as SeedTemplateData).reviewed_at || null,
					reputation_delta: (template as SeedTemplateData).reputation_delta || 0,
					reputation_applied: (template as SeedTemplateData).reputation_applied || false,
					send_count: (template as SeedTemplateData).send_count || 0,
					last_sent_at: (template as SeedTemplateData).last_sent_at || null,
					submitted_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random within last week
				}
			});

			createdTemplates.push(createdTemplate);
			console.log(
				`📝 Created: "${template.title}" → ${slug} (by ${assignedUser?.name || 'Anonymous'})`
			);
		}

		console.log(`✅ Seeded ${seedTemplates.length} core templates with user assignments`);
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
				email: null, // Some don't have public emails
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
			},
			{
				bioguide_id: 'F000062',
				name: 'Dianne Feinstein',
				party: 'D',
				state: 'CA',
				district: 'Senior',
				chamber: 'senate',
				office_code: 'CA-Senior',
				email: null,
				is_active: false, // Historical data
				office_address: '1 Post Street, Suite 2450',
				office_city: 'San Francisco',
				office_state: 'CA',
				office_zip: '94104',
				term_start: new Date('2019-01-03'),
				term_end: new Date('2023-09-29'), // Date of passing
				current_term: 6,
				data_source: 'congress_api',
				source_updated_at: new Date('2023-09-29')
			},
			{
				bioguide_id: 'L000174',
				name: 'Patrick Leahy',
				party: 'D',
				state: 'VT',
				district: 'Senior',
				chamber: 'senate',
				office_code: 'VT-Senior',
				email: null,
				is_active: false, // Retired
				office_address: '87 State Street, Room 338',
				office_city: 'Montpelier',
				office_state: 'VT',
				office_zip: '05602',
				term_start: new Date('2017-01-03'),
				term_end: new Date('2023-01-03'),
				current_term: 8,
				data_source: 'congress_api',
				source_updated_at: new Date('2023-01-03')
			}
		];

		// Clear existing data
		await db.representative.deleteMany({});

		// Insert representatives
		const createdRepresentatives = [];
		for (const rep of representatives) {
			const createdRep = await db.representative.create({
				data: rep
			});
			createdRepresentatives.push(createdRep);
		}

		console.log(`✅ Seeded ${representatives.length} representatives with enhanced office data`);
		return createdRepresentatives;
	} catch (error) {
		console.error('❌ Error seeding congressional data:', error);
		throw error;
	}
}

async function seedUserRepresentativeRelationships(
	users: User[],
	representatives: Representative[]
) {
	console.log('🤝 Creating user-representative relationships...');

	try {
		// Clear existing relationships
		await db.user_representatives.deleteMany({});

		const relationships = [];

		// Create relationships for users based on their congressional districts
		for (const user of users) {
			if (!user.congressional_district) continue;

			// Find matching representatives for this user's district
			const matchingReps = representatives.filter((rep) => {
				if (rep.chamber === 'senate') {
					// Senate: match by state only
					return rep.state === user.state;
				} else {
					// House: match by exact district
					return (
						rep.state === user.state &&
						`${rep.state}-${rep.district}` === user.congressional_district
					);
				}
			});

			for (const rep of matchingReps) {
				const relationship = await db.user_representatives.create({
					data: {
						user_id: user.id,
						representative_id: rep.id,
						relationship: rep.chamber === 'senate' ? 'senator' : 'representative',
						is_active: rep.is_active,
						assigned_at: new Date(),
						last_validated: new Date()
					}
				});
				relationships.push(relationship);
			}
		}

		console.log(`✅ Created ${relationships.length} user-representative relationships`);
		return relationships;
	} catch (error) {
		console.error('❌ Error creating user-representative relationships:', error);
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
		// Seed users first (required for template assignments)
		const users = await seedUsers();

		// Seed core production data with user assignments
		const templates = await seedCoreTemplates(users);

		// Seed congressional/representative data
		const representatives = await seedCongressionalData();

		// Create user-representative relationships
		await seedUserRepresentativeRelationships(users, representatives);

		// Seed beta features if enabled
		await seedBetaFeatures();

		// Verify the data
		const counts = {
			users: await db.user.count(),
			templates: await db.template.count(),
			representatives: await db.representative.count(),
			userRepRelationships: await db.user_representatives.count()
		};

		console.log('\n📊 Database Summary:');
		console.log('===================');
		console.log(`Users: ${counts.users}`);
		console.log(`Templates: ${counts.templates}`);
		console.log(`Representatives: ${counts.representatives}`);
		console.log(`User-Representative Links: ${counts.userRepRelationships}`);

		// Show URLs
		console.log('\n👥 User Summary:');
		console.log('================');
		const verifiedCount = users.filter((u) => u.is_verified).length;
		const reputationTiers = Array.from(new Set(users.map((u: User) => u.reputation_tier)));
		console.log(`Verified Users: ${verifiedCount}/${users.length}`);
		reputationTiers.forEach((tier: string) => {
			const count = users.filter((u) => u.reputation_tier === tier).length;
			console.log(`  • ${tier}: ${count} user${count > 1 ? 's' : ''}`);
		});

		const avgTrustScore = Math.round(
			users.reduce((sum, u) => sum + u.trust_score, 0) / users.length
		);
		console.log(`Average Trust Score: ${avgTrustScore}`);

		const totalEarnings = users.reduce((sum, u) => sum + parseFloat(u.total_earned || '0'), 0);
		console.log(`Total VOTER Tokens Earned: ${(totalEarnings / 1e18).toFixed(2)} VOTER`);

		console.log('\n🌐 Available Templates:');
		console.log('=====================');
		templates.forEach((t, _i) => {
			const creator = users.find((u) => u.id === t.userId);
			console.log(`📍 https://communique.app/${t.slug}`);
			console.log(`   "${t.title}" (${t.category} → ${t.jurisdiction_level})`);
			console.log(
				`   Created by: ${creator?.name || 'Anonymous'} (${creator?.reputation_tier || 'unknown'})`
			);
			console.log('');
		});

		console.log('📋 Template Distribution:');
		const categories = Array.from(new Set(templates.map((t: Template) => t.category)));
		categories.forEach((cat: string) => {
			const count = templates.filter((t) => t.category === cat).length;
			console.log(`  • ${cat}: ${count} template${count > 1 ? 's' : ''}`);
		});

		const jurisdictions = Array.from(new Set(templates.map((t: Template) => t.jurisdiction_level)));
		console.log('\n🏛️  Jurisdiction Levels:');
		jurisdictions.forEach((jur: string | null) => {
			const count = templates.filter((t) => t.jurisdiction_level === jur).length;
			console.log(`  • ${jur}: ${count} template${count > 1 ? 's' : ''}`);
		});

		console.log('\n🌍 Geographic Distribution:');
		const states = Array.from(new Set(users.map((u: User) => u.state).filter(Boolean)));
		states.forEach((state: string) => {
			const count = users.filter((u) => u.state === state).length;
			console.log(`  • ${state}: ${count} user${count > 1 ? 's' : ''}`);
		});

		console.log('\n🏆 VOTER Protocol Stats:');
		const totalPending = users.reduce((sum, u) => sum + parseFloat(u.pending_rewards || '0'), 0);
		console.log(`Total Pending Rewards: ${(totalPending / 1e18).toFixed(2)} VOTER`);
		console.log(`Highest Trust Score: ${Math.max(...users.map((u) => u.trust_score))}`);
		console.log(
			`Average Challenge Score: ${Math.round(users.reduce((sum, u) => sum + (u.challenge_score || 0), 0) / users.length)}`
		);

		console.log('\n🎉 Database seeding completed successfully!\n');
		console.log('💡 Next Steps:');
		console.log('  • 🔐 Users with comprehensive VOTER Protocol data');
		console.log('  • 📝 Templates assigned to verified users as creators');
		console.log('  • 🏛️  Congressional data with enhanced office information');
		console.log('  • 🤝 User-representative relationships established');
		console.log('  • 🌐 Geographic diversity across 5+ states');
		console.log('  • 💰 VOTER token economics with realistic reward distribution');
		console.log('  • 🔍 Mix of verification states and reputation tiers');
		console.log('  • Enable beta features with ENABLE_BETA=true');
		console.log('  • Legislative channels require separate seeding\n');
	} catch (error) {
		console.error('❌ Error seeding database:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}

	process.exit(0);
}

// Check if this file is being run directly
// Use process.argv[1] to check if this script is being run directly
if (process.argv[1]?.endsWith('seed-database.ts')) {
	seedDatabase();
}
