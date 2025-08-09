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
        title: 'Stop Trump\'s Fossil Fuel Giveaway',
        description: 'Block the administration\'s plan to gut climate regulations and hand billions to oil executives.',
        category: 'Environment',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Reconciliation Bill Environmental Provisions',
        preview: 'Dear [Representative Name], The current bill prioritizes fossil fuel subsidies over climate action.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding the current reconciliation bill's environmental provisions and their impact on climate action.

Current policies are accelerating environmental damage:

• Fast-tracked drilling permits while communities face increased flooding
• Clean energy tax credits eliminated to fund fossil fuel subsidies
• EPA scientific staff reductions undermining climate assessment capability
• International climate commitments abandoned during extreme weather events
• Offshore renewable energy projects blocked while sea levels rise

Essential policy changes needed:

• Remove fossil fuel subsidies from the reconciliation bill
• Restore EPA's regulatory authority for climate protection
• Fund climate adaptation infrastructure for vulnerable communities
• Investigate conflicts of interest in energy policy decisions
• Prioritize renewable energy development over fossil fuel expansion

[Personal Connection]

Climate change requires immediate legislative action based on scientific evidence, not industry lobbying.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 8234, opened: 0, clicked: 0, responded: 8234, districts_covered: 417, total_districts: 435, district_coverage_percent: 96 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['climate.committee@house.gov', 'environment.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Seattle: Legalize Homes Near Transit',
        description: 'Urge the Seattle City Council to end exclusionary zoning and allow more housing near frequent transit.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'Upzone Near Transit and Permit More Homes',
        preview: 'Seattle must end exclusionary zoning and allow more homes near transit to reduce displacement and cut emissions.',
        message_body: `Dear Seattle City Council,

I am writing as a Seattle resident to urge you to allow more housing near frequent transit and walkable amenities.

Current zoning keeps most residential land locked to low-density use, which:

• Increases displacement pressure in limited upzoned areas
• Pushes new households to car-dependent exurbs
• Worsens climate emissions from longer commutes
• Keeps rents high and limits family-sized options

Please advance reforms to:

• Allow midrise housing near frequent transit, schools, and jobs
• Permit small apartments and missing-middle housing citywide
• Reduce costly parking mandates near frequent transit
• Pair upzoning with anti-displacement and affordability tools

[Personal Connection]

Please prioritize abundant homes near transit so people can live close to opportunity.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 0, opened: 0, clicked: 0, responded: 0 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['council@seattle.gov'] },
        is_public: true
    },
    {
        title: 'SFUSD: Keep Students Housed and Learning',
        description: 'Ask the San Francisco Board of Education to adopt a housing stability plan for students and educators.',
        category: 'Education',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'Adopt a Student and Educator Housing Stability Plan',
        preview: 'Housing instability hurts attendance and learning. Please act to stabilize students and educators.',
        message_body: `Dear San Francisco Board of Education,

Housing instability is directly impacting student attendance, graduation, and educator retention.

Please adopt a housing stability plan that includes:

• Expanded McKinney-Vento supports and rapid response for families at risk of eviction
• Partnerships for educator housing and rent stabilization tools
• Dedicated liaisons to coordinate school-city services
• Transparent metrics on housing-related absenteeism and interventions

[Personal Connection]

Stable housing supports stable learning. Please make this an immediate priority.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 0, opened: 0, clicked: 0, responded: 0 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['boardoffice@sfusd.edu'] },
        is_public: true
    },
    {
        title: 'Canada: Protect Housing Affordability',
        description: 'Urge the Prime Minister to strengthen measures that protect renters and first-time buyers.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'Strengthen Renter Protections and First-Time Buyer Supports',
        preview: 'Please act to protect renters and first-time buyers facing rising costs and limited supply.',
        message_body: `Dear Prime Minister,

I am writing regarding housing affordability pressures facing renters and first-time buyers across Canada.

Please strengthen measures to:

• Expand supply of purpose-built rental housing
• Support non-profit and co-op acquisition of at-risk affordable homes
• Enforce anti-renoviction and fair notice protections
• Improve first-time buyer access without inflating prices

[Personal Connection]

Thank you for prioritizing stable, affordable homes in every community.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 0, opened: 0, clicked: 0, responded: 0 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['pm@pm.gc.ca'] },
        is_public: true
    },
    {
        title: 'Block GOP Medicaid Cuts',
        description: 'Stop Republicans from gutting healthcare to fund tax cuts for billionaires.',
        category: 'Healthcare',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Medicaid Funding and Healthcare Access',
        preview: 'Dear [Representative Name], The reconciliation bill reduces healthcare access while extending tax benefits.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding proposed changes to Medicaid funding and healthcare access in the current reconciliation bill.

The proposed healthcare provisions would:

• Reduce Medicaid funding by $500 billion while lowering corporate tax rates
• Impose work requirements that restrict coverage for disabled individuals
• Eliminate ACA insurance subsidies during a period of rising healthcare costs
• Cap prescription drug benefits affecting seniors' medication access
• Defund community health centers serving rural and low-income areas

Simultaneously, tax benefits would extend to:

• Financial sector professionals through carried interest provisions
• Real estate investment structures
• Pharmaceutical industry executives
• Health insurance company shareholders

[Personal Connection]

Healthcare policy should prioritize patient outcomes and access over industry profits.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 9456, opened: 0, clicked: 0, responded: 9456, districts_covered: 398, total_districts: 435, district_coverage_percent: 91 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['healthcare.committee@house.gov', 'health.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Stop the Billionaire Tax Heist',
        description: 'Block the 2017 tax cut extensions that favor wealthy individuals over working families.',
        category: 'Economy',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Tax Policy and Economic Equity',
        preview: 'Dear [Representative Name], The tax reconciliation bill disproportionately benefits high earners.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding the proposed extension of 2017 tax provisions and their economic impact.

The current reconciliation bill would:

• Extend $1.9 trillion in tax benefits primarily to high-income earners
• Reduce estate taxes on inherited wealth above $11 million
• Lower corporate tax rates below individual rates for many workers
• Preserve carried interest loopholes for investment fund managers
• Expand depreciation benefits for private aircraft and luxury assets

Simultaneously, spending reductions target:

• $30 billion from SNAP nutrition assistance programs
• Medicaid funding for disability services
• Child tax credits that reduced family poverty
• Head Start early childhood education programs
• Housing assistance during rising homelessness

[Personal Connection]

Tax policy should strengthen economic opportunity for working families, not concentrate wealth among high earners.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 11234, opened: 0, clicked: 0, responded: 11234, districts_covered: 411, total_districts: 435, district_coverage_percent: 94 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['financial.services@house.gov', 'banking.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Strengthen Democratic Institutions',
        description: 'Support measures to protect democratic processes and government accountability.',
        category: 'Democracy',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Government Accountability and Democratic Reform',
        preview: 'Dear [Representative Name], Democracy requires strong institutions and transparent governance.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding proposed changes to government operations and democratic oversight mechanisms.

Current proposals would modify:

• Civil service employment protections through Schedule F reclassification
• Department of Justice independence in criminal investigations
• Congressional subpoena enforcement capabilities
• Ethics oversight for government officials
• Election security funding and oversight

Essential democratic safeguards include:

• Maintaining independent inspector general offices
• Preserving civil service merit-based employment
• Ensuring transparent campaign finance reporting
• Protecting voting access and election security
• Strengthening ethics enforcement across government branches

[Personal Connection]

Democratic institutions require bipartisan support to maintain public trust and effective governance.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 8901, opened: 0, clicked: 0, responded: 8901, districts_covered: 389, total_districts: 435, district_coverage_percent: 89 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['oversight.committee@house.gov', 'rules.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Education Funding Priorities',
        description: 'Advocate for increased education investment and teacher support.',
        category: 'Education',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Education Budget and Resource Allocation',
        preview: 'Dear [Representative Name], Education funding should match the importance of learning outcomes.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding federal education funding priorities and resource allocation.

Current education challenges include:

• Teachers spending personal funds on classroom supplies
• Aging school infrastructure affecting learning environments
• Outdated textbooks and educational materials
• Insufficient counseling staff during mental health crises
• Student lunch debt in economically disadvantaged districts

Essential education investments:

• Competitive teacher salaries to attract qualified educators
• School building modernization and safety improvements
• Universal school meal programs for all students
• Reduced class sizes for more individualized attention
• Mental health support staff in every school

[Personal Connection]

Quality education requires adequate funding to support both students and educators effectively.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 7823, opened: 0, clicked: 0, responded: 7823, districts_covered: 402, total_districts: 435, district_coverage_percent: 92 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['education.committee@house.gov', 'education.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Criminal Justice Reform',
        description: 'Support evidence-based approaches to incarceration and rehabilitation.',
        category: 'Justice',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Incarceration Policy and Rehabilitation',
        preview: 'Dear [Representative Name], Criminal justice policy should emphasize rehabilitation over profit.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding criminal justice policy and incarceration practices.

Current system challenges:

• Private prison contracts with occupancy requirements
• Below-minimum-wage prison labor practices
• High-cost communication services for incarcerated individuals
• Family separation due to non-violent offense sentences
• Recidivism rates indicating insufficient rehabilitation programs

Policy improvements needed:

• Eliminate private prison and detention center contracts
• Reform cash bail system that discriminates based on wealth
• Expunge records for non-violent marijuana-related convictions
• Restore voting rights for formerly incarcerated citizens
• Expand rehabilitation, education, and mental health services

[Personal Connection]

Effective criminal justice policy should reduce recidivism through evidence-based rehabilitation approaches.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 6234, opened: 0, clicked: 0, responded: 6234, districts_covered: 378, total_districts: 435, district_coverage_percent: 87 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['judiciary.committee@house.gov', 'judiciary.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Housing Affordability Crisis',
        description: 'Address housing costs and availability through comprehensive policy solutions.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Housing Policy and Market Regulation',
        preview: 'Dear [Representative Name], Housing costs require policy intervention to ensure affordability.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding housing affordability and market dynamics affecting families nationwide.

Current housing market conditions:

• Median home prices at historically high income ratios
• Investment firm purchases of residential properties
• Rising eviction rates amid stagnant wages
• Homelessness increasing despite economic growth
• Veterans experiencing housing insecurity

Policy solutions needed:

• Rent stabilization tied to local median incomes
• Restrictions on corporate single-family home ownership
• Expanded public housing investment similar to international models
• Higher taxes on vacant residential properties
• Constitutional recognition of housing as a fundamental right

[Personal Connection]

Housing policy should prioritize stable communities over speculative investment returns.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 9123, opened: 0, clicked: 0, responded: 9123, districts_covered: 423, total_districts: 435, district_coverage_percent: 97 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['financial.services@house.gov', 'banking.committee@senate.gov'] },
        is_public: true
    },
    {
        title: 'Immigration Policy Reform',
        description: 'Support comprehensive immigration policy focused on human dignity and economic needs.',
        category: 'Immigration',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Immigration Policy and Border Security',
        preview: 'Dear [Representative Name], Immigration policy should balance security with humanitarian concerns.',
        message_body: `Dear [Representative Name],

I am writing from [Address] regarding immigration policy and border security funding in the reconciliation bill.

Current immigration enforcement includes:

• $100 billion allocated for expanded deportation operations
• Increased detention facility capacity
• National Guard deployment for immigration enforcement
• ICE expansion affecting mixed-status families
• Border infrastructure prioritized over other infrastructure needs

Alternative policy approaches:

• Address root causes of migration through development aid
• Provide pathways to legal status for established residents
• Reunite families separated by immigration enforcement
• Restore asylum processing capacity and protections
• Focus border security on actual security threats

[Personal Connection]

Immigration policy should reflect both national security needs and humanitarian values.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 5892, opened: 0, clicked: 0, responded: 5892, districts_covered: 356, total_districts: 435, district_coverage_percent: 82 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['homeland.security@house.gov', 'immigration.subcommittee@senate.gov'] },
        is_public: true
    },
    {
        title: 'SF Homelessness: Stop the Sweeps',
        description: 'Direct action against San Francisco\'s tent encampment clearings without adequate shelter alternatives.',
        category: 'Housing',
        type: 'advocacy',
        deliveryMethod: 'direct',
        subject: 'Tent Sweeps Are Not Housing Solutions',
        preview: 'Your encampment clearance policies move homelessness out of sight without creating permanent housing.',
        message_body: `Dear Mayor Breed and SF Board of Supervisors,

I am writing regarding San Francisco's encampment sweep policies and their impact on unhoused residents.

Current sweep operations result in:

• Confiscation of personal belongings including medication and identification
• Displacement without guaranteed shelter alternatives
• 85% reduction in visible tents but unclear impact on actual homelessness
• People sleeping rough without even basic tent shelter
• Only 13% of shelter residents transitioning to permanent housing

Effective homelessness solutions require:

• Guaranteed shelter placement before any encampment clearing
• Safe storage for personal belongings during transitions
• Mental health and addiction services integrated with housing
• Accelerated affordable housing production
• Focus on permanent housing outcomes, not just clearing visible camps

[Personal Connection]

Housing policy should address root causes, not criminalize poverty through visibility enforcement.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 3456, opened: 0, clicked: 0, responded: 3456, districts_covered: 1, total_districts: 1, district_coverage_percent: 100 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['mayorlondonbreed@sfgov.org', 'board.of.supervisors@sfgov.org', 'district1@sfgov.org', 'district3@sfgov.org', 'district6@sfgov.org'] },
        is_public: true
    },
    {
        title: 'NYC: Fix the Subway System',
        description: 'Demand immediate action from NYC officials on subway delays, safety, and accessibility.',
        category: 'Transportation',
        type: 'advocacy', 
        deliveryMethod: 'direct',
        subject: 'MTA Crisis Requires Emergency Action',
        preview: 'The subway system is failing millions of daily riders with preventable delays and safety issues.',
        message_body: `Dear Mayor Adams and NYC Council,

I am writing about the Metropolitan Transportation Authority crisis affecting millions of daily commuters.

Current MTA conditions include:

• 75% on-time performance during peak hours
• Elevator outages affecting accessibility compliance
• Platform overcrowding creating safety hazards
• Signal failures causing cascading delays
• Deferred maintenance backlog approaching $50 billion

Immediate improvements needed:

• Emergency funding for signal system modernization
• Mandatory accessibility upgrades at all stations
• Increased service frequency during peak hours
• Transparent reporting on maintenance schedules
• Investment in electric bus fleet expansion

[Personal Connection]

Public transportation is essential infrastructure that affects economic opportunity and quality of life for all New Yorkers.

Sincerely,
[Name]
[Address]`,
        metrics: { sent: 5234, opened: 0, clicked: 0, responded: 5234, districts_covered: 1, total_districts: 1, district_coverage_percent: 100 },
        delivery_config: { timing: 'immediate', followUp: false, cwcEnabled: false },
        recipient_config: { emails: ['info@cityhall.nyc.gov', 'speakeradams@council.nyc.gov', 'district1@council.nyc.gov', 'district2@council.nyc.gov'] },
        is_public: true
    },
    {
        title: 'Chicago: Address Gun Violence Crisis',
        description: 'Demand comprehensive action from Chicago officials on community violence prevention.',
        category: 'Public Safety',
        type: 'advocacy',
        deliveryMethod: 'direct', 
        subject: 'Community Violence Prevention Funding',
        preview: 'Chicago needs comprehensive violence intervention programs, not just increased policing.',
        message_body: `Dear Mayor Johnson and Chicago City Council,

I am writing about community violence prevention strategies and their funding priorities.

Current violence intervention gaps:

• Limited funding for community-based violence prevention programs
• Insufficient mental health crisis response teams
• Inadequate youth programming in high-risk neighborhoods
• Economic disinvestment in communities with highest violence rates
• Trauma-informed services underfunded compared to enforcement

Evidence-based solutions to prioritize:

• Expand Cure Violence and similar community intervention programs
• Fund youth employment and mentorship opportunities
• Increase mental health services in public schools
• Support small business development in affected neighborhoods  
• Invest in trauma recovery services for families

[Personal Connection]

Community safety requires addressing root causes through investment in people and neighborhoods, not just enforcement.

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
        // Clear existing templates
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