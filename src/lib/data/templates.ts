import type { Template } from '$lib/types/template';

export const templates: Template[] = [
    {
        id: 1,
        title: "Climate Action Support",
        description: "Support the Clean Energy Jobs Act",
        category: "Environment",
        type: "certified",
        deliveryMethod: "Congressional CWC System",
        metrics: {
            messages: "2,847 certified deliveries",
            districts: "34% of US House districts",
            tooltip: "Messages certified through Congressional CWC system with blockchain verification",
            verification: "Permanent Record",
            reach: "112 Congressional offices reached"
        },
        preview: `Dear [Representative],

I am writing as a constituent regarding the Clean Energy Jobs Act. This crucial legislation will help our community transition to sustainable energy while creating local jobs and economic opportunities.

[Your personal experience or connection to clean energy/jobs]

I urge you to support this important legislation that will benefit both our environment and economy.

Sincerely,
[Your Name]
[Your Address]`
    },
    {
        id: 2,
        title: "Global Health Access",
        description: "Support WHO pandemic preparedness funding",
        category: "Healthcare",
        type: "certified",
        deliveryMethod: "Congressional CWC System",
        metrics: {
            messages: "1,945 certified deliveries",
            districts: "28% of US House districts",
            tooltip: "Messages delivered to Congressional offices through verified channels",
            verification: "Permanent Record",
            reach: "89 Congressional offices reached"
        },
        preview: `Dear [Representative],

As your constituent, I urge you to support full funding for the World Health Organization's pandemic preparedness initiatives. Recent global health challenges have shown us the critical importance of international cooperation and preparedness.

[Your personal connection to healthcare/public health]

The investment in global health security today will protect all of us tomorrow.

Sincerely,
[Your Name]
[Your Address]`
    },
    {
        id: 3,
        title: "Tech Ethics Initiative",
        description: "Advocate for AI safety guidelines",
        category: "Technology",
        type: "direct",
        deliveryMethod: "Direct Email",
        metrics: {
            messages: "876 messages sent",
            reach: "Tech Industry Leaders",
            tooltip: "Direct outreach to technology company executives and board members",
            target: "Major Tech Companies"
        },
        preview: `Dear [Technology Leader],

I am writing regarding the implementation of ethical AI guidelines at [Company]. As AI systems become more prevalent, it's crucial that industry leaders like yourself prioritize safety and ethical considerations in AI development.

[Your perspective on AI safety/ethics]

I urge you to support and implement robust AI safety guidelines within your organization.

Regards,
[Your Name]`,
        recipientEmails: [
            "ceo@techcompany.com",
            "ethics@techcompany.com",
            "board@techcompany.com"
        ]
    },
    {
        id: 4,
        title: "Education Equity",
        description: "Support Title I funding increase",
        category: "Education",
        type: "certified",
        deliveryMethod: "Congressional CWC System",
        metrics: {
            messages: "3,241 certified deliveries",
            districts: "41% of US House districts",
            tooltip: "Messages delivered through official Congressional channels",
            verification: "Permanent Record",
            reach: "167 Congressional offices reached"
        },
        preview: `Dear [Representative],

I am writing to urge your support for increasing Title I funding in the upcoming education budget. As a constituent, I believe every child deserves access to quality education, regardless of their zip code.

[Your connection to education/local schools]

Please support increased Title I funding to help close the education gap in our communities.

Sincerely,
[Your Name]
[Your Address]`
    },
    {
        id: 5,
        title: "Fair Banking Access",
        description: "Support Community Reinvestment Act reforms",
        category: "Financial",
        type: "direct",
        deliveryMethod: "Direct Email",
        metrics: {
            messages: "654 messages sent",
            reach: "Banking Executives",
            tooltip: "Direct outreach to banking industry leaders",
            target: "Top 50 US Banks"
        },
        preview: `Dear [Banking Executive],

I am writing regarding your bank's Community Reinvestment Act compliance and community lending practices. Access to fair banking services is crucial for building strong, equitable communities.

[Your experience with banking access/community development]

I urge you to strengthen your community lending programs and support CRA reforms.

Sincerely,
[Your Name]`,
        recipientEmails: [
            "compliance@bank.com",
            "community@bank.com",
            "leadership@bank.com"
        ]
    },
    {
        id: 6,
        title: "Veterans Healthcare",
        description: "Improve VA mental health services",
        category: "Veterans",
        type: "certified",
        deliveryMethod: "Congressional CWC System",
        metrics: {
            messages: "2,156 certified deliveries",
            districts: "31% of US House districts",
            tooltip: "Messages certified through Congressional channels",
            verification: "Permanent Record",
            reach: "98 Congressional offices reached"
        },
        preview: `Dear [Representative],

As your constituent, I am writing to advocate for improved mental health services at VA facilities. Our veterans deserve comprehensive, accessible mental health care.

[Your connection to veterans/military service]

Please support increased funding for VA mental health services and staff.

Sincerely,
[Your Name]
[Your Address]`
    },
    {
        id: 7,
        title: "Food Security",
        description: "Support SNAP program expansion",
        category: "Social Services",
        type: "certified",
        deliveryMethod: "Congressional CWC System",
        metrics: {
            messages: "1,847 certified deliveries",
            districts: "27% of US House districts",
            tooltip: "Messages delivered through official channels",
            verification: "Permanent Record",
            reach: "87 Congressional offices reached"
        },
        preview: `Dear [Representative],

I am writing to urge your support for expanding SNAP benefits. Food security is a fundamental right, and many families in our community rely on this crucial program.

[Your experience with food security/community support]

Please support SNAP expansion in upcoming legislative sessions.

Sincerely,
[Your Name]
[Your Address]`
    },
    {
        id: 8,
        title: "Housing Affordability",
        description: "Advocate for rent control measures",
        category: "Housing",
        type: "direct",
        deliveryMethod: "Direct Email",
        metrics: {
            messages: "923 messages sent",
            reach: "Property Management Leaders",
            tooltip: "Direct outreach to housing industry executives",
            target: "Major Property Management Companies"
        },
        preview: `Dear [Property Management Executive],

I am writing regarding the pressing need for affordable housing solutions in our community. The current housing crisis requires leadership from industry stakeholders like yourself.

[Your experience with housing costs/community impact]

I urge you to support reasonable rent control measures and affordable housing initiatives.

Sincerely,
[Your Name]`,
        recipientEmails: [
            "management@property.com",
            "community@property.com",
            "leadership@property.com"
        ]
    }
];