import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	// Create test templates for E2E testing - Proper Congressional Format
	const templates = [
		{
			id: 'gun-safety-legislation',
			slug: 'support-gun-safety-reforms',
			title: 'Gun Safety Legislation',
			description: 'Urge Congress to pass comprehensive gun safety measures that protect communities while respecting constitutional rights.',
			category: 'Gun Safety',
			type: 'advocacy',
			deliveryMethod: 'certified',
			subject: 'Support Comprehensive Gun Safety Legislation',
			preview: 'Dear [Representative Name], I am writing to urge your support for common-sense gun safety measures.',
			message_body: `Dear [Representative Name],

I am writing as your constituent to urge your support for comprehensive gun safety legislation that will help protect our communities.

Gun violence continues to devastate families and communities across our nation. We need evidence-based solutions that respect constitutional rights while prioritizing public safety:

• Universal background checks for all gun sales
• Extreme risk protection orders (red flag laws)
• Safe storage requirements to prevent accidents
• Enhanced support for community violence intervention programs

[Personal Connection]

These measures have broad public support and can help reduce gun violence while protecting the rights of law-abiding gun owners.

Please support comprehensive gun safety legislation in Congress.

Sincerely,
[Name]
[Address]`,
			delivery_config: JSON.stringify({
				priority: 'high',
				followUp: true
			}),
			recipient_config: JSON.stringify({
				targetType: 'congress',
				chambers: ['house', 'senate'],
				committees: ['judiciary', 'public_safety']
			}),
			metrics: JSON.stringify({
				sent: 18456,
				views: 47291,
				responses: 892
			}),
			is_public: true,
			status: 'published'
		},
		{
			id: 'reproductive-healthcare-access', 
			slug: 'protect-reproductive-rights',
			title: 'Reproductive Healthcare Access',
			description: 'Advocate for protecting access to comprehensive reproductive healthcare services.',
			category: 'Reproductive Rights',
			type: 'advocacy',
			deliveryMethod: 'certified',
			subject: 'Protect Access to Reproductive Healthcare',
			preview: 'Dear [Representative Name], I am writing to urge protection of reproductive healthcare access.',
			message_body: `Dear [Representative Name],

I am writing to urge your support for protecting access to comprehensive reproductive healthcare services.

Access to reproductive healthcare is essential for the health, safety, and economic security of individuals and families. Key protections should include:

• Ensuring access to contraception and family planning services
• Protecting the doctor-patient relationship in medical decisions
• Supporting maternal health programs and resources
• Maintaining healthcare privacy protections

[Personal Connection]

These healthcare services are fundamental to ensuring healthy families and communities.

Please support legislation that protects access to reproductive healthcare.

Sincerely,
[Name]
[Address]`,
			delivery_config: JSON.stringify({
				priority: 'high',
				followUp: true
			}),
			recipient_config: JSON.stringify({
				targetType: 'congress',
				chambers: ['house', 'senate'],
				committees: ['health', 'judiciary']
			}),
			metrics: JSON.stringify({
				sent: 23847,
				views: 58291,
				responses: 1247
			}),
			is_public: true,
			status: 'published'
		},
		{
			id: 'affordable-housing-initiative',
			slug: 'support-affordable-housing', 
			title: 'Affordable Housing Initiative',
			description: 'Advocate for policies that address the housing affordability crisis and expand access to safe, affordable homes.',
			category: 'Housing',
			type: 'advocacy',
			deliveryMethod: 'certified',
			subject: 'Support Affordable Housing Solutions',
			preview: 'Dear [Representative Name], I am writing to urge support for affordable housing initiatives.',
			message_body: `Dear [Representative Name],

I am writing to urge your support for policies that address the housing affordability crisis affecting communities across our district.

Too many working families are struggling to find safe, affordable housing. We need comprehensive solutions that include:

• Increased funding for affordable housing development
• Down payment assistance programs for first-time homebuyers
• Tenant protections and rent stabilization measures
• Support for community land trusts and cooperative housing

[Personal Connection]

Safe, affordable housing is fundamental to strong communities and economic opportunity.

Please support federal initiatives that expand access to affordable housing.

Sincerely,
[Name]
[Address]`,
			delivery_config: JSON.stringify({
				priority: 'high',
				followUp: true
			}),
			recipient_config: JSON.stringify({
				targetType: 'congress',
				chambers: ['house', 'senate'],
				committees: ['financial_services', 'banking']
			}),
			metrics: JSON.stringify({
				sent: 15678,
				views: 34291,
				responses: 567
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