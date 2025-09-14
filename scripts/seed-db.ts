import { PrismaClient } from '@prisma/client';
import { generateActionSlug } from '../src/lib/server/reserved-slugs.js';

const db: PrismaClient = new PrismaClient();

// Congressional Policy Areas mapping for CWC API compatibility
const policyAreaMap = {
    'Environment': 'Environmental Protection',
    'Healthcare': 'Health',
    'Economy': 'Economics and Public Finance',
    'Democracy': 'Government Operations and Politics',
    'Education': 'Education',
    'Immigration': 'Immigration',
    'Justice': 'Crime and Law Enforcement',
    'Housing': 'Housing and Community Development',
    'Defense': 'Armed Forces and National Security'
};

const seedTemplates = [
    {
        title: 'The Math Doesn\'t Work: Climate Edition',
        description: 'Expose the numbers behind fossil fuel subsidies while communities flood.',
        category: 'Environment',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Climate Subsidies',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
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
        metrics: { sent: 8234, opened: 0, clicked: 0, responded: 8234, districts_covered: 417, total_districts: 435, district_coverage_percent: 96 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['climate.committee@house.gov', 'environment.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Teachers Need 2 Jobs for 1 Bedroom',
        description: 'Expose how private equity owns 44% of homes while teachers work multiple jobs.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'The Math on Teacher Housing',
        preview: 'The math doesn\'t work anymore.',
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
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['council@seattle.gov'] },
        is_public: true
    },
    {
        title: 'SF Teachers Commute 2 Hours, Students Skip School',
        description: 'Expose how housing costs force teachers to commute while students become homeless.',
        category: 'Education',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'The Math on Student Housing',
        preview: 'The math doesn\'t work anymore.',
        message_body: `Dear San Francisco Board of Education,

The math doesn't work anymore.

Teachers commute 2+ hours because they can't afford SF.
Students miss 30+ school days due to housing instability.
The connection: No stable adults, no stable learning.

From [Address] where classrooms have substitute teachers and empty desks.

[Personal Connection]

How can students learn when teachers can't afford to live here?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 0, opened: 0, clicked: 0, responded: 0 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['boardoffice@sfusd.edu'] },
        is_public: true
    },
    {
        title: 'Canadian REITs Own 2.3 Million Units, Families Own None',
        description: 'Expose how Real Estate Investment Trusts monopolize Canadian housing.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'The Math on Housing Monopoly',
        preview: 'The math doesn\'t work anymore.',
        message_body: `Dear Prime Minister,

The math doesn't work anymore.

REITs control 2.3 million rental units across Canada.
First-time buyers: Down 47% since 2019.
The takeover: Corporations own homes, families rent forever.

From [Address] where entire neighborhoods are corporate-owned.

[Personal Connection]

Who should own Canadian homes?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 0, opened: 0, clicked: 0, responded: 0 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['pm@pm.gc.ca'] },
        is_public: true
    },
    {
        title: 'Insulin Costs More Than CEO Salaries',
        description: 'Expose pharmaceutical CEO compensation vs. patient costs.',
        category: 'Healthcare',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Insulin Prices',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
        message_body: `Dear [Representative Name],

The math doesn't work anymore.

Insulin costs $300 per month.
The pharma CEO made $21 million last year.
That's 5,833 months of insulin per CEO.

From [Address] where diabetics ration doses.

[Personal Connection]

Which number do you defend?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 9456, opened: 0, clicked: 0, responded: 9456, districts_covered: 398, total_districts: 435, district_coverage_percent: 91 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['healthcare.committee@house.gov', 'health.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Billionaires Pay Less Than Teachers',
        description: 'Expose effective tax rates: billionaires vs. working families.',
        category: 'Economy',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Tax Rates',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
        message_body: `Dear [Representative Name],

The math doesn't work anymore.

Billionaires pay 8.2% effective tax rate.
Teachers pay 22% effective tax rate.
The difference: Teachers fund billionaires.

From [Address] where teachers work summers to survive.

[Personal Connection]

Who should pay more?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 11234, opened: 0, clicked: 0, responded: 11234, districts_covered: 411, total_districts: 435, district_coverage_percent: 94 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['financial.services@house.gov', 'banking.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Democracy Costs $16.5 Billion, Autocracy is Free',
        description: 'Expose the price tag of dismantling democratic institutions.',
        category: 'Democracy',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Democracy',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
        message_body: `Dear [Representative Name],

The math doesn't work anymore.

Election security: $16.5 billion requested.
Schedule F reclassification: Unlimited power, no cost.
The price: Democracy has a budget. Autocracy doesn't.

From [Address] where voting machines need updating.

[Personal Connection]

Which system can we afford?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 8901, opened: 0, clicked: 0, responded: 8901, districts_covered: 389, total_districts: 435, district_coverage_percent: 89 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['oversight.committee@house.gov', 'rules.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Teachers Buy Supplies, Billionaires Buy Yachts',
        description: 'Expose teachers spending their own money while billionaires avoid taxes.',
        category: 'Education',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Teacher Spending',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
        message_body: `Dear [Representative Name],

The math doesn't work anymore.

Teachers spend $750 of their own money on supplies.
Billionaires paid 8.2% tax rate last year.
The gap: Teachers fund classrooms. Billionaires fund nothing.

From [Address] where teachers skip lunch to buy pencils.

[Personal Connection]

Who should pay for education?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 7823, opened: 0, clicked: 0, responded: 7823, districts_covered: 402, total_districts: 435, district_coverage_percent: 92 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['education.committee@house.gov', 'education.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Prisons Profit $74 Billion, Rehab Gets $0',
        description: 'Expose how prison companies profit while rehabilitation gets nothing.',
        category: 'Justice',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Prison Profits',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
        message_body: `Dear [Representative Name],

The math doesn't work anymore.

Private prisons: $74 billion industry.
Rehabilitation programs: Cut to zero in budget.
The result: 68% reoffend because profit beats prevention.

From [Address] where families can't afford prison phone calls.

[Personal Connection]

Which makes us safer?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 6234, opened: 0, clicked: 0, responded: 6234, districts_covered: 378, total_districts: 435, district_coverage_percent: 87 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['judiciary.committee@house.gov', 'judiciary.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Blackstone Owns Your Neighborhood',
        description: 'Expose how investment firms buy homes while families get evicted.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Corporate Housing',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
        message_body: `Dear [Representative Name],

The math doesn't work anymore.

Blackstone owns 300,000 single-family homes.
Families lost 2.3 million homes to eviction this year.
The transfer: Homes move from families to Wall Street.

From [Address] where neighbors got evicted for corporate profit.

[Personal Connection]

Who should own our neighborhoods?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 9123, opened: 0, clicked: 0, responded: 9123, districts_covered: 423, total_districts: 435, district_coverage_percent: 97 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['financial.services@house.gov', 'banking.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Deportation Costs $100 Billion, Schools Get $0',
        description: 'Expose immigration enforcement funding vs. underfunded schools.',
        category: 'Immigration',
        type: 'advocacy',
        deliveryMethod: 'certified',
        subject: 'The Math on Border Spending',
        preview: 'Dear [Representative Name], The math doesn\'t work anymore.',
        message_body: `Dear [Representative Name],

The math doesn't work anymore.

Immigration enforcement: $100 billion in new funding.
Title I school improvements: $0 in reconciliation.
The choice: Deportations or education.

From [Address] where schools need books, not border walls.

[Personal Connection]

Which investment builds America?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 5892, opened: 0, clicked: 0, responded: 5892, districts_covered: 356, total_districts: 435, district_coverage_percent: 82 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['homeland.security@house.gov', 'immigration.subcommittee@senate.gov'] },
        is_public: true
    },
    {
        title: 'SF Sweeps Cost $60K Per Tent Cleared',
        description: 'Expose the cost of tent sweeps vs. actual housing solutions.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'The Math on Tent Sweeps',
        preview: 'The math doesn\'t work anymore.',
        message_body: `Dear Mayor Breed and SF Board of Supervisors,

The math doesn't work anymore.

Tent sweeps: $60,000 per tent cleared.
Permanent housing: Only 13% transition from shelters.
The waste: $60K to move problems, $0 to solve them.

From [Address] where tents reappear the next block over.

[Personal Connection]

Which approach actually works?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 3456, opened: 0, clicked: 0, responded: 3456, districts_covered: 1, total_districts: 1, district_coverage_percent: 100 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['mayorlondonbreed@sfgov.org', 'board.of.supervisors@sfgov.org', 'district1@sfgov.org', 'district3@sfgov.org', 'district6@sfgov.org'] },
        is_public: true
    },
    {
        title: 'We Pay More for Broken Trains',
        description: 'Expose how transit costs rise while service gets worse.',
        category: 'Transportation',
        type: 'advocacy', 
        deliveryMethod: 'direct',
        subject: 'The Math on Transit Failure',
        preview: 'The math doesn\'t work anymore.',
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
        metrics: { sent: 5234, opened: 0, clicked: 0, responded: 5234, districts_covered: 1, total_districts: 1, district_coverage_percent: 100 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['info@cityhall.nyc.gov', 'speakeradams@council.nyc.gov', 'district1@council.nyc.gov', 'district2@council.nyc.gov'] },
        is_public: true
    },
    {
        title: 'Chicago Spends $4.9B on Police, $50M on Prevention',
        description: 'Expose police budget vs. violence prevention funding.',
        category: 'Public Safety',
        type: 'advocacy',
        deliveryMethod: 'direct', 
        subject: 'The Math on Violence Prevention',
        preview: 'The math doesn\'t work anymore.',
        message_body: `Dear Mayor Johnson and Chicago City Council,

The math doesn't work anymore.

Police budget: $4.9 billion this year.
Cure Violence programs: $50 million total.
The ratio: 98 to 1 for enforcement over prevention.

From [Address] where kids need jobs, not more squad cars.

[Personal Connection]

Which investment actually prevents violence?

Please explain this to your constituents.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 4567, opened: 0, clicked: 0, responded: 4567, districts_covered: 1, total_districts: 1, district_coverage_percent: 100 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['mayor@cityofchicago.org', 'ccc@cityofchicago.org'] },
        is_public: true
    }
];

async function seedDatabase() {
    console.log('🌱 Starting database seed...');
    
    try {
        // Clear existing template scopes and templates
        await db.template_scope.deleteMany({});
        await db.template.deleteMany({});
        console.log('✅ Cleared existing templates');
        
        // Insert templates with action-oriented slugs
        const createdTemplates = [];
        for (const template of seedTemplates) {
            // Generate action-oriented slug
            const actionSlug = generateActionSlug(template.title, template.deliveryMethod);
            
            const createdTemplate = await db.template.create({
                data: {
                    title: template.title,
                    slug: actionSlug,
                    description: template.description,
                    category: template.category,
                    type: template.type,
                    deliveryMethod: template.deliveryMethod,
                    subject: template.subject,
                    preview: template.preview,
                    message_body: template.message_body,
                    metrics: template.metrics,
                    delivery_config: template.delivery_config,
                    recipient_config: template.recipient_config,
                    is_public: template.is_public,
                    // Add CWC API policy area mapping
                    // policy_area: policyAreaMap[template.category] || template.category
                }
            });
            // Create a default broad scope per template (country-only US as demo)
            await db.template_scope.create({
                data: {
                    template_id: createdTemplate.id,
                    mode: 'country',
                    country_codes: ['US'],
                },
            });
            
            createdTemplates.push(createdTemplate);
            console.log(`📝 Created: "${template.title}" → ${actionSlug}`);
        }
        
        console.log(`✅ Seeded ${seedTemplates.length} templates`);
        
        // Verify the data
        const count = await db.template.count();
        console.log(`\n📊 Total templates in database: ${count}`);
        
        // Show template details with URLs
        console.log('\n🌐 Action-Oriented URLs:');
        console.log('========================');
        createdTemplates.forEach(t => {
            console.log(`📍 https://communi.email/${t.slug}`);
            console.log(`   "${t.title}" (${t.category})`);
            console.log('');
        });
        
        console.log('📋 Template Categories:');
        const categories = [...new Set(createdTemplates.map(t => t.category))];
        categories.forEach(cat => {
            const count = createdTemplates.filter(t => t.category === cat).length;
            console.log(`  • ${cat}: ${count} template${count > 1 ? 's' : ''}`);
        });
        
        console.log('\n🎉 Database seeding completed successfully!\n');
        console.log('💡 Pro Tips:');
        console.log('  • URLs are now action-oriented for better engagement');
        console.log('  • Congressional templates use "tell-congress-" prefix');
        console.log('  • Direct templates use action verbs (demand-, support-, stop-)');
        console.log('  • All URLs are social media ready and instantly copyable\n');
        
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await db.$disconnect();
    }
    
    process.exit(0);
}

seedDatabase();