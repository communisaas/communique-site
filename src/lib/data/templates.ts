import type { Template } from '$lib/types/template';

export const templates: Omit<Template, 'id'>[] = [
	{
		title: 'Support Clean Energy Tax Credits',
		description: 'Urge representatives to maintain and expand clean energy tax incentives that make renewable energy more accessible to families and businesses.',
		category: 'Environment',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Please Support Clean Energy Tax Credits',
		preview: `Dear Representative,

I am writing to urge you to support the continuation and expansion of clean energy tax credits.

These incentives are crucial for making renewable energy accessible to families and small businesses in our community. They help reduce both energy costs and our environmental impact.

[Personal Story]

[Personal Reasoning]

Thank you for your consideration of this important issue.

Sincerely,
[Name]
[Address]`,
		message_body: `Dear Representative,

I am writing to urge you to support the continuation and expansion of clean energy tax credits.

These incentives are crucial for making renewable energy accessible to families and small businesses in our community. They help reduce both energy costs and our environmental impact.

[Personal Story]

[Personal Reasoning]

Thank you for your consideration of this important issue.

Sincerely,
[Name]
[Address]`,
		recipientEmails: [
			'rep.climate@house.gov',
			'senator.energy@senate.gov'
		],
		metrics: {
			sent: 1847,
			opened: 1203,
			clicked: 456,
			responded: 89
		},
		delivery_config: {
			timing: 'immediate',
			followUp: false
		},
		recipient_config: {
			emails: [
				'rep.climate@house.gov',
				'senator.energy@senate.gov'
			]
		},
		is_public: true
	},
	{
		title: 'Protect Healthcare Access',
		description: 'Advocate for maintaining accessible and affordable healthcare options for all constituents, especially vulnerable populations.',
		category: 'Healthcare',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Protect Healthcare Access for All',
		preview: `Dear Senator,

I am writing to express my strong support for legislation that protects and expands healthcare access.

Healthcare is a fundamental need, and policies that make it more accessible and affordable directly impact the wellbeing of our communities.

[Personal Story]

[Personal Reasoning]

I urge you to prioritize healthcare access in upcoming legislative decisions.

Respectfully,
[Name]
[Address]`,
		message_body: `Dear Senator,

I am writing to express my strong support for legislation that protects and expands healthcare access.

Healthcare is a fundamental need, and policies that make it more accessible and affordable directly impact the wellbeing of our communities.

[Personal Story]

[Personal Reasoning]

I urge you to prioritize healthcare access in upcoming legislative decisions.

Respectfully,
[Name]
[Address]`,
		recipientEmails: [
			'senator.health@senate.gov',
			'rep.healthcare@house.gov',
			'committee.health@congress.gov'
		],
		metrics: {
			sent: 2341,
			opened: 1789,
			clicked: 623,
			responded: 134
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true
		},
		recipient_config: {
			emails: [
				'senator.health@senate.gov',
				'rep.healthcare@house.gov',
				'committee.health@congress.gov'
			]
		},
		is_public: true
	},
	{
		title: 'Fund Public Education',
		description: 'Support increased federal funding for public schools, teacher training, and educational resources to strengthen our communities.',
		category: 'Education',
		type: 'advocacy',
		deliveryMethod: 'both',
		subject: 'Invest in Public Education Funding',
		preview: `Dear Representative,

I am writing to urge your support for increased federal funding for public education.

Quality education is the foundation of strong communities and economic opportunity. Our schools need adequate resources to provide every child with the education they deserve.

[Personal Story]

[Personal Reasoning]

Please prioritize education funding in upcoming budget decisions.

Thank you for your service,
[Name]
[Address]`,
		message_body: `Dear Representative,

I am writing to urge your support for increased federal funding for public education.

Quality education is the foundation of strong communities and economic opportunity. Our schools need adequate resources to provide every child with the education they deserve.

[Personal Story]

[Personal Reasoning]

Please prioritize education funding in upcoming budget decisions.

Thank you for your service,
[Name]
[Address]`,
		recipientEmails: [
			'rep.education@house.gov',
			'senator.schools@senate.gov',
			'committee.education@congress.gov'
		],
		metrics: {
			sent: 3156,
			opened: 2234,
			clicked: 892,
			responded: 167
		},
		delivery_config: {
			timing: 'immediate',
			followUp: true,
			cwcEnabled: true
		},
		recipient_config: {
			emails: [
				'rep.education@house.gov',
				'senator.schools@senate.gov',
				'committee.education@congress.gov'
			]
		},
		is_public: true
	}
]; 