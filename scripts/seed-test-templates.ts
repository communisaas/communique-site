import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	// Create test templates for E2E testing
	const templates = [
		{
			id: 'climate-action-template',
			slug: 'climate-action',
			title: 'Climate Action Template',
			description: 'Urge your representatives to take immediate action on climate change',
			category: 'Environment',
			type: 'advocacy',
			deliveryMethod: 'both',
			subject: 'Urgent Action Needed on Climate Change',
			preview: 'Dear Representative, I am writing as your constituent to urge immediate action...',
			message_body: `Dear [REPRESENTATIVE_NAME],

I am writing as your constituent to urge immediate action on climate change.

The science is clear: we need bold action now to address the climate crisis. I am asking you to:

- Support renewable energy investments
- Vote for strong climate legislation
- Oppose new fossil fuel projects

My community is already feeling the impacts of climate change, and we need leaders who will act with the urgency this crisis demands.

Thank you for your consideration.

Sincerely,
[YOUR_NAME]
[YOUR_ADDRESS]`,
			delivery_config: JSON.stringify({
				priority: 'high',
				followUp: true
			}),
			recipient_config: JSON.stringify({
				targetType: 'congress',
				chambers: ['house', 'senate'],
				committees: ['energy', 'environment']
			}),
			metrics: JSON.stringify({
				sent: 1247,
				views: 3890,
				responses: 23
			}),
			is_public: true,
			status: 'published'
		},
		{
			id: 'healthcare-access-template', 
			slug: 'healthcare-access',
			title: 'Healthcare Access Template',
			description: 'Advocate for affordable healthcare access for all Americans',
			category: 'Healthcare',
			type: 'advocacy',
			deliveryMethod: 'both',
			subject: 'Support Universal Healthcare Access',
			preview: 'Dear Representative, Healthcare is a human right...',
			message_body: `Dear [REPRESENTATIVE_NAME],

Healthcare is a human right, and I urge you to support legislation that ensures all Americans have access to affordable healthcare.

The current system leaves too many families choosing between medical care and basic necessities. We need:

- Medicare for All or similar universal coverage
- Price controls on prescription drugs
- Protection for pre-existing conditions

Every person deserves quality healthcare regardless of their financial situation.

Thank you for fighting for your constituents' health and wellbeing.

Sincerely,
[YOUR_NAME]
[YOUR_ADDRESS]`,
			delivery_config: JSON.stringify({
				priority: 'high',
				followUp: true
			}),
			recipient_config: JSON.stringify({
				targetType: 'congress',
				chambers: ['house', 'senate'],
				committees: ['health']
			}),
			metrics: JSON.stringify({
				sent: 892,
				views: 2156,
				responses: 31
			}),
			is_public: true,
			status: 'published'
		},
		{
			id: 'education-funding-template',
			slug: 'education-funding', 
			title: 'Education Funding Template',
			description: 'Support increased funding for public education',
			category: 'Education',
			type: 'advocacy',
			deliveryMethod: 'email',
			subject: 'Increase Public Education Funding',
			preview: 'Dear [RECIPIENT], Our schools need your support...',
			message_body: `Dear [RECIPIENT_NAME],

Our public schools are the foundation of our democracy and economic future, but they are severely underfunded.

I urge you to support increased funding for:

- Teacher salaries and professional development
- School infrastructure and technology
- Special education services
- After-school and enrichment programs

Every child deserves a quality education, regardless of their zip code.

Please prioritize education funding in the upcoming budget.

Sincerely,
[YOUR_NAME]`,
			delivery_config: JSON.stringify({
				priority: 'medium',
				followUp: false
			}),
			recipient_config: JSON.stringify({
				targetType: 'local',
				offices: ['school_board', 'superintendent']
			}),
			metrics: JSON.stringify({
				sent: 634,
				views: 1429,
				responses: 18
			}),
			is_public: true,
			status: 'published'
		}
	];

	for (const template of templates) {
		await prisma.template.upsert({
			where: { slug: template.slug },
			update: {
				...template,
				updatedAt: new Date()
			},
			create: {
				...template,
				createdAt: new Date(),
				updatedAt: new Date()
			}
		});
		
		console.log(`✓ Created/updated template: ${template.title}`);
	}

	console.log('\n🎉 Test templates seeded successfully!');
}

main()
	.catch((e) => {
		console.error('❌ Seeding failed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});