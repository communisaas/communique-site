import type { Template } from '$lib/types/template';

export const templates: Omit<Template, 'id'>[] = [
	{
		title: 'Climate Action Now',
		slug: 'tell-congress-climate-action-now',
		description: 'Demand immediate Congressional action on climate change legislation to protect our planet for future generations.',
		category: 'Environment',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Urgent: Climate Action Needed Now',
		preview: `Dear [Representative Name],

The climate crisis demands immediate action. I urge you to support comprehensive climate legislation that will transition our economy to clean energy and protect our communities from extreme weather.

Recent extreme weather events in our district have made it clear that we cannot wait. We need:
• Rapid transition to renewable energy
• Investment in green jobs and infrastructure  
• Protection for frontline communities

[Personal Connection]

The science is clear, and the time for action is now. Please vote for bold climate legislation.

Urgently,
[Name]
[Address]`,
		message_body: `Dear [Representative Name],

The climate crisis demands immediate action. I urge you to support comprehensive climate legislation that will transition our economy to clean energy and protect our communities from extreme weather.

Recent extreme weather events in our district have made it clear that we cannot wait. We need:
• Rapid transition to renewable energy
• Investment in green jobs and infrastructure  
• Protection for frontline communities

[Personal Connection]

The science is clear, and the time for action is now. Please vote for bold climate legislation.

Urgently,
[Name]
[Address]`,
		recipientEmails: [
			'climate.committee@house.gov',
			'environment.committee@senate.gov'
		],
		metrics: {
			sent: 8437,
			opened: 0,
			clicked: 0,
			responded: 7291,
			districts_covered: 402,
			total_districts: 435,
			district_coverage_percent: 92
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		recipient_config: {
			emails: [
				'climate.committee@house.gov',
				'environment.committee@senate.gov'
			]
		},
		is_public: true
	},
	{
		title: 'Healthcare For All',
		slug: 'tell-congress-healthcare-for-all',
		description: 'Support universal healthcare legislation that ensures every American has access to quality, affordable medical care.',
		category: 'Healthcare',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Support Universal Healthcare Access',
		preview: `Dear [Representative Name],

Healthcare is a human right, not a privilege. I urge you to support legislation that establishes universal healthcare coverage for all Americans.

Too many families in our district face impossible choices between medical care and basic necessities. We need a system that:
• Covers everyone regardless of employment status
• Eliminates medical bankruptcies
• Reduces prescription drug costs
• Expands mental health services

[Personal Connection]

Please vote to ensure healthcare access for every person in America.

Respectfully,
[Name]
[Address]`,
		message_body: `Dear [Representative Name],

Healthcare is a human right, not a privilege. I urge you to support legislation that establishes universal healthcare coverage for all Americans.

Too many families in our district face impossible choices between medical care and basic necessities. We need a system that:
• Covers everyone regardless of employment status
• Eliminates medical bankruptcies
• Reduces prescription drug costs
• Expands mental health services

[Personal Connection]

Please vote to ensure healthcare access for every person in America.

Respectfully,
[Name]
[Address]`,
		recipientEmails: [
			'healthcare.committee@house.gov',
			'health.committee@senate.gov'
		],
		metrics: {
			sent: 6823,
			opened: 0,
			clicked: 0,
			responded: 5947,
			districts_covered: 378,
			total_districts: 435,
			district_coverage_percent: 87
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		recipient_config: {
			emails: [
				'healthcare.committee@house.gov',
				'health.committee@senate.gov'
			]
		},
		is_public: true
	},
	{
		title: 'Stop Book Bans',
		slug: 'stop-book-bans',
		description: 'Oppose censorship efforts targeting school libraries and defend students\' right to access diverse literature and information.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Defend Students\' Right to Read',
		preview: `Dear School Board Members,

I am writing to oppose the proposed book removal policies that threaten our students' access to diverse literature and educational resources.

Censoring books undermines critical thinking and deprives students of the opportunity to engage with different perspectives. These policies:
• Restrict intellectual freedom
• Target marginalized voices and experiences
• Undermine educators' professional judgment
• Violate students' rights to information

[Personal Connection]

Please reject these censorship efforts and trust our educators to provide age-appropriate, educational content.

Sincerely,
[Name]
[Address]`,
		message_body: `Dear School Board Members,

I am writing to oppose the proposed book removal policies that threaten our students' access to diverse literature and educational resources.

Censoring books undermines critical thinking and deprives students of the opportunity to engage with different perspectives. These policies:
• Restrict intellectual freedom
• Target marginalized voices and experiences
• Undermine educators' professional judgment
• Violate students' rights to information

[Personal Connection]

Please reject these censorship efforts and trust our educators to provide age-appropriate, educational content.

Sincerely,
[Name]
[Address]`,
		recipientEmails: [
			'schoolboard@district.edu',
			'superintendent@district.edu',
			'curriculum@district.edu'
		],
		metrics: {
			sent: 3456,
			opened: 0,
			clicked: 3,
			responded: 0
		},
		delivery_config: {
			timing: 'immediate',
			followUp: false
		},
		recipient_config: {
			emails: [
				'schoolboard@district.edu',
				'superintendent@district.edu',
				'curriculum@district.edu'
			]
		},
		is_public: true
	},
	{
		title: 'Protect Voting Rights',
		slug: 'tell-congress-protect-voting-rights',
		description: 'Defend democracy by supporting voting rights legislation that ensures free and fair access to elections for all eligible Americans.',
		category: 'Democracy',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Protect the Right to Vote',
		preview: `Dear [Representative Name],

Democracy depends on every eligible citizen's ability to participate in free and fair elections. I urge you to support comprehensive voting rights legislation.

Across the country, we're seeing efforts to restrict voting access through:
• Reduced polling hours and locations
• Strict voter ID requirements
• Purging of voter rolls
• Limits on mail-in voting

[Personal Connection]

Please protect our fundamental right to vote by supporting the Freedom to Vote Act and restoring the Voting Rights Act.

Democratically yours,
[Name]
[Address]`,
		message_body: `Dear [Representative Name],

Democracy depends on every eligible citizen's ability to participate in free and fair elections. I urge you to support comprehensive voting rights legislation.

Across the country, we're seeing efforts to restrict voting access through:
• Reduced polling hours and locations
• Strict voter ID requirements
• Purging of voter rolls
• Limits on mail-in voting

[Personal Connection]

Please protect our fundamental right to vote by supporting the Freedom to Vote Act and restoring the Voting Rights Act.

Democratically yours,
[Name]
[Address]`,
		recipientEmails: [
			'judiciary.committee@house.gov',
			'voting.rights@senate.gov'
		],
		metrics: {
			sent: 5621,
			opened: 0,
			clicked: 0,
			responded: 4788,
			districts_covered: 356,
			total_districts: 435,
			district_coverage_percent: 82
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		recipient_config: {
			emails: [
				'judiciary.committee@house.gov',
				'voting.rights@senate.gov'
			]
		},
		is_public: true
	},
	{
		title: 'Gun Violence Prevention',
		slug: 'tell-congress-gun-violence-prevention',
		description: 'Support comprehensive gun safety legislation including universal background checks and assault weapon restrictions.',
		category: 'Public Safety',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Urgent: End Gun Violence Now',
		preview: `Dear [Representative Name],

Gun violence has become an epidemic in America, and we need immediate action to protect our communities. I urge you to support comprehensive gun safety legislation.

Every day, over 100 Americans die from gun violence. We cannot accept this as normal. We need:
• Universal background checks
• Assault weapon restrictions
• Red flag laws
• Safe storage requirements

[Personal Connection]

Please put the safety of your constituents before the gun lobby. Vote for common-sense gun safety measures.

Urgently,
[Name]
[Address]`,
		message_body: `Dear [Representative Name],

Gun violence has become an epidemic in America, and we need immediate action to protect our communities. I urge you to support comprehensive gun safety legislation.

Every day, over 100 Americans die from gun violence. We cannot accept this as normal. We need:
• Universal background checks
• Assault weapon restrictions
• Red flag laws
• Safe storage requirements

[Personal Connection]

Please put the safety of your constituents before the gun lobby. Vote for common-sense gun safety measures.

Urgently,
[Name]
[Address]`,
		recipientEmails: [
			'judiciary.committee@house.gov',
			'public.safety@senate.gov'
		],
		metrics: {
			sent: 7234,
			opened: 0,
			clicked: 0,
			responded: 6102,
			districts_covered: 389,
			total_districts: 435,
			district_coverage_percent: 89
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		recipient_config: {
			emails: [
				'judiciary.committee@house.gov',
				'public.safety@senate.gov'
			]
		},
		is_public: true
	},
	{
		title: 'Corporate Tax Reform',
		slug: 'demand-corporate-tax-reform',
		description: 'Demand fair taxation of corporations and wealthy individuals to fund critical public services and infrastructure.',
		category: 'Economic Justice',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Tax the Rich: Fund Our Communities',
		preview: `Dear Corporate Board,

It's time for corporations to pay their fair share in taxes to support the communities that make their success possible.

While working families struggle with rising costs, many large corporations pay little to no federal taxes. This is morally wrong and economically unsustainable. We need:
• Minimum corporate tax rates
• Closure of tax loopholes
• Fair taxation of capital gains
• Investment in public infrastructure

[Personal Connection]

Please support tax policies that create a more equitable society for all.

Sincerely,
[Name]
[Address]`,
		message_body: `Dear Corporate Board,

It's time for corporations to pay their fair share in taxes to support the communities that make their success possible.

While working families struggle with rising costs, many large corporations pay little to no federal taxes. This is morally wrong and economically unsustainable. We need:
• Minimum corporate tax rates
• Closure of tax loopholes
• Fair taxation of capital gains
• Investment in public infrastructure

[Personal Connection]

Please support tax policies that create a more equitable society for all.

Sincerely,
[Name]
[Address]`,
		recipientEmails: [
			'investor.relations@corporations.com',
			'board@executives.com',
			'shareholders@companies.com'
		],
		metrics: {
			sent: 2187,
			opened: 0,
			clicked: 3,
			responded: 0
		},
		delivery_config: {
			timing: 'immediate',
			followUp: false
		},
		recipient_config: {
			emails: [
				'investor.relations@corporations.com',
				'board@executives.com',
				'shareholders@companies.com'
			]
		},
		is_public: true
	},
	{
		title: 'Immigration Justice',
		slug: 'tell-congress-immigration-justice',
		description: 'Support comprehensive immigration reform that provides pathways to citizenship and treats all immigrants with dignity.',
		category: 'Immigration',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Support Immigrant Communities',
		preview: `Dear [Representative Name],

America's strength comes from our diversity and our history as a nation of immigrants. I urge you to support comprehensive immigration reform that reflects our values.

Millions of undocumented immigrants contribute to our communities, pay taxes, and deserve a pathway to citizenship. We need policies that:
• Provide pathways to legal status
• Keep families together
• Protect Dreamers and TPS recipients
• Reform our detention system

[Personal Connection]

Please vote for immigration policies that are humane, practical, and reflect American values.

With hope,
[Name]
[Address]`,
		message_body: `Dear [Representative Name],

America's strength comes from our diversity and our history as a nation of immigrants. I urge you to support comprehensive immigration reform that reflects our values.

Millions of undocumented immigrants contribute to our communities, pay taxes, and deserve a pathway to citizenship. We need policies that:
• Provide pathways to legal status
• Keep families together
• Protect Dreamers and TPS recipients
• Reform our detention system

[Personal Connection]

Please vote for immigration policies that are humane, practical, and reflect American values.

With hope,
[Name]
[Address]`,
		recipientEmails: [
			'immigration.committee@house.gov',
			'judiciary.committee@senate.gov'
		],
		metrics: {
			sent: 4562,
			opened: 0,
			clicked: 0,
			responded: 3891,
			districts_covered: 298,
			total_districts: 435,
			district_coverage_percent: 68
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		recipient_config: {
			emails: [
				'immigration.committee@house.gov',
				'judiciary.committee@senate.gov'
			]
		},
		is_public: true
	},
	{
		title: 'Student Debt Relief',
		slug: 'tell-congress-student-debt-relief',
		description: 'Cancel student debt and make higher education affordable for current and future students.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Cancel Student Debt Now',
		preview: `Dear [Representative Name],

The student debt crisis is crushing an entire generation and holding back our economy. I urge you to support comprehensive student debt relief.

Over 45 million Americans carry student loan debt, with an average balance exceeding $30,000. This crisis:
• Prevents homeownership and family formation
• Limits economic mobility
• Disproportionately affects communities of color
• Stifles entrepreneurship and innovation

[Personal Connection]

Please support legislation to cancel student debt and make college affordable for all.

Hopefully,
[Name]
[Address]`,
		message_body: `Dear [Representative Name],

The student debt crisis is crushing an entire generation and holding back our economy. I urge you to support comprehensive student debt relief.

Over 45 million Americans carry student loan debt, with an average balance exceeding $30,000. This crisis:
• Prevents homeownership and family formation
• Limits economic mobility
• Disproportionately affects communities of color
• Stifles entrepreneurship and innovation

[Personal Connection]

Please support legislation to cancel student debt and make college affordable for all.

Hopefully,
[Name]
[Address]`,
		recipientEmails: [
			'education.committee@house.gov',
			'higher.education@senate.gov'
		],
		metrics: {
			sent: 9876,
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
		recipient_config: {
			emails: [
				'education.committee@house.gov',
				'higher.education@senate.gov'
			]
		},
		is_public: true
	}
];