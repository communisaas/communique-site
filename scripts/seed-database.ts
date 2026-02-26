/**
 * Static Database Seed Script
 *
 * Seeds the database with pre-resolved template data from the agent pipeline.
 * No API keys needed -- all content is embedded directly.
 *
 * Usage:
 *   npx tsx scripts/seed-database.ts
 *
 * Required env vars:
 *   DATABASE_URL  - Database connection string (defaults to local via .env)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';

const db = new PrismaClient();

// ============================================================================
// TEARDOWN -- dependency order (mirrors seed-with-agents.ts)
// ============================================================================

async function teardownDatabase() {
	console.log('Starting complete database teardown...');

	// Order: children before parents (FK dependency)
	const deletions = [
		{ name: 'agent_trace', fn: () => db.agentTrace.deleteMany({}) },
		{ name: 'submission_retry', fn: () => db.submissionRetry.deleteMany({}) },
		{ name: 'verification_audit', fn: () => db.verificationAudit.deleteMany({}) },
		{ name: 'shadow_atlas_registration', fn: () => db.shadowAtlasRegistration.deleteMany({}) },
		{ name: 'debate_argument', fn: () => db.debateArgument.deleteMany({}) },
		{ name: 'debate', fn: () => db.debate.deleteMany({}) },
		{ name: 'resolved_contact', fn: () => db.resolvedContact.deleteMany({}) },
		{ name: 'parsed_document_cache', fn: () => db.parsedDocumentCache.deleteMany({}) },
		{ name: 'intelligence', fn: () => db.intelligence.deleteMany({}) },
		{ name: 'rate_limit', fn: () => db.rateLimit.deleteMany({}) },
		{ name: 'district_credential', fn: () => db.districtCredential.deleteMany({}) },
		{ name: 'verification_session', fn: () => db.verificationSession.deleteMany({}) },
		{ name: 'submission', fn: () => db.submission.deleteMany({}) },
		{ name: 'encrypted_delivery_data', fn: () => db.encryptedDeliveryData.deleteMany({}) },
		{ name: 'privacy_budget', fn: () => db.privacy_budget.deleteMany({}) },
		{ name: 'analytics_snapshot', fn: () => db.analytics_snapshot.deleteMany({}) },
		{ name: 'analytics_aggregate', fn: () => db.analytics_aggregate.deleteMany({}) },
		{ name: 'user_representatives', fn: () => db.user_representatives.deleteMany({}) },
		{ name: 'representative', fn: () => db.representative.deleteMany({}) },
		{ name: 'legislative_channel', fn: () => db.legislative_channel.deleteMany({}) },
		{ name: 'template_campaign', fn: () => db.template_campaign.deleteMany({}) },
		{ name: 'template_jurisdiction', fn: () => db.templateJurisdiction.deleteMany({}) },
		{ name: 'template_scope', fn: () => db.templateScope.deleteMany({}) },
		{ name: 'message', fn: () => db.message.deleteMany({}) },
		{ name: 'template', fn: () => db.template.deleteMany({}) },
		{ name: 'session', fn: () => db.session.deleteMany({}) },
		{ name: 'account', fn: () => db.account.deleteMany({}) },
		{ name: 'user', fn: () => db.user.deleteMany({}) },
	];

	for (const { name, fn } of deletions) {
		try {
			const result = await fn();
			if (result.count > 0) {
				console.log(`  Deleted ${result.count} ${name} records`);
			}
		} catch {
			console.log(`  Skipped ${name} (table may not exist)`);
		}
	}

	console.log('Database teardown complete\n');
}

// ============================================================================
// SEED DATA -- Users
// ============================================================================

const USERS = [
	{
		id: "user-seed-1",
		email: "seed-1@communi.email",
		name: "Alex Rivera",
		avatar: null,
		createdAt: "2026-02-25T22:35:45.907Z",
		updatedAt: "2026-02-25T22:35:45.907Z",
		is_verified: true,
		verification_method: "mdl",
		verification_data: null,
		verified_at: "2026-02-25T22:35:35.591Z",
		identity_hash: null,
		identity_fingerprint: null,
		birth_year: 1992,
		identity_commitment: null,
		document_type: "drivers_license",
		encrypted_entropy: null,
		authority_level: 3,
		trust_tier: 1,
		passkey_credential_id: null,
		passkey_public_key_jwk: null,
		did_key: null,
		passkey_created_at: null,
		passkey_last_used_at: null,
		address_verification_method: null,
		address_verified_at: null,
		wallet_address: null,
		district_hash: null,
		trust_score: 85,
		reputation_tier: "verified",
		district_verified: false,
		templates_contributed: 0,
		template_adoption_rate: 0,
		peer_endorsements: 0,
		active_months: 0,
		role: null,
		organization: null,
		location: "Denver, CO",
		connection: null,
		profile_completed_at: "2026-02-25T22:35:35.591Z",
		profile_visibility: "public"
	},
	{
		id: "user-seed-2",
		email: "seed-2@communi.email",
		name: "Jordan Chen",
		avatar: null,
		createdAt: "2026-02-25T22:35:46.512Z",
		updatedAt: "2026-02-25T22:35:46.512Z",
		is_verified: true,
		verification_method: "mdl",
		verification_data: null,
		verified_at: "2026-02-25T22:35:35.591Z",
		identity_hash: null,
		identity_fingerprint: null,
		birth_year: 1988,
		identity_commitment: null,
		document_type: "drivers_license",
		encrypted_entropy: null,
		authority_level: 3,
		trust_tier: 1,
		passkey_credential_id: null,
		passkey_public_key_jwk: null,
		did_key: null,
		passkey_created_at: null,
		passkey_last_used_at: null,
		address_verification_method: null,
		address_verified_at: null,
		wallet_address: null,
		district_hash: null,
		trust_score: 72,
		reputation_tier: "verified",
		district_verified: false,
		templates_contributed: 0,
		template_adoption_rate: 0,
		peer_endorsements: 0,
		active_months: 0,
		role: null,
		organization: null,
		location: "Toronto, ON",
		connection: null,
		profile_completed_at: "2026-02-25T22:35:35.591Z",
		profile_visibility: "public"
	},
	{
		id: "user-seed-3",
		email: "seed-3@communi.email",
		name: "Morgan Tremblay",
		avatar: null,
		createdAt: "2026-02-25T22:35:46.932Z",
		updatedAt: "2026-02-25T22:35:46.932Z",
		is_verified: false,
		verification_method: null,
		verification_data: null,
		verified_at: null,
		identity_hash: null,
		identity_fingerprint: null,
		birth_year: null,
		identity_commitment: null,
		document_type: null,
		encrypted_entropy: null,
		authority_level: 1,
		trust_tier: 1,
		passkey_credential_id: null,
		passkey_public_key_jwk: null,
		did_key: null,
		passkey_created_at: null,
		passkey_last_used_at: null,
		address_verification_method: null,
		address_verified_at: null,
		wallet_address: null,
		district_hash: null,
		trust_score: 0,
		reputation_tier: "novice",
		district_verified: false,
		templates_contributed: 0,
		template_adoption_rate: 0,
		peer_endorsements: 0,
		active_months: 0,
		role: null,
		organization: null,
		location: null,
		connection: null,
		profile_completed_at: null,
		profile_visibility: "private"
	},
];

// ============================================================================
// SEED DATA -- Templates
// ============================================================================

const TEMPLATES = [
	{
		id: "cmm2m8z6j000hw923kxy583db",
		title: "Stop making rural veterans drive hours for basic care",
		slug: "va-rural-care-access",
		description: "The Department of Veterans Affairs must fund the expansion of telehealth services to every rural clinic across the country.",
		category: "Healthcare",
		topics: ["veterans", "healthcare", "rural", "telehealth"],
		type: "advocacy",
		deliveryMethod: "cwc",
		country_code: "US",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "It is exhausting to spend five hours on the road for a twenty-minute appointment. For a veteran living in a rural community, managing a service-connected injury shouldn't be an endurance test of geography. We have the technology to end the 'VA commute,' but for too many of us, that care is still just out of reach.\n\n[Personal Connection]\n\nTelehealth is no longer an experiment; it is a proven lifeline. In 2025 alone, over 2.1 million veterans participated in more than 7.7 million episodes of virtual care [2]. For those of us in remote areas, these services save an average of two and a half hours in travel time and over $65 in costs per visit [5]. However, one-third of all veterans still face significant barriers like limited broadband and extreme distances to the nearest VA facility [3]. The 'Anywhere to Anywhere' initiative is a powerful vision [4], but it only works if there is a reliable access point in our actual communities.\n\nWith the recent implementation of the Elizabeth Dole 21st Century Veterans Healthcare and Benefits Improvement Act, the VA now has more flexibility to increase expenditure caps for non-institutional care [1]. This is the moment to finish the job. I am asking you to fully fund and scale the expansion of telehealth access points to every rural clinic and designated non-VA facility in underserved areas [6]. Please ensure that the permanent telescreening services currently being proposed become a reality for every veteran, regardless of their zip code [1]. We have served our country; we shouldn't have to struggle just to see a doctor.\n\n[Name]",
		preview: "It is exhausting to spend five hours on the road for a twenty-minute appointment. For a veteran living in a rural community, managing a service-connected injury shouldn't be an endurance test of geogr",
		sources: [
			{
				num: 1,
				url: "https://www.ruralhealthinfo.org/topics/returning-soldier-and-veteran-health/news",
				type: "other",
				title: "Rural Veterans and Access to Healthcare \u2013 News"
			},
			{
				num: 2,
				url: "https://www.military.com/benefits/veterans-health-care/beyond-virtual-visit-growing-reach-of-va-telehealth-2025.html",
				type: "journalism",
				title: "Beyond The Virtual Visit: The Growing Reach of VA Telehealth in 2025"
			},
			{
				num: 3,
				url: "https://www.gao.gov/products/gao-24-107559",
				type: "government",
				title: "VA Health Care: Opportunities to Improve Access for Veterans Living in Rural Areas"
			},
			{
				num: 4,
				url: "https://www.ruralhealth.va.gov/RURALHEALTH/docs/issue-briefs/Rural_Telehealth_Fact_Sheet_508c.pdf",
				type: "government",
				title: "Fact Sheet: Rural Telehealth"
			},
			{
				num: 5,
				url: "https://www.mdpi.com/2075-4698/14/12/264",
				type: "research",
				title: "Telehealth for Rural Veterans in the United States: A Systematic Review of Utilization, Cost Savings, and Impact of COVID-19"
			},
			{
				num: 6,
				url: "https://www.route-fifty.com/digital-government/2024/11/va-proposes-funding-telehealth-access-points-non-va-facilities/400984/",
				type: "journalism",
				title: "VA proposes funding telehealth access points at non-VA facilities"
			}
		],
		research_log: [
			"VA telehealth expansion rural clinics 2026 funding",
			"Department of Veterans Affairs rural health telehealth initiatives 2025 2026",
			"GAO report VA rural veteran healthcare access 2025 2026",
			"VA Office of Rural Health telehealth expansion news 2026",
			"impact of telehealth on rural veterans travel time research 2024 2025"
		],
		recipient_config: {
			reach: "district-based",
			chambers: ["house", "senate"],
			cwcRouting: true
		},
		delivery_config: {
			timing: "immediate",
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: "veterans",
			urgency: "high",
			policy_area: "Healthcare"
		},
		metrics: {
			sent: 0,
			views: 3,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 435,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-1",
		createdAt: "2026-02-25T22:38:44.251Z"
	},
	{
		id: "cmm2md4rd000zw923wi66rmse",
		title: "Stop harvesting our children under laws from 1998",
		slug: "coppa-child-harvest",
		description: "The Federal Government must fix COPPA to stop the relentless harvesting of our children's data.",
		category: "Digital Rights",
		topics: ["privacy", "children", "data", "coppa"],
		type: "advocacy",
		deliveryMethod: "cwc",
		country_code: "US",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "We are currently raising a generation of children under a digital shield forged in 1998. It is a haunting absurdity that the primary law meant to protect our kids is actually older than the kids themselves. While the average child now spends seven hours a day online, tech companies are harvesting an estimated 72 million data points per child every year\u2014a level of intimate surveillance that the original authors of COPPA could never have anticipated.\n\n[Personal Connection]\n\nThe consequences of this outdated framework are not theoretical. In a single year, 1.74 million children had their personal information stolen and used fraudulently [4]. While the FTC has set a compliance deadline of April 22, 2026, for recent rule amendments [1], regulatory updates alone cannot bridge the gap created by thirty years of legislative stagnation. We are watching as Congress debates a sweeping package of online safety bills [5], but the time for debate has passed; we need the actual protection of the law.\n\nI am asking you to take immediate action to pass COPPA 2.0 (HR 6291). This legislation is essential to expand protections to minors under 17, implement a mandatory 'eraser button' for children's data, and finally prohibit the targeted advertising that treats our children's vulnerabilities as profit centers [2]. With the FTC already prioritizing enforcement against the monetization of children's data this year [3], you must provide the legislative mandate to stop this harvesting once and for all.\n\n[Name]",
		preview: "We are currently raising a generation of children under a digital shield forged in 1998. It is a haunting absurdity that the primary law meant to protect our kids is actually older than the kids thems",
		sources: [
			{
				num: 1,
				url: "https://www.mayerbrown.com/en/insights/publications/2026/01/little-users-big-rules-tracking-childrens-privacy-legislation",
				type: "legal",
				title: "Little Users, Big Rules: Tracking Children's Privacy Legislation | Insights | Mayer Brown"
			},
			{
				num: 2,
				url: "https://www.dwt.com/insights/2026/01/federal-online-safety-legislation-hits-congress",
				type: "legal",
				title: "Wave of Federal \"Online Safety\" Legislation Hits Congress | Davis Wright Tremaine"
			},
			{
				num: 3,
				url: "https://iapp.org/news/a/ftc-shares-insight-into-its-childrens-privacy-priorities",
				type: "journalism",
				title: "FTC shares insight into its children's privacy priorities - IAPP"
			},
			{
				num: 4,
				url: "https://studentbriefs.law.gwu.edu/crcl/2025/10/21/upgrading-coppa-disclosure-for-childrens-online-privacy/",
				type: "research",
				title: "Upgrading COPPA Disclosure for Children's Online Privacy - Student Briefs of The George Washington University School of Law"
			},
			{
				num: 5,
				url: "https://www.childrenandscreens.org/newsroom/news/policy-update-january-2026/",
				type: "advocacy",
				title: "Policy Update: January 2026 - Children and Screens"
			}
		],
		research_log: [
			"COPPA 2.0 legislation status 2026 federal government update",
			"FTC COPPA Rule review and updates 2025 2026 official reports",
			"recent academic research on children's data harvesting and COPPA 2025 2026",
			"latest news on children's online privacy protection act reform 2026",
			"KOSAA and COPPA 2.0 progress 2026 congress"
		],
		recipient_config: {
			reach: "district-based",
			chambers: ["house", "senate"],
			cwcRouting: true
		},
		delivery_config: {
			timing: "immediate",
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: "privacy",
			urgency: "high",
			policy_area: "Digital Rights"
		},
		metrics: {
			sent: 0,
			views: 5,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 435,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-1",
		createdAt: "2026-02-25T22:41:58.105Z"
	},
	{
		id: "cmm2mi24n001hw9232anvl55b",
		title: "Stop leaving our families behind while Colorado thrives",
		slug: "replicate-colorado-preschool",
		description: "The State Legislature must replicate the success of Colorado's universal preschool program to ensure our families are no longer crushed by the cost of care.",
		category: "Education",
		topics: ["childcare", "education", "economic-relief", "family-support"],
		type: "advocacy",
		deliveryMethod: "cwc",
		country_code: "US",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "It is exhausting to watch a proven solution succeed in one part of the country while families in our own communities are left to solve an impossible math problem. We know that every dollar invested in childcare returns over four dollars to the economy in lifetime earnings and reduced remediation, yet we continue to treat basic care like a luxury we can\u2019t afford.\n\n[Personal Connection]\n\nThe childcare industry is currently at a breaking point. Between 2024 and 2026, 104 childcare centers closed their doors, contributing to a massive shortage of 70,000 slots that leaves parents of infants and toddlers with nowhere to turn [2]. This isn't just a family crisis; it's an economic one. We are watching centers disappear while other states are actively moving to cap family copayments at 7% of income and using grants to ensure underserved populations aren't left behind [1].\n\nWe shouldn't have to look at other states with envy for something as fundamental as the ability to go to work knowing our children are safe and cared for. I am asking you to take immediate action to stabilize our childcare infrastructure. Specifically, I urge you to support measures that cap family childcare costs at 7% of household income and provide the direct state assistance necessary to prevent further center closures [1][2]. \n\nPlease stop leaving our families behind while the rest of the country proves that a better system is possible.\n\n[Name]",
		preview: "It is exhausting to watch a proven solution succeed in one part of the country while families in our own communities are left to solve an impossible math problem. We know that every dollar invested in",
		sources: [
			{
				num: 1,
				url: "https://leg.colorado.gov/bills/hb26-1260",
				type: "legal",
				title: "HB26-1260 Updates to Child Care Assistance Programs"
			},
			{
				num: 2,
				url: "https://tsscolorado.com/childcare-industry-at-crossroads-seek-state-help-or-ask-it-to-back-off/",
				type: "journalism",
				title: "Childcare industry at 'crossroads': Seek state help or ask it to back off?"
			}
		],
		research_log: [
			"Colorado Universal Preschool program impact report 2024 2025",
			"Colorado childcare cost crisis 2025 2026 legislation",
			"HB26-1260 Updates to Child Care Assistance Programs Colorado",
			"Common Sense Institute Colorado childcare cost report 2025",
			"Colorado Department of Early Childhood UPK savings for families 2026"
		],
		recipient_config: {
			reach: "district-based",
			chambers: ["house", "senate"],
			cwcRouting: true
		},
		delivery_config: {
			timing: "immediate",
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: "childcare",
			urgency: "high",
			policy_area: "Education"
		},
		metrics: {
			sent: 0,
			views: 1,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 435,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-1",
		createdAt: "2026-02-25T22:45:47.976Z"
	},
	{
		id: "cmm2mlyxc001zw923isjesvfn",
		title: "Keeping Families Whole Costs Less Than Prison Cells",
		slug: "oregon-treatment-over-prison",
		description: "We demand that Oregon prioritize funding for drug treatment courts because they protect our families and outperform incarceration in every metric.",
		category: "Criminal Justice",
		topics: ["justice reform", "drug treatment", "family stability", "oregon"],
		type: "advocacy",
		deliveryMethod: "cwc",
		country_code: "US",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "It is frustrating to watch our state choose the most expensive way to get the worst results. We are currently paying more to tear families apart through incarceration than it would cost to keep them whole and healthy through treatment. When a person completes a treatment court program in Oregon, there is a 75% chance they won't be re-arrested within three years\u2014a success rate that traditional prison simply cannot match [4].\n\n[Personal Connection]\n\nThe data is undeniable: treatment courts save taxpayers approximately $6,000 to $7,100 per participant compared to the cost of a prison cell [4]. Beyond the fiscal common sense, these programs are proven to reduce criminal convictions by 47.3 per 1,000 people annually [3]. This isn't just policy; it\u2019s the difference between a child growing up in substitute care or staying in a stable, recovering home [6]. \n\nWith the recent introduction of SB 1583, you have a direct mechanism to formalize these pathways and fund the infrastructure for treatment over prosecution [5]. We are watching to see if you will honor the 2025-2027 budget commitment to prioritize treatment courts as our primary strategy for public safety [1]. We expect you to fully fund the Behavioral Health and Deflection Committee and expand these community-based models that outperform incarceration in every measurable metric [2][5]. Please choose the path that protects our families and our finish line.\n\n[Name]",
		preview: "It is frustrating to watch our state choose the most expensive way to get the worst results. We are currently paying more to tear families apart through incarceration than it would cost to keep them w",
		sources: [
			{
				num: 1,
				url: "https://www.oregon.gov/cjc/CJC%20Document%20Library/CJC_21300_AY27_LAB.pdf",
				type: "government",
				title: "OREGON CRIMINAL JUSTICE COMMISSION 2025-2027 LEGISLATIVELY ADOPTED BUDGET"
			},
			{
				num: 2,
				url: "https://digitalcollections.library.oregon.gov/nodes/view/313671",
				type: "government",
				title: "Oregon Recidivism Analysis December 2025"
			},
			{
				num: 3,
				url: "https://news.ohsu.edu/2025/06/10/state-behavioral-health-program-linked-to-reduced-justice-system-involvement-increased-substance-use-disorder-treatment",
				type: "research",
				title: "State behavioral health program linked to reduced justice-system involvement, increased substance use disorder treatment"
			},
			{
				num: 4,
				url: "https://lookouteugene-springfield.com/story/community-voices/2025/05/15/treatment-courts-accountability-compassion-reshape-justice/",
				type: "journalism",
				title: "Treatment court's accountability, compassion 'reshape justice'"
			},
			{
				num: 5,
				url: "https://www.billtrack50.com/billdetail/1956921",
				type: "legal",
				title: "OR SB1583 - Bill - BillTrack50"
			},
			{
				num: 6,
				url: "https://www.courts.oregon.gov/courts/wasco/programs-services/pages/familytreatmentcourt.aspx",
				type: "government",
				title: "Family Treatment Court : Programs & Services"
			}
		],
		research_log: [
			"Oregon drug treatment court cost vs incarceration 2025 2026",
			"Oregon Criminal Justice Commission recidivism analysis December 2025",
			"Oregon SB 1583 2026 session behavioral health deflection",
			"Oregon Family Treatment Court reunification success rates 2025",
			"OHSU evaluation Oregon IMPACTS program 2025 results",
			"Oregon treatment court taxpayer savings per participant 2025"
		],
		recipient_config: {
			reach: "district-based",
			chambers: ["house", "senate"],
			cwcRouting: true
		},
		delivery_config: {
			timing: "immediate",
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: "justice reform",
			urgency: "high",
			policy_area: "Criminal Justice"
		},
		metrics: {
			sent: 0,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 435,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-1",
		createdAt: "2026-02-25T22:48:50.448Z"
	},
	{
		id: "cmm2mqr4o002iw923j1wdtxq3",
		title: "Stop blocking the only homes we can actually afford",
		slug: "stop-city-housing-bans",
		description: "City Governments must stop outlawing the 3D-printed homes and community land trusts that have already proven to provide housing at a fraction of traditional costs in Portland and Austin.",
		category: "Housing",
		topics: ["housing", "zoning", "innovation", "affordability", "homelessness"],
		type: "advocacy",
		deliveryMethod: "email",
		country_code: "US",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "It is exhausting to watch my neighbors get priced out of our community while the technology to house them at a fraction of the cost is treated like a legal liability. We are told there is a housing \"crisis,\" yet we continue to outlaw the very solutions that have already proven to work. In Austin, 3D-printed homes are already providing resilient, energy-efficient housing for families earning up to 80% of the Area Median Income [1].\n\n[Personal Connection]\n\nWe are choosing displacement by maintaining outdated barriers. Community land trusts have shown they can keep housing prices 25% to 30% below market value by separating land ownership from the home itself [2]. The technology isn't the problem\u2014the bureaucracy is. While 3D printing can build homes 20 times faster and 30% cheaper than traditional methods, the primary boundary to scaling this is an unclear legal framework and inconsistent local building codes [3].\n\nI am asking you to stop blocking the only homes we can actually afford. Please take immediate action to modernize our building codes to allow for 3D-printed construction and provide the legal clarity needed to scale community land trusts. We don't need more studies; we need you to remove the regulatory barriers that are keeping our neighbors on the street.\n\n[Name]",
		preview: "It is exhausting to watch my neighbors get priced out of our community while the technology to house them at a fraction of the cost is treated like a legal liability. We are told there is a housing \"c",
		sources: [
			{
				num: 1,
				url: "https://www.iconbuild.com/",
				type: "other",
				title: "3D-printed Homes at Mueller in Austin - ICON"
			},
			{
				num: 2,
				url: "https://www.austinweeklynews.com/2025/02/27/act-pushes-for-community-land-trust/",
				type: "journalism",
				title: "ACT pushes for community land trust - Austin Weekly News"
			},
			{
				num: 3,
				url: "https://reason.org/commentary/3d-printed-homes-advancements-in-technology-and-remaining-challenges/",
				type: "research",
				title: "3D-printed homes: Advancements in technology and remaining challenges"
			}
		],
		research_log: [
			"3D printed homes zoning challenges Portland Austin 2026",
			"Portland Affordable Housing Opportunities Project 2026",
			"Austin Community Land Trust ACT success 2025",
			"legal barriers to 3D printed housing 2025 research",
			"Proud Ground Portland community land trust impact data 2024",
			"ICON 3D printed homes Austin Mueller affordability 2025"
		],
		recipient_config: {
			reach: "location-specific",
			emails: [
				"Councilor.Pirtle-Guiney@portlandoregon.gov",
				"Shuly.R.Wasserstrom@portlandoregon.gov",
				"Shuly.R.Wasserstrom@portlandoregon.gov",
				"Shuly.R.Wasserstrom@portlandoregon.gov",
				"Councilor.Ryan@portlandoregon.gov",
				"Councilor.Koyamalane@portlandoregon.gov",
				"Rep.MarkGamba@oregonlegislature.gov",
				"Rep.JulieFahey@oregonlegislature.gov",
				"Councilor.Avalos@portlandoregon.gov"
			],
			decisionMakers: [
				{
					name: "Elana Pirtle-Guiney",
					role: "Council President",
					email: "Councilor.Pirtle-Guiney@portlandoregon.gov",
					shortName: "Pirtle-Guiney",
					organization: "Portland City Council"
				},
				{
					name: "Eric Kutch",
					role: "Director of Portland Permitting & Development",
					email: "Shuly.R.Wasserstrom@portlandoregon.gov",
					shortName: "Kutch",
					organization: "City of Portland"
				},
				{
					name: "Natalie Didion",
					role: "City of Portland Building Official",
					email: "Shuly.R.Wasserstrom@portlandoregon.gov",
					shortName: "Didion",
					organization: "City of Portland"
				},
				{
					name: "Keith Wilson",
					role: "Mayor",
					email: "Shuly.R.Wasserstrom@portlandoregon.gov",
					shortName: "Wilson",
					organization: "City of Portland"
				},
				{
					name: "Chelsea Deloney",
					role: "Executive Director",
					email: "",
					shortName: "Deloney",
					organization: "African American Alliance for Homeownership (ALT)"
				},
				{
					name: "Mike Boso",
					role: "President",
					email: "",
					shortName: "Boso",
					organization: "International Code Council (ICC)"
				},
				{
					name: "T.C. Broadnax",
					role: "City Manager",
					email: "",
					shortName: "Broadnax",
					organization: "City of Austin"
				},
				{
					name: "Bridget Grumet",
					role: "Editorial Page Editor",
					email: "",
					shortName: "Grumet",
					organization: "Austin American-Statesman"
				},
				{
					name: "Mary Davis",
					role: "Division Director Housing and Community Division",
					email: "",
					shortName: "Davis",
					organization: "City of Portland, Maine"
				},
				{
					name: "Dan Ryan",
					role: "Councilor",
					email: "Councilor.Ryan@portlandoregon.gov",
					shortName: "Ryan",
					organization: "Portland City Council"
				},
				{
					name: "Tiffany Koyama Lane",
					role: "Council Vice President",
					email: "Councilor.Koyamalane@portlandoregon.gov",
					shortName: "Lane",
					organization: "Portland City Council"
				},
				{
					name: "Mark Gamba",
					role: "Representative",
					email: "Rep.MarkGamba@oregonlegislature.gov",
					shortName: "Gamba",
					organization: "Oregon House of Representatives"
				},
				{
					name: "Julie Fahey",
					role: "Representative / Speaker of the House",
					email: "Rep.JulieFahey@oregonlegislature.gov",
					shortName: "Fahey",
					organization: "Oregon House of Representatives"
				},
				{
					name: "Candace Avalos",
					role: "Councilor",
					email: "Councilor.Avalos@portlandoregon.gov",
					shortName: "Avalos",
					organization: "Portland City Council"
				}
			]
		},
		delivery_config: {
			timing: "immediate",
			followUp: false,
			cwcEnabled: false
		},
		cwc_config: {},
		metrics: {
			sent: 0,
			views: 2,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 435,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-1",
		createdAt: "2026-02-25T22:52:33.624Z"
	},
	{
		id: "cmm2muo790032w923noll0mjn",
		title: "Stop letting concrete scars choke our neighborhoods",
		slug: "heal-dallas-rochester-syracuse",
		description: "The city leadership of Dallas, Rochester, and Syracuse must remove urban freeways and restore streams like the Cheonggyecheon in Seoul to improve air quality and community health.",
		category: "Urban Development",
		topics: ["urban-planning", "public-health", "environment", "transportation"],
		type: "advocacy",
		deliveryMethod: "cwc",
		country_code: "US",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "For too long, we have accepted urban freeways as a necessary part of our landscape, but they aren't infrastructure\u2014they are scars. These concrete barriers don't just move cars; they divide our neighborhoods, choke our air, and remind us daily of what was destroyed to build them. When cities like Seoul chose to tear down highways and restore natural streams, they didn't just see property values rise; they saw a 35% improvement in the very air their citizens breathe. We are tired of living in the shadow of a mistake that keeps our communities from healing.\n\n[Personal Connection]\n\nThe momentum for change is already here, and we are watching closely. In Rochester, the Inner Loop North Transformation Project is a vital opportunity to restore the street grid and create the community spaces we\u2019ve been denied for decades [1]. In Syracuse, the removal of the I-81 viaduct in favor of a Community Grid is a long-overdue step toward better air quality and local connectivity [2]. These projects, along with those being considered in Dallas, represent a choice between maintaining a divided past or building a healthy, connected future.\n\nI am asking you to stop treating these freeways as permanent fixtures. Please prioritize the full removal of these sunken and elevated highways and fast-track the funding and approvals necessary to turn these concrete scars back into vibrant, breathable neighborhoods. We deserve a city designed for people, not just for the cars passing through it.\n\n[Name]",
		preview: "For too long, we have accepted urban freeways as a necessary part of our landscape, but they aren't infrastructure\u2014they are scars. These concrete barriers don't just move cars; they divide our neighbo",
		sources: [
			{
				num: 1,
				url: "https://www.innerloopnorth.com/",
				type: "government",
				title: "Inner Loop North Transformation Project"
			},
			{
				num: 2,
				url: "https://webapps.dot.ny.gov/i-81-viaduct-project?utm_medium=301&utm_source=i81.dot.ny.gov",
				type: "government",
				title: "I-81 Viaduct Project: Community Grid Overview"
			}
		],
		research_log: [
			"Dallas I-345 removal project status 2026",
			"Rochester Inner Loop North transformation update 2026",
			"Syracuse I-81 viaduct project progress 2026",
			"Cheonggyecheon stream restoration public health benefits study",
			"urban freeway removal air quality community health impacts 2025 2026",
			"Dallas Rochester Syracuse urban renewal highway removal official reports"
		],
		recipient_config: {
			reach: "district-based",
			chambers: ["house", "senate"],
			cwcRouting: true
		},
		delivery_config: {
			timing: "immediate",
			followUp: true,
			cwcEnabled: true
		},
		cwc_config: {
			topic: "urban-planning",
			urgency: "high",
			policy_area: "Urban Development"
		},
		metrics: {
			sent: 0,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 435,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-1",
		createdAt: "2026-02-25T22:55:36.454Z"
	},
	{
		id: "cmm2myznc003jw923gvxlx6qy",
		title: "Stop letting our national parks rot from within",
		slug: "parks-canada-neglected-lands",
		description: "Parks Canada must address the massive maintenance backlog for the public lands that generate far more revenue than they receive in funding.",
		category: "Environment",
		topics: ["environment", "infrastructure", "public lands", "tourism"],
		type: "advocacy",
		deliveryMethod: "email",
		country_code: "CA",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "It is incredibly frustrating to stand in one of our National Parks\u2014places that define our national identity\u2014and see them literally rotting from within. We are watching a $3.6 billion maintenance backlog pile up while the very agency responsible for these lands faces a $450 million reduction in funding and lapsed investment over the next two years [1]. It feels less like a budget decision and more like a betrayal of common sense to starve a system that actually works.\n\n[Personal Connection]\n\nOur national parks generate $3.3 billion in visitor spending on a budget of just $900 million. That is a 3.6x return on investment. It is a rare case where investing in the public good literally pays for itself. Yet, by allowing these cuts to proceed, we are choosing to let trails crumble, facilities decay, and the economic engine of our tourism industry stall. We are watching a national treasure be treated as a liability rather than the asset it is.\n\nI am asking you to immediately reverse the $450 million in funding cuts and lapsed investments [1] and establish a dedicated, transparent plan to clear the maintenance backlog. Our parks have already proven their value; it is time the federal government showed it values them in return.\n\n[Name]",
		preview: "It is incredibly frustrating to stand in one of our National Parks\u2014places that define our national identity\u2014and see them literally rotting from within. We are watching a $3.6 billion maintenance backl",
		sources: [
			{
				num: 1,
				url: "https://ontarionature.org/news-release/parks-canada-funding-cuts/",
				type: "advocacy",
				title: "Parks Canada Funding Cuts - Media Statement"
			}
		],
		research_log: [
			"Parks Canada 2025 to 2026 Departmental Plan maintenance backlog",
			"Parks Canada quarterly financial report September 2025",
			"2025 Report of the Commissioner of the Environment and Sustainable Development Parks Canada",
			"Parks Canada budget cuts 450 million 2025",
			"Parks Canada GDP contribution 5 billion 2025",
			"Parks Canada 2024-25 Departmental Results Report infrastructure"
		],
		recipient_config: {
			reach: "location-specific",
			emails: [
				"julie.dabrusin@parl.gc.ca",
				"francois-philippe.champagne@parl.gc.ca",
				"mohammad.kamal@tbs-sct.gc.ca",
				"sonia.ianni-lucio@oag-bvg.gc.ca",
				"contact@tiac-aitc.ca",
				"info@cpaws.org",
				"secretaryofstate-secretairedetat@fin.gc.ca",
				"info@cpaws.org",
				"contact@tiac-aitc.ca"
			],
			decisionMakers: [
				{
					name: "Julie Aviva Dabrusin",
					role: "Minister of Environment, Climate Change and Nature",
					email: "julie.dabrusin@parl.gc.ca",
					shortName: "Dabrusin",
					organization: "Environment and Climate Change Canada"
				},
				{
					name: "Ron Hallman",
					role: "President and CEO",
					email: "",
					shortName: "Hallman",
					organization: "Parks Canada Agency"
				},
				{
					name: "Fran\u00e7ois-Philippe Champagne",
					role: "Minister of Finance & National Revenue",
					email: "francois-philippe.champagne@parl.gc.ca",
					shortName: "Champagne",
					organization: "Department of Finance Canada"
				},
				{
					name: "Shafqat Ali",
					role: "President of the Treasury Board",
					email: "mohammad.kamal@tbs-sct.gc.ca",
					shortName: "Ali",
					organization: "Treasury Board of Canada Secretariat"
				},
				{
					name: "Angelo Iacono",
					role: "Chair",
					email: "",
					shortName: "Iacono",
					organization: "House of Commons Standing Committee on Environment and Sustainable Development (ENVI)"
				},
				{
					name: "Karen Hogan",
					role: "Auditor General of Canada",
					email: "sonia.ianni-lucio@oag-bvg.gc.ca",
					shortName: "Hogan",
					organization: "Office of the Auditor General of Canada"
				},
				{
					name: "Sebastien Benedict",
					role: "President & CEO",
					email: "contact@tiac-aitc.ca",
					shortName: "Benedict",
					organization: "Tourism Industry Association of Canada (TIAC)"
				},
				{
					name: "Sharon DeSousa",
					role: "National President",
					email: "",
					shortName: "DeSousa",
					organization: "Public Service Alliance of Canada (PSAC)"
				},
				{
					name: "Sandra Schwartz",
					role: "National Executive Director",
					email: "info@cpaws.org",
					shortName: "Schwartz",
					organization: "Canadian Parks and Wilderness Society (CPAWS)"
				},
				{
					name: "Wayne Long",
					role: "Secretary of State (Canada Revenue Agency and Financial Institutions)",
					email: "secretaryofstate-secretairedetat@fin.gc.ca",
					shortName: "Long",
					organization: "Department of Finance Canada"
				},
				{
					name: "Chris Rider",
					role: "National Director, Conservation",
					email: "info@cpaws.org",
					shortName: "Rider",
					organization: "Canadian Parks and Wilderness Society (CPAWS)"
				},
				{
					name: "Amy Butcher",
					role: "Vice-President, Public Affairs",
					email: "contact@tiac-aitc.ca",
					shortName: "Butcher",
					organization: "Tourism Industry Association of Canada (TIAC)"
				}
			]
		},
		delivery_config: {
			timing: "immediate",
			followUp: false,
			cwcEnabled: false
		},
		cwc_config: {},
		metrics: {
			sent: 0,
			views: 1,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 338,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-2",
		createdAt: "2026-02-25T22:58:57.913Z"
	},
	{
		id: "cmm2ne3kw004gw923dbbmxz01",
		title: "Our library cards are the only degrees we need",
		slug: "ontario-libraries-over-debt",
		description: "The Government of Ontario must expand the free coding bootcamps run by Ontario public libraries to every community across the province.",
		category: "Education",
		topics: ["education", "libraries", "employment", "technology"],
		type: "advocacy",
		deliveryMethod: "email",
		country_code: "CA",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "There is something revolutionary about a library card being the only credential you need to change your life. While traditional tech education often comes with a mountain of debt or a restrictive waitlist, Ontario\u2019s public libraries have proven there is a better way: since 2022, library-led coding bootcamps have placed 2,400 people into tech jobs with no tuition and no barriers.\n\n[Personal Connection]\n\nThis isn't just about learning to code; it\u2019s about economic survival and dignity. Research shows that library technology services are vital for career development, particularly for those in Northern communities and equity-deserving groups who are often left behind by the digital economy [1]. Your own ministry plans prioritize connecting job seekers with the 'jobs of the future' [3], and there is no more efficient or trusted infrastructure to deliver that training than our local libraries.\n\nWe are watching a proven model succeed in pockets of the province while other communities wait. To ensure every Ontarian has a fair shot at a tech career, I am asking you to:\n\n1. Fully fund the creation of an Ontario Digital Public Library to provide universal access to high-quality digital resources for all residents [2].\n2. Increase provincial operating funding specifically to scale library-led career training and coding bootcamps province-wide [2].\n\nWe don't need more pilot programs; we need a commitment to the infrastructure that is already working. A library card should be the only degree a motivated person needs to get to work.\n\n[Name]",
		preview: "There is something revolutionary about a library card being the only credential you need to change your life. While traditional tech education often comes with a mountain of debt or a restrictive wait",
		sources: [
			{
				num: 1,
				url: "https://fopl.ca/news/bridge-2023-2024-report-impact-of-technology-services-in-ontario-public-libraries/",
				type: "research",
				title: "Bridge 2023-2024 Report: Impact of Technology Services in Ontario Public Libraries"
			},
			{
				num: 2,
				url: "https://accessola.com/budget-and-funding-announcements/",
				type: "advocacy",
				title: "2026 Ontario Pre-Budget Submissions: Public Libraries"
			},
			{
				num: 3,
				url: "https://www.ontario.ca/page/published-plans-and-annual-reports-2025-2026-ministry-labour-immigration-training-and-skills-development",
				type: "government",
				title: "Published plans and annual reports 2025\u20132026: Ministry of Labour, Immigration, Training and Skills Development"
			}
		],
		research_log: [
			"Ontario public libraries free coding bootcamps government funding 2026",
			"Ontario Ministry of Labour Immigration Training and Skills Development library programs 2025 2026",
			"Ontario Library Association advocacy digital literacy coding bootcamps 2026",
			"impact of library coding programs on employment Ontario research 2025",
			"Toronto Public Library digital innovation hubs expansion 2026 news"
		],
		recipient_config: {
			reach: "location-specific",
			emails: [
				"info@accessola.com",
				"chair@obcm.ca",
				"citylibrarian@tpl.ca",
				"stillrogers@tpl.ca",
				"michelle@obcm.ca",
				"info@accessola.com",
				"mtutton@tpl.ca",
				"info@accessola.com"
			],
			decisionMakers: [
				{
					name: "Stan Cho",
					role: "Minister of Tourism, Culture and Gaming",
					email: "",
					shortName: "Cho",
					organization: "Ministry of Tourism, Culture and Gaming, Ontario"
				},
				{
					name: "David Piccini",
					role: "Minister of Labour, Immigration, Training and Skills Development",
					email: "",
					shortName: "Piccini",
					organization: "Ministry of Labour, Immigration, Training and Skills Development, Ontario"
				},
				{
					name: "Peter Bethlenfalvy",
					role: "Minister of Finance",
					email: "",
					shortName: "Bethlenfalvy",
					organization: "Ministry of Finance, Ontario"
				},
				{
					name: "Dina Stevens",
					role: "Executive Director",
					email: "",
					shortName: "Stevens",
					organization: "Federation of Ontario Public Libraries (FOPL)"
				},
				{
					name: "Lita Barrie",
					role: "OLA President 2026",
					email: "info@accessola.com",
					shortName: "Barrie",
					organization: "Ontario Library Association (OLA)"
				},
				{
					name: "Marianne Meed Ward",
					role: "Chair",
					email: "chair@obcm.ca",
					shortName: "Ward",
					organization: "Ontario Big City Mayors (OBCM)"
				},
				{
					name: "Moe Hosseini-Ara",
					role: "City Librarian & CEO",
					email: "citylibrarian@tpl.ca",
					shortName: "Hosseini-Ara",
					organization: "Toronto Public Library"
				},
				{
					name: "Grace Lee Reynolds",
					role: "CEO",
					email: "",
					shortName: "Reynolds",
					organization: "MaRS Discovery District"
				},
				{
					name: "Peggy Sattler",
					role: "Opposition Critic for Colleges and Universities",
					email: "",
					shortName: "Sattler",
					organization: "Legislative Assembly of Ontario"
				},
				{
					name: "Bruce Campion-Smith",
					role: "Head of Editorial Board",
					email: "",
					shortName: "Campion-Smith",
					organization: "The Toronto Star"
				},
				{
					name: "Steve Till-Rogers",
					role: "Director, Digital Strategy & Chief Information Officer",
					email: "stillrogers@tpl.ca",
					shortName: "Till-Rogers",
					organization: "Toronto Public Library"
				},
				{
					name: "Michelle Baker",
					role: "Executive Director",
					email: "michelle@obcm.ca",
					shortName: "Baker",
					organization: "Ontario Big City Mayors (OBCM)"
				},
				{
					name: "Michelle Arbuckle",
					role: "Executive Director",
					email: "info@accessola.com",
					shortName: "Arbuckle",
					organization: "Ontario Library Association (OLA)"
				},
				{
					name: "Michael Tutton",
					role: "Senior Manager, Digital Experiences",
					email: "mtutton@tpl.ca",
					shortName: "Tutton",
					organization: "Toronto Public Library"
				},
				{
					name: "Ashley Prince",
					role: "Past President, OLITA",
					email: "info@accessola.com",
					shortName: "Prince",
					organization: "Ontario Library and Information Technology Association"
				}
			]
		},
		delivery_config: {
			timing: "immediate",
			followUp: false,
			cwcEnabled: false
		},
		cwc_config: {},
		metrics: {
			sent: 0,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 338,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-2",
		createdAt: "2026-02-25T23:10:42.848Z"
	},
	{
		id: "cmm2ni07b004zw923hv12u48x",
		title: "We power the province while you keep the wealth",
		slug: "bc-energy-revenue-gap",
		description: "British Columbia must restructure resource revenue sharing so that First Nations communities receive returns that reflect their dominant role in generating the province's clean energy.",
		category: "Indigenous Rights",
		topics: ["indigenous rights", "clean energy", "british columbia", "revenue sharing", "reconciliation"],
		type: "advocacy",
		deliveryMethod: "email",
		country_code: "CA",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "It is impossible to ignore the math of our province\u2019s energy future. First Nations are currently responsible for generating 40% of British Columbia\u2019s clean energy, yet they receive a mere 3% of the resource extraction revenue from their own territories. This isn't just a policy gap; it\u2019s a fundamental violation of the promise of reconciliation. If that word is going to mean anything in this province, the revenue sharing must finally match the contribution.\n\n[Personal Connection]\n\nResearch from the University of Victoria confirms that while First Nations are positioning themselves as dominant leaders in the clean energy sector, they continue to face structural economic barriers that prevent true energy sovereignty [1]. We are watching the province grow and decarbonize on the back of Indigenous leadership while the wealth generated by that leadership is siphoned away from the communities doing the work.\n\nI am asking you to immediately restructure resource revenue sharing models to ensure First Nations receive returns that reflect their actual role as the primary drivers of BC\u2019s clean energy grid. We don't need more statements on reconciliation; we need a fiscal framework that recognizes Indigenous sovereignty as an economic reality.\n\n[Name]",
		preview: "It is impossible to ignore the math of our province\u2019s energy future. First Nations are currently responsible for generating 40% of British Columbia\u2019s clean energy, yet they receive a mere 3% of the re",
		sources: [
			{
				num: 1,
				url: "https://dspace.library.uvic.ca/items/ac4d0b67-1dd9-4691-8031-37f818649cad",
				type: "research",
				title: "Indigenous Energy Sovereignty and the Clean Energy Transition in British Columbia"
			}
		],
		research_log: [
			"BC government resource revenue sharing First Nations February 2026",
			"BC Hydro Call for Power Indigenous equity ownership 2025 2026",
			"First Nations Clean Energy Business Fund BC 2026 updates",
			"Indigenous clean energy revenue sharing British Columbia legislation 2025",
			"BC First Nations Energy and Mining Council clean energy report 2025"
		],
		recipient_config: {
			reach: "location-specific",
			emails: [
				"premier@gov.bc.ca",
				"premier@gov.bc.ca",
				"Josie.Osborne.mla@leg.bc.ca",
				"premier@gov.bc.ca",
				"charlotte.mitha@bchydro.com",
				"premier@gov.bc.ca",
				"premier@gov.bc.ca",
				"premier@gov.bc.ca",
				"premier@gov.bc.ca"
			],
			decisionMakers: [
				{
					name: "David Eby",
					role: "Premier",
					email: "premier@gov.bc.ca",
					shortName: "Eby",
					organization: "Government of British Columbia"
				},
				{
					name: "Christine Boyle",
					role: "Minister of Indigenous Relations and Reconciliation",
					email: "premier@gov.bc.ca",
					shortName: "Boyle",
					organization: "Ministry of Indigenous Relations and Reconciliation, British Columbia"
				},
				{
					name: "Josie Osborne",
					role: "Minister of Health",
					email: "Josie.Osborne.mla@leg.bc.ca",
					shortName: "Osborne",
					organization: "Government of British Columbia"
				},
				{
					name: "Brenda Bailey",
					role: "Minister of Finance",
					email: "premier@gov.bc.ca",
					shortName: "Bailey",
					organization: "Ministry of Finance, British Columbia"
				},
				{
					name: "Charlotte Mitha",
					role: "President & CEO",
					email: "charlotte.mitha@bchydro.com",
					shortName: "Mitha",
					organization: "BC Hydro"
				},
				{
					name: "Terry Teegee",
					role: "Regional Chief",
					email: "",
					shortName: "Teegee",
					organization: "British Columbia Assembly of First Nations"
				},
				{
					name: "Stewart Phillip",
					role: "President",
					email: "",
					shortName: "Phillip",
					organization: "Union of BC Indian Chiefs"
				},
				{
					name: "Rebecca Alty",
					role: "Minister of Crown-Indigenous Relations",
					email: "",
					shortName: "Alty",
					organization: "Crown-Indigenous Relations and Northern Affairs Canada"
				},
				{
					name: "Jim Rutkowski",
					role: "Chief of Staff",
					email: "premier@gov.bc.ca",
					shortName: "Rutkowski",
					organization: "Office of the Premier of British Columbia"
				},
				{
					name: "Aileen Machell",
					role: "Deputy Chief of Staff",
					email: "premier@gov.bc.ca",
					shortName: "Machell",
					organization: "Office of the Premier of British Columbia"
				},
				{
					name: "Marilyn Slett",
					role: "Secretary-Treasurer",
					email: "",
					shortName: "Slett",
					organization: "Union of BC Indian Chiefs"
				},
				{
					name: "Linda Innes",
					role: "Vice-President",
					email: "",
					shortName: "Innes",
					organization: "Union of BC Indian Chiefs"
				},
				{
					name: "Kate Van Meer-Mass",
					role: "Executive Director",
					email: "premier@gov.bc.ca",
					shortName: "Meer-Mass",
					organization: "Office of the Premier of British Columbia"
				},
				{
					name: "Jimmy Smith",
					role: "Deputy Director of Communications",
					email: "premier@gov.bc.ca",
					shortName: "Smith",
					organization: "Office of the Premier of British Columbia"
				}
			]
		},
		delivery_config: {
			timing: "immediate",
			followUp: false,
			cwcEnabled: false
		},
		cwc_config: {},
		metrics: {
			sent: 0,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 338,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-2",
		createdAt: "2026-02-25T23:13:45.096Z"
	},
	{
		id: "cmm2nl4lp005dw9232o1aqznw",
		title: "BIXI clears Montreal air for less than a coffee",
		slug: "bixi-montreal-clean-air",
		description: "The City of Montreal must continue prioritizing the BIXI program as a vital public health necessity that saves more than it costs.",
		category: "Transportation",
		topics: ["transit", "health", "environment", "montreal"],
		type: "advocacy",
		deliveryMethod: "email",
		country_code: "CA",
		status: "published",
		is_public: true,
		verification_status: "approved",
		message_body: "There is a specific kind of relief in breathing air that doesn\u2019t taste like traffic. We often talk about BIXI as a transit convenience, but for those of us navigating Montreal every day, it is the difference between a city that feels suffocated by exhaust and one where we can actually move and breathe.\n\n[Personal Connection]\n\nThe reality is that BIXI is a public health miracle hiding in plain sight. By cutting downtown car trips by 12%, it saves our healthcare system $14 million every year by reducing the pollution that makes us sick. It is staggering that a program with this much impact costs the city only $5 per resident annually\u2014less than the price of a single cup of coffee. To treat this as a discretionary expense rather than a vital health utility is a failure of logic and a direct risk to our collective well-being.\n\nI am asking you to stop viewing BIXI as a seasonal amenity and start prioritizing it as the essential infrastructure it has become. We need a long-term commitment to the expansion and financial stability of the BIXI network to ensure Montreal remains a leader in both sustainable mobility and public health.\n\n[Name]",
		preview: "There is a specific kind of relief in breathing air that doesn\u2019t taste like traffic. We often talk about BIXI as a transit convenience, but for those of us navigating Montreal every day, it is the dif",
		sources: [],
		research_log: [
			"BIXI Montreal 2026 expansion budget and public health",
			"Montreal BIXI environmental impact report 2025 2026",
			"Ville de Montr\u00e9al active transport investment 2026",
			"health benefits and cost savings of bike sharing Montreal research",
			"BIXI Montreal annual report 2024 2025 ridership data"
		],
		recipient_config: {
			reach: "location-specific",
			emails: [
				"info@ensemblemtl.org",
				"webmestre@montreal.ca",
				"ministre@transports.gouv.qc.ca",
				"commissions@montreal.ca",
				"commissions@montreal.ca",
				"serviceclient@velo.qc.ca",
				"webmestre@montreal.ca"
			],
			decisionMakers: [
				{
					name: "Soraya Martinez Ferrada",
					role: "Mayor of Montr\u00e9al",
					email: "info@ensemblemtl.org",
					shortName: "Ferrada",
					organization: "City of Montr\u00e9al"
				},
				{
					name: "Alan DeSousa",
					role: "Executive Committee Member responsible for Mobility and Infrastructure",
					email: "webmestre@montreal.ca",
					shortName: "DeSousa",
					organization: "City of Montr\u00e9al"
				},
				{
					name: "Roger Plamondon",
					role: "Chairman & CEO",
					email: "",
					shortName: "Plamondon",
					organization: "BIXI Montr\u00e9al"
				},
				{
					name: "Jonatan Julien",
					role: "Minister of Transport and Sustainable Mobility",
					email: "ministre@transports.gouv.qc.ca",
					shortName: "Julien",
					organization: "Government of Quebec"
				},
				{
					name: "Richard Deschamps",
					role: "Chair, Finance and Administration Commission",
					email: "commissions@montreal.ca",
					shortName: "Deschamps",
					organization: "City of Montr\u00e9al"
				},
				{
					name: "Aref Salem",
					role: "President of the Board of Directors",
					email: "commissions@montreal.ca",
					shortName: "Salem",
					organization: "Soci\u00e9t\u00e9 de transport de Montr\u00e9al (STM)"
				},
				{
					name: "Joelle Sevigny",
					role: "General Manager",
					email: "serviceclient@velo.qc.ca",
					shortName: "Sevigny",
					organization: "V\u00e9lo Qu\u00e9bec"
				},
				{
					name: "Gabrielle Rousseau-B\u00e9langer",
					role: "Executive Committee Member responsible for the Environment",
					email: "webmestre@montreal.ca",
					shortName: "Rousseau-B\u00e9langer",
					organization: "City of Montr\u00e9al"
				},
				{
					name: "Walter Buchignani",
					role: "Comment Editor",
					email: "",
					shortName: "Buchignani",
					organization: "Montreal Gazette"
				}
			]
		},
		delivery_config: {
			timing: "immediate",
			followUp: false,
			cwcEnabled: false
		},
		cwc_config: {},
		metrics: {
			sent: 0,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 338,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: true,
		userId: "user-seed-2",
		createdAt: "2026-02-25T23:16:10.764Z"
	},
	{
		id: "cmm2np0cf005xw923ryqxwmp8",
		title: "Fifteen minutes of your interest or our whole year",
		slug: "apple-interest-vs-labor",
		description: "Apple must rectify a pay structure that values minutes of its daily interest income over the entire annual labor of a retail worker.",
		category: "Labor Rights",
		topics: ["labor", "wages", "inequality", "retail"],
		type: "advocacy",
		deliveryMethod: "email",
		country_code: "US",
		status: "draft",
		is_public: false,
		verification_status: "pending",
		message_body: "There is a profound indignity in the fact that fifteen minutes of interest on Apple\u2019s cash reserves generates enough wealth to cover a retail worker\u2019s entire annual salary. While a human being spends 2,000 hours a year on their feet, representing your brand and solving customer problems, the company\u2019s capital earns their total yearly value before the first coffee break of the day is over.\n\n[Personal Connection]\n\nThis isn't a matter of scarcity; it is a matter of priority. Apple reported a net income of $112.01 billion for the 2025 fiscal year and maintains a massive liquidity position of $132.4 billion in cash and marketable securities [1]. Despite this historic accumulation of wealth, the gap between leadership and the workforce remains staggering, with median worker pay at low-wage corporations averaging just $35,570\u2014a fraction of the $17.2 million average CEO compensation [2]. \n\nWhen fifteen minutes of passive interest outweighs a human being's entire year of labor, the value assigned to work has become completely decoupled from reality. For the people who walk into your stores every day to build your success, this math feels like a violation.\n\nI am asking you to use Apple\u2019s significant financial strength to fundamentally restructure retail compensation. We are calling for a base wage that reflects the actual value of human labor in the world\u2019s most successful company, ensuring that no employee\u2019s entire year of life is worth less than fifteen minutes of your bank account\u2019s time.\n\n[Name]",
		preview: "There is a profound indignity in the fact that fifteen minutes of interest on Apple\u2019s cash reserves generates enough wealth to cover a retail worker\u2019s entire annual salary. While a human being spends ",
		sources: [
			{
				num: 1,
				url: "https://www.sec.gov/ix?doc=/Archives/edgar/data/320193/000032019325000106/aapl-20250927.htm",
				type: "government",
				title: "Apple Inc. SEC 10-K Report for the fiscal year ended September 27, 2025"
			},
			{
				num: 2,
				url: "https://ips-dc.org/report-executive-excess-2025/",
				type: "research",
				title: "Executive Excess 2025: CEO-Worker Pay Gaps at the 100 Largest Low-Wage Corporations"
			}
		],
		research_log: [
			"Apple Inc. SEC Form 10-K fiscal year 2025 cash and interest income",
			"Apple retail worker average annual salary February 2026",
			"Apple retail union contract ratification Towson Oklahoma City 2024 2025",
			"Economic Policy Institute low-wage worker real wage growth 2025 2026",
			"Institute for Policy Studies Executive Excess report 2025 CEO worker pay gap",
			"Apple Card Savings Account interest rate changes 2025 2026"
		],
		recipient_config: {
			reach: "location-specific",
			emails: [
				"tcook@apple.com",
				"investor_relations@apple.com",
				"shareholderproposal@apple.com",
				"investor_relations@apple.com",
				"investor_relations@apple.com",
				"shareholderproposal@apple.com"
			],
			decisionMakers: [
				{
					name: "Tim Cook",
					role: "CEO",
					email: "tcook@apple.com",
					shortName: "Cook",
					organization: "Apple Inc."
				},
				{
					name: "Deirdre O'Brien",
					role: "SVP, Retail + People",
					email: "investor_relations@apple.com",
					shortName: "O'Brien",
					organization: "Apple Inc."
				},
				{
					name: "Andrea Jung",
					role: "Chair, People and Compensation Committee",
					email: "shareholderproposal@apple.com",
					shortName: "Jung",
					organization: "Apple Inc."
				},
				{
					name: "Stephen Gilmore",
					role: "Chief Investment Officer",
					email: "",
					shortName: "Gilmore",
					organization: "CalPERS"
				},
				{
					name: "Claude Cummings Jr.",
					role: "President",
					email: "",
					shortName: "Jr.",
					organization: "Communications Workers of America"
				},
				{
					name: "Lori Chavez-DeRemer",
					role: "U.S. Secretary of Labor",
					email: "",
					shortName: "Chavez-DeRemer",
					organization: "U.S. Department of Labor"
				},
				{
					name: "Bill Cassidy",
					role: "Chair, Senate HELP Committee",
					email: "",
					shortName: "Cassidy",
					organization: "U.S. Senate"
				},
				{
					name: "Lilia Garcia-Brower",
					role: "Labor Commissioner",
					email: "",
					shortName: "Garcia-Brower",
					organization: "California Department of Industrial Relations"
				},
				{
					name: "Gary Retelny",
					role: "President and CEO",
					email: "",
					shortName: "Retelny",
					organization: "Institutional Shareholder Services"
				},
				{
					name: "Binyamin Appelbaum",
					role: "Editorial Board Member",
					email: "",
					shortName: "Appelbaum",
					organization: "The New York Times"
				},
				{
					name: "Arthur D. Levinson",
					role: "Chair of the Board",
					email: "investor_relations@apple.com",
					shortName: "Levinson",
					organization: "Apple Inc."
				},
				{
					name: "Kevan Parekh",
					role: "SVP and Chief Financial Officer",
					email: "investor_relations@apple.com",
					shortName: "Parekh",
					organization: "Apple Inc."
				},
				{
					name: "Alex Gorsky",
					role: "Board Member, People and Compensation Committee",
					email: "shareholderproposal@apple.com",
					shortName: "Gorsky",
					organization: "Apple Inc."
				},
				{
					name: "Marcie Frost",
					role: "Chief Executive Officer",
					email: "",
					shortName: "Frost",
					organization: "CalPERS"
				},
				{
					name: "Jennifer Osborn",
					role: "Director",
					email: "",
					shortName: "Osborn",
					organization: "California Department of Industrial Relations"
				}
			]
		},
		delivery_config: {
			timing: "immediate",
			followUp: false,
			cwcEnabled: false
		},
		cwc_config: {},
		metrics: {
			sent: 0,
			opened: 0,
			clicked: 0,
			responded: 0,
			total_districts: 435,
			districts_covered: 0,
			district_coverage_percent: 0
		},
		consensus_approved: false,
		userId: "user-seed-1",
		createdAt: "2026-02-25T23:19:11.870Z"
	},
];

// ============================================================================
// SEED DATA -- Template Scopes
// ============================================================================

const SCOPES = [
	{
		id: "cmm2m8zux000jw9239s4e34me",
		template_id: "cmm2m8z6j000hw923kxy583db",
		country_code: "US",
		region_code: null,
		locality_code: null,
		district_code: null,
		display_text: "nationwide",
		scope_level: "country",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T22:38:45.129Z",
		updated_at: "2026-02-25T22:38:45.129Z"
	},
	{
		id: "cmm2md5j80011w923on076mp5",
		template_id: "cmm2md4rd000zw923wi66rmse",
		country_code: "US",
		region_code: null,
		locality_code: null,
		district_code: null,
		display_text: "nationwide",
		scope_level: "country",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T22:41:59.109Z",
		updated_at: "2026-02-25T22:41:59.109Z"
	},
	{
		id: "cmm2mi2qd001jw9231aslo072",
		template_id: "cmm2mi24n001hw9232anvl55b",
		country_code: "US",
		region_code: null,
		locality_code: null,
		district_code: null,
		display_text: "nationwide",
		scope_level: "country",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T22:45:48.757Z",
		updated_at: "2026-02-25T22:45:48.757Z"
	},
	{
		id: "cmm2mlzlr0021w9237z6swpnx",
		template_id: "cmm2mlyxc001zw923isjesvfn",
		country_code: "US",
		region_code: "US-OR",
		locality_code: null,
		district_code: null,
		display_text: "subnational",
		scope_level: "region",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T22:48:51.328Z",
		updated_at: "2026-02-25T22:48:51.328Z"
	},
	{
		id: "cmm2mqrup002kw923cdryka4w",
		template_id: "cmm2mqr4o002iw923j1wdtxq3",
		country_code: "US",
		region_code: "US-OR",
		locality_code: "Portland",
		district_code: null,
		display_text: "subnational",
		scope_level: "locality",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T22:52:34.562Z",
		updated_at: "2026-02-25T22:52:34.562Z"
	},
	{
		id: "cmm2mup810034w9232ckygv24",
		template_id: "cmm2muo790032w923noll0mjn",
		country_code: "US",
		region_code: null,
		locality_code: null,
		district_code: null,
		display_text: "nationwide",
		scope_level: "country",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T22:55:37.777Z",
		updated_at: "2026-02-25T22:55:37.777Z"
	},
	{
		id: "cmm2mz0by003lw923eo6ve4x8",
		template_id: "cmm2myznc003jw923gvxlx6qy",
		country_code: "CA",
		region_code: null,
		locality_code: null,
		district_code: null,
		display_text: "nationwide",
		scope_level: "country",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T22:58:58.799Z",
		updated_at: "2026-02-25T22:58:58.799Z"
	},
	{
		id: "cmm2ne49x004iw92350oa5n3w",
		template_id: "cmm2ne3kw004gw923dbbmxz01",
		country_code: "CA",
		region_code: "CA-ON",
		locality_code: null,
		district_code: null,
		display_text: "subnational",
		scope_level: "region",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T23:10:43.749Z",
		updated_at: "2026-02-25T23:10:43.749Z"
	},
	{
		id: "cmm2ni0y10051w923ydebpxbz",
		template_id: "cmm2ni07b004zw923hv12u48x",
		country_code: "CA",
		region_code: "BC",
		locality_code: null,
		district_code: null,
		display_text: "subnational",
		scope_level: "region",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T23:13:46.058Z",
		updated_at: "2026-02-25T23:13:46.058Z"
	},
	{
		id: "cmm2nl56z005fw923m6n1yo3g",
		template_id: "cmm2nl4lp005dw9232o1aqznw",
		country_code: "CA",
		region_code: "CA-QC",
		locality_code: "Montreal",
		district_code: null,
		display_text: "subnational",
		scope_level: "locality",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T23:16:11.531Z",
		updated_at: "2026-02-25T23:16:11.531Z"
	},
	{
		id: "cmm2np12k005zw923n0sjqq6r",
		template_id: "cmm2np0cf005xw923ryqxwmp8",
		country_code: "US",
		region_code: null,
		locality_code: null,
		district_code: null,
		display_text: "nationwide",
		scope_level: "country",
		power_structure_type: null,
		audience_filter: null,
		scope_notes: null,
		confidence: 1,
		extraction_method: "gemini_inline",
		validated_against: null,
		estimated_reach: null,
		latitude: null,
		longitude: null,
		created_at: "2026-02-25T23:19:12.813Z",
		updated_at: "2026-02-25T23:19:12.813Z"
	},
];

// ============================================================================
// SEED DATA -- Template Jurisdictions
// ============================================================================

const JURISDICTIONS = [
	{
		id: "cmm2m907b000lw923ibdcdad4",
		template_id: "cmm2m8z6j000hw923kxy583db",
		jurisdiction_type: "federal",
		congressional_district: null,
		senate_class: null,
		state_code: null,
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T22:38:45.575Z",
		updated_at: "2026-02-25T22:38:45.575Z"
	},
	{
		id: "cmm2md5yb0013w923dk8o54kn",
		template_id: "cmm2md4rd000zw923wi66rmse",
		jurisdiction_type: "federal",
		congressional_district: null,
		senate_class: null,
		state_code: null,
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T22:41:59.651Z",
		updated_at: "2026-02-25T22:41:59.651Z"
	},
	{
		id: "cmm2mi33m001lw923wb6c6gc7",
		template_id: "cmm2mi24n001hw9232anvl55b",
		jurisdiction_type: "federal",
		congressional_district: null,
		senate_class: null,
		state_code: null,
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T22:45:49.234Z",
		updated_at: "2026-02-25T22:45:49.234Z"
	},
	{
		id: "cmm2mlzyi0023w923986z4e1r",
		template_id: "cmm2mlyxc001zw923isjesvfn",
		jurisdiction_type: "state",
		congressional_district: null,
		senate_class: null,
		state_code: "US-OR",
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T22:48:51.786Z",
		updated_at: "2026-02-25T22:48:51.786Z"
	},
	{
		id: "cmm2mqs7v002mw923mad4ghed",
		template_id: "cmm2mqr4o002iw923j1wdtxq3",
		jurisdiction_type: "federal",
		congressional_district: null,
		senate_class: null,
		state_code: "US-OR",
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T22:52:35.035Z",
		updated_at: "2026-02-25T22:52:35.035Z"
	},
	{
		id: "cmm2muptk0036w923un6avkbu",
		template_id: "cmm2muo790032w923noll0mjn",
		jurisdiction_type: "city",
		congressional_district: null,
		senate_class: null,
		state_code: null,
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T22:55:38.552Z",
		updated_at: "2026-02-25T22:55:38.552Z"
	},
	{
		id: "cmm2mz0sz003nw923bronv1c5",
		template_id: "cmm2myznc003jw923gvxlx6qy",
		jurisdiction_type: "federal",
		congressional_district: null,
		senate_class: null,
		state_code: null,
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T22:58:59.412Z",
		updated_at: "2026-02-25T22:58:59.412Z"
	},
	{
		id: "cmm2ne4ml004kw923oyzvyzxi",
		template_id: "cmm2ne3kw004gw923dbbmxz01",
		jurisdiction_type: "state",
		congressional_district: null,
		senate_class: null,
		state_code: "CA-ON",
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T23:10:44.205Z",
		updated_at: "2026-02-25T23:10:44.205Z"
	},
	{
		id: "cmm2ni1cl0053w923rot5l6wi",
		template_id: "cmm2ni07b004zw923hv12u48x",
		jurisdiction_type: "state",
		congressional_district: null,
		senate_class: null,
		state_code: "BC",
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T23:13:46.581Z",
		updated_at: "2026-02-25T23:13:46.581Z"
	},
	{
		id: "cmm2nl5j8005hw923rokdu2f6",
		template_id: "cmm2nl4lp005dw9232o1aqznw",
		jurisdiction_type: "city",
		congressional_district: null,
		senate_class: null,
		state_code: "CA-QC",
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T23:16:11.972Z",
		updated_at: "2026-02-25T23:16:11.972Z"
	},
	{
		id: "cmm2np1h80061w9234qxtx6t9",
		template_id: "cmm2np0cf005xw923ryqxwmp8",
		jurisdiction_type: "federal",
		congressional_district: null,
		senate_class: null,
		state_code: null,
		state_senate_district: null,
		state_house_district: null,
		county_fips: null,
		county_name: null,
		city_name: null,
		city_fips: null,
		school_district_id: null,
		school_district_name: null,
		latitude: null,
		longitude: null,
		estimated_population: null,
		coverage_notes: null,
		created_at: "2026-02-25T23:19:13.340Z",
		updated_at: "2026-02-25T23:19:13.340Z"
	},
];

// ============================================================================
// SEED DATA -- Debates (built on actual resolved templates)
// ============================================================================

function hashBody(body: string): string {
	// Deterministic pseudo-hash for seed data (no crypto import needed)
	return '0x' + Buffer.from(body.slice(0, 32)).toString('hex').padEnd(64, '0');
}

const WALLET_ADDRS = [
	'0x42aBe6E1fBf6436720bbCF9db8B0c115cF7650fF',
	'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
	'0xdAC17F958D2ee523a2206206994597C13D831ec7',
	'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
];

const now = Date.now();
const DAY = 86_400_000;

interface DebateSeed {
	id: string;
	template_id: string;
	debate_id_onchain: string;
	proposition_text: string;
	status: string;
	deadline: Date;
	jurisdiction_size: number;
	proposer_index: number; // index into WALLET_ADDRS
	proposer_bond: bigint;
	// LMSR market
	market_status: string;
	market_liquidity: bigint | null;
	current_prices: Record<string, string> | null;
	current_epoch: number;
	trade_deadline: Date | null;
	resolution_deadline: Date | null;
	// AI resolution (null = not resolved yet)
	ai_resolution: Record<string, unknown> | null;
	ai_signature_count: number | null;
	ai_panel_consensus: number | null;
	resolution_method: string | null;
	appeal_deadline: Date | null;
	governance_justification: string | null;
	winning_argument_index: number | null;
	winning_stance: string | null;
	resolved_at: Date | null;
	arguments: Array<{
		stance: string;
		body: string;
		amendment_text: string | null;
		stake_amount: bigint;
		engagement_tier: number;
		weighted_score: number;
		total_stake: bigint;
		co_sign_count: number;
		current_price: string | null;
		price_history: Array<{ epoch: number; price: string; timestamp: string }> | null;
		position_count: number;
		ai_scores: Record<string, number> | null;
		ai_weighted: number | null;
		final_score: number | null;
		model_agreement: number | null;
	}>;
}

const DEBATES: DebateSeed[] = [
	// ── Debate 1: COPPA (resolved, AI-scored) ──────────────────
	{
		id: 'debate-seed-coppa',
		template_id: 'cmm2md4rd000zw923wi66rmse',
		debate_id_onchain: '0x' + 'c0'.repeat(32),
		proposition_text: 'Congress must pass COPPA 2.0 (HR 6291) to extend privacy protections to all minors under 17 and ban targeted advertising to children.',
		status: 'resolved',
		deadline: new Date(now - 3 * DAY),
		jurisdiction_size: 435,
		proposer_index: 0,
		proposer_bond: BigInt('1000000'),
		market_status: 'resolved',
		market_liquidity: BigInt('5000000'),
		current_prices: { '0': '0.28', '1': '0.52', '2': '0.20' },
		current_epoch: 4,
		trade_deadline: new Date(now - 3 * DAY),
		resolution_deadline: new Date(now - 2 * DAY),
		ai_resolution: {
			scores: [
				{ argumentIndex: 0, medianScores: { reasoning: 7400, accuracy: 7100, evidence: 7800, constructiveness: 7600, feasibility: 6200 }, weightedScore: 7280, modelAgreement: 0.85 },
				{ argumentIndex: 1, medianScores: { reasoning: 8600, accuracy: 8400, evidence: 8200, constructiveness: 8800, feasibility: 8100 }, weightedScore: 8460, modelAgreement: 0.94 },
				{ argumentIndex: 2, medianScores: { reasoning: 5900, accuracy: 6200, evidence: 5500, constructiveness: 5100, feasibility: 7200 }, weightedScore: 5900, modelAgreement: 0.68 },
			],
			models: [
				{ provider: 0, modelName: 'GPT-5 Nano', timestamp: now - 300000 },
				{ provider: 1, modelName: 'Gemini 3 Flash', timestamp: now - 295000 },
				{ provider: 2, modelName: 'DeepSeek V3.2', timestamp: now - 290000 },
				{ provider: 3, modelName: 'Mistral Large 3', timestamp: now - 285000 },
				{ provider: 4, modelName: 'Claude Haiku 4.5', timestamp: now - 280000 },
			],
			consensusAchieved: true,
			evaluatedAt: new Date(now - 2 * DAY).toISOString(),
			submitTxHash: '0x' + 'a1b2c3'.repeat(11).slice(0, 64),
			resolveTxHash: '0x' + 'd4e5f6'.repeat(11).slice(0, 64),
			gasUsed: '2145610',
		},
		ai_signature_count: 5,
		ai_panel_consensus: 0.89,
		resolution_method: 'ai_community',
		appeal_deadline: null,
		governance_justification: null,
		winning_argument_index: 1,
		winning_stance: 'AMEND',
		resolved_at: new Date(now - 2 * DAY),
		arguments: [
			{
				stance: 'SUPPORT',
				body: 'The current COPPA framework is a relic from 1998 that predates social media, smartphone apps, and algorithmic targeting. Children under 13 receive minimal protection while 13-16 year olds get none at all. Passing COPPA 2.0 is not just good policy — it is a moral obligation. The 72 million data points harvested per child annually represent a surveillance apparatus that no democratic society should tolerate for its most vulnerable members.',
				amendment_text: null,
				stake_amount: BigInt('1200000'),
				engagement_tier: 3,
				weighted_score: 7100,
				total_stake: BigInt('2400000'),
				co_sign_count: 5,
				current_price: '0.28',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 7 * DAY).toISOString() },
					{ epoch: 1, price: '0.31', timestamp: new Date(now - 6 * DAY).toISOString() },
					{ epoch: 2, price: '0.29', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 3, price: '0.28', timestamp: new Date(now - 4 * DAY).toISOString() },
				],
				position_count: 8,
				ai_scores: { reasoning: 7400, accuracy: 7100, evidence: 7800, constructiveness: 7600, feasibility: 6200 },
				ai_weighted: 7280,
				final_score: 7148,
				model_agreement: 0.85,
			},
			{
				stance: 'AMEND',
				body: 'While the intent of COPPA 2.0 is correct, the legislation needs a phased implementation with an independent technical standards body. An outright ban on targeted advertising to minors would push platforms toward subscription models that create a digital divide between wealthy and low-income families. Instead, mandate privacy-by-default architectures with independent audit requirements, and create a federal Data Protection Authority specifically for minors modeled on the UK ICO Children\'s Code.',
				amendment_text: 'Replace the blanket advertising ban with mandatory privacy-by-default architecture standards, enforce quarterly third-party audits by a new Federal Children\'s Data Protection Authority, and require platforms to offer ad-free tiers at no cost for verified minors under 17.',
				stake_amount: BigInt('1500000'),
				engagement_tier: 4,
				weighted_score: 8200,
				total_stake: BigInt('3800000'),
				co_sign_count: 9,
				current_price: '0.52',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 7 * DAY).toISOString() },
					{ epoch: 1, price: '0.38', timestamp: new Date(now - 6 * DAY).toISOString() },
					{ epoch: 2, price: '0.45', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 3, price: '0.52', timestamp: new Date(now - 4 * DAY).toISOString() },
				],
				position_count: 14,
				ai_scores: { reasoning: 8600, accuracy: 8400, evidence: 8200, constructiveness: 8800, feasibility: 8100 },
				ai_weighted: 8460,
				final_score: 8356,
				model_agreement: 0.94,
			},
			{
				stance: 'OPPOSE',
				body: 'COPPA 2.0 is a well-intentioned approach with dangerous unintended consequences. Age verification at scale requires collecting MORE personal data from children, not less — creating exactly the surveillance risk it claims to solve. Additionally, extending protections to 16-year-olds infantilizes teenagers who are already making complex digital decisions. The better path is platform liability reform and parental control tools, not an expansive federal data regime.',
				amendment_text: null,
				stake_amount: BigInt('800000'),
				engagement_tier: 2,
				weighted_score: 5200,
				total_stake: BigInt('1200000'),
				co_sign_count: 2,
				current_price: '0.20',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 7 * DAY).toISOString() },
					{ epoch: 1, price: '0.31', timestamp: new Date(now - 6 * DAY).toISOString() },
					{ epoch: 2, price: '0.26', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 3, price: '0.20', timestamp: new Date(now - 4 * DAY).toISOString() },
				],
				position_count: 4,
				ai_scores: { reasoning: 5900, accuracy: 6200, evidence: 5500, constructiveness: 5100, feasibility: 7200 },
				ai_weighted: 5900,
				final_score: 5648,
				model_agreement: 0.68,
			},
		],
	},

	// ── Debate 2: 3D Housing (active, LMSR market running) ─────
	{
		id: 'debate-seed-housing',
		template_id: 'cmm2mqr4o002iw923j1wdtxq3',
		debate_id_onchain: '0x' + 'b1'.repeat(32),
		proposition_text: 'Cities should fast-track building code amendments to permit 3D-printed residential construction and community land trusts as standard affordable housing strategies.',
		status: 'active',
		deadline: new Date(now + 4 * DAY),
		jurisdiction_size: 12,
		proposer_index: 1,
		proposer_bond: BigInt('500000'),
		market_status: 'active',
		market_liquidity: BigInt('3000000'),
		current_prices: { '0': '0.42', '1': '0.35', '2': '0.23' },
		current_epoch: 2,
		trade_deadline: new Date(now + 12 * 3600_000),
		resolution_deadline: new Date(now + 4 * DAY),
		ai_resolution: null,
		ai_signature_count: null,
		ai_panel_consensus: null,
		resolution_method: null,
		appeal_deadline: null,
		governance_justification: null,
		winning_argument_index: null,
		winning_stance: null,
		resolved_at: null,
		arguments: [
			{
				stance: 'SUPPORT',
				body: 'The numbers speak for themselves: 3D-printed homes cost $160K compared to $350K+ for traditional construction, and they can be built in days rather than months. Community land trusts in Austin have maintained affordability 25-30% below market for decades. The only thing standing between families and affordable housing is the building code, and that is a choice we can change tomorrow. Every month of regulatory delay means more families on the street.',
				amendment_text: null,
				stake_amount: BigInt('800000'),
				engagement_tier: 3,
				weighted_score: 6500,
				total_stake: BigInt('1600000'),
				co_sign_count: 4,
				current_price: '0.42',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 3 * DAY).toISOString() },
					{ epoch: 1, price: '0.39', timestamp: new Date(now - 1 * DAY).toISOString() },
				],
				position_count: 6,
				ai_scores: null,
				ai_weighted: null,
				final_score: null,
				model_agreement: null,
			},
			{
				stance: 'AMEND',
				body: 'Fast-tracking is necessary but insufficient without quality safeguards. 3D-printed homes need a separate certification pathway — not exemption from safety standards. Propose a 12-month pilot program in 3 cities with independent structural monitoring, then use those results to write national model codes. Community land trusts should require minimum 50-year deed restrictions to prevent eventual gentrification.',
				amendment_text: 'Add: "through a structured 12-month pilot program with independent structural certification and minimum 50-year community land trust deed restrictions."',
				stake_amount: BigInt('600000'),
				engagement_tier: 3,
				weighted_score: 5800,
				total_stake: BigInt('1200000'),
				co_sign_count: 3,
				current_price: '0.35',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 3 * DAY).toISOString() },
					{ epoch: 1, price: '0.35', timestamp: new Date(now - 1 * DAY).toISOString() },
				],
				position_count: 5,
				ai_scores: null,
				ai_weighted: null,
				final_score: null,
				model_agreement: null,
			},
			{
				stance: 'OPPOSE',
				body: 'Fast-tracking construction codes for unproven technology is irresponsible. We have seen what happens when building standards are relaxed for cost savings — the Surfside condo collapse killed 98 people. 3D-printed concrete has no long-term performance data beyond 5 years. Community land trusts sound appealing but create perpetual dependency on nonprofit governance. Let the market innovate; government should verify safety, not pick winners.',
				amendment_text: null,
				stake_amount: BigInt('400000'),
				engagement_tier: 2,
				weighted_score: 4200,
				total_stake: BigInt('600000'),
				co_sign_count: 1,
				current_price: '0.23',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 3 * DAY).toISOString() },
					{ epoch: 1, price: '0.26', timestamp: new Date(now - 1 * DAY).toISOString() },
				],
				position_count: 3,
				ai_scores: null,
				ai_weighted: null,
				final_score: null,
				model_agreement: null,
			},
		],
	},

	// ── Debate 3: Parks Canada (awaiting governance) ────────────
	{
		id: 'debate-seed-parks',
		template_id: 'cmm2myznc003jw923gvxlx6qy',
		debate_id_onchain: '0x' + 'a2'.repeat(32),
		proposition_text: 'The federal government should reverse $450M in Parks Canada funding cuts and establish a dedicated maintenance trust to clear the $3.6B infrastructure backlog.',
		status: 'awaiting_governance',
		deadline: new Date(now - 1 * DAY),
		jurisdiction_size: 338,
		proposer_index: 2,
		proposer_bond: BigInt('750000'),
		market_status: 'resolved',
		market_liquidity: BigInt('4000000'),
		current_prices: { '0': '0.41', '1': '0.39', '2': '0.20' },
		current_epoch: 3,
		trade_deadline: new Date(now - 1 * DAY),
		resolution_deadline: new Date(now - 12 * 3600_000),
		ai_resolution: {
			scores: [
				{ argumentIndex: 0, medianScores: { reasoning: 7200, accuracy: 7500, evidence: 7100, constructiveness: 7000, feasibility: 6800 }, weightedScore: 7140, modelAgreement: 0.78 },
				{ argumentIndex: 1, medianScores: { reasoning: 7000, accuracy: 7200, evidence: 6900, constructiveness: 7400, feasibility: 7100 }, weightedScore: 7080, modelAgreement: 0.75 },
				{ argumentIndex: 2, medianScores: { reasoning: 5500, accuracy: 5200, evidence: 5800, constructiveness: 4900, feasibility: 6600 }, weightedScore: 5500, modelAgreement: 0.62 },
			],
			models: [
				{ provider: 0, modelName: 'GPT-5 Nano', timestamp: now - 200000 },
				{ provider: 1, modelName: 'Gemini 3 Flash', timestamp: now - 195000 },
				{ provider: 2, modelName: 'DeepSeek V3.2', timestamp: now - 190000 },
				{ provider: 3, modelName: 'Mistral Large 3', timestamp: now - 185000 },
				{ provider: 4, modelName: 'Claude Haiku 4.5', timestamp: now - 180000 },
			],
			consensusAchieved: false,
			evaluatedAt: new Date(now - 12 * 3600_000).toISOString(),
			submitTxHash: '0x' + 'f7e8d9'.repeat(11).slice(0, 64),
			gasUsed: '1985320',
		},
		ai_signature_count: 5,
		ai_panel_consensus: 0.52,
		resolution_method: 'governance_override',
		appeal_deadline: null,
		governance_justification: 'AI panel consensus (0.52) below 0.65 threshold — top two arguments within 1% weighted score. Governance review required to determine winning position.',
		winning_argument_index: null,
		winning_stance: null,
		resolved_at: null,
		arguments: [
			{
				stance: 'SUPPORT',
				body: 'Our national parks generate $3.3 billion in visitor spending annually on a $900 million budget — a 3.6x ROI that almost no government program can match. Cutting $450 million from an agency that literally pays for itself is not fiscal responsibility, it is fiscal illiteracy. The $3.6 billion maintenance backlog grows by hundreds of millions each year of inaction. Every dollar not invested now costs $3-4 in emergency repairs later.',
				amendment_text: null,
				stake_amount: BigInt('900000'),
				engagement_tier: 3,
				weighted_score: 6800,
				total_stake: BigInt('1800000'),
				co_sign_count: 4,
				current_price: '0.41',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 1, price: '0.37', timestamp: new Date(now - 3 * DAY).toISOString() },
					{ epoch: 2, price: '0.41', timestamp: new Date(now - 2 * DAY).toISOString() },
				],
				position_count: 7,
				ai_scores: { reasoning: 7200, accuracy: 7500, evidence: 7100, constructiveness: 7000, feasibility: 6800 },
				ai_weighted: 7140,
				final_score: 7012,
				model_agreement: 0.78,
			},
			{
				stance: 'AMEND',
				body: 'Reversing cuts is necessary but a dedicated maintenance trust creates a dangerous precedent — it locks future governments into spending commitments regardless of fiscal conditions. Instead, introduce a Parks Canada Infrastructure Bond program backed by park revenue, allowing capital markets to fund the backlog while maintaining budget flexibility. Tie executive compensation at Parks Canada to maintenance reduction targets.',
				amendment_text: 'Replace "dedicated maintenance trust" with "Parks Canada Infrastructure Bond program backed by park entry fee revenue, with executive performance metrics tied to annual backlog reduction targets of at least 5%."',
				stake_amount: BigInt('850000'),
				engagement_tier: 3,
				weighted_score: 6600,
				total_stake: BigInt('1700000'),
				co_sign_count: 4,
				current_price: '0.39',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 1, price: '0.35', timestamp: new Date(now - 3 * DAY).toISOString() },
					{ epoch: 2, price: '0.39', timestamp: new Date(now - 2 * DAY).toISOString() },
				],
				position_count: 6,
				ai_scores: { reasoning: 7000, accuracy: 7200, evidence: 6900, constructiveness: 7400, feasibility: 7100 },
				ai_weighted: 7080,
				final_score: 6892,
				model_agreement: 0.75,
			},
			{
				stance: 'OPPOSE',
				body: 'The $3.6 billion backlog narrative ignores that much of it represents aspirational upgrades, not critical safety needs. Parks Canada should triage its portfolio — sell or transfer underperforming sites to provinces and focus federal resources on the 20 flagship parks that generate 80% of revenue. Throwing more money at an agency with a proven track record of mismanagement rewards failure.',
				amendment_text: null,
				stake_amount: BigInt('500000'),
				engagement_tier: 2,
				weighted_score: 4100,
				total_stake: BigInt('700000'),
				co_sign_count: 1,
				current_price: '0.20',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 1, price: '0.28', timestamp: new Date(now - 3 * DAY).toISOString() },
					{ epoch: 2, price: '0.20', timestamp: new Date(now - 2 * DAY).toISOString() },
				],
				position_count: 3,
				ai_scores: { reasoning: 5500, accuracy: 5200, evidence: 5800, constructiveness: 4900, feasibility: 6600 },
				ai_weighted: 5500,
				final_score: 4932,
				model_agreement: 0.62,
			},
		],
	},

	// ── Debate 4: Apple Labor (under appeal) ───────────────────
	{
		id: 'debate-seed-apple',
		template_id: 'cmm2np0cf005xw923ryqxwmp8',
		debate_id_onchain: '0x' + 'd3'.repeat(32),
		proposition_text: 'Apple must restructure retail compensation so that no employee\'s annual salary is worth less than 15 minutes of the company\'s daily interest income on cash reserves.',
		status: 'under_appeal',
		deadline: new Date(now - 2 * DAY),
		jurisdiction_size: 1,
		proposer_index: 3,
		proposer_bond: BigInt('1000000'),
		market_status: 'resolved',
		market_liquidity: BigInt('6000000'),
		current_prices: { '0': '0.22', '1': '0.18', '2': '0.60' },
		current_epoch: 5,
		trade_deadline: new Date(now - 2 * DAY),
		resolution_deadline: new Date(now - 1 * DAY),
		ai_resolution: {
			scores: [
				{ argumentIndex: 0, medianScores: { reasoning: 6800, accuracy: 5900, evidence: 6200, constructiveness: 7200, feasibility: 4800 }, weightedScore: 6260, modelAgreement: 0.70 },
				{ argumentIndex: 1, medianScores: { reasoning: 5500, accuracy: 5200, evidence: 5600, constructiveness: 6100, feasibility: 4200 }, weightedScore: 5340, modelAgreement: 0.58 },
				{ argumentIndex: 2, medianScores: { reasoning: 8200, accuracy: 8500, evidence: 8100, constructiveness: 7200, feasibility: 8400 }, weightedScore: 8180, modelAgreement: 0.91 },
			],
			models: [
				{ provider: 0, modelName: 'GPT-5 Nano', timestamp: now - 150000 },
				{ provider: 1, modelName: 'Gemini 3 Flash', timestamp: now - 145000 },
				{ provider: 2, modelName: 'DeepSeek V3.2', timestamp: now - 140000 },
				{ provider: 3, modelName: 'Mistral Large 3', timestamp: now - 135000 },
				{ provider: 4, modelName: 'Claude Haiku 4.5', timestamp: now - 130000 },
			],
			consensusAchieved: true,
			evaluatedAt: new Date(now - 1 * DAY).toISOString(),
			submitTxHash: '0x' + 'b3c4d5'.repeat(11).slice(0, 64),
			resolveTxHash: '0x' + 'e6f7a8'.repeat(11).slice(0, 64),
			gasUsed: '2312480',
		},
		ai_signature_count: 5,
		ai_panel_consensus: 0.82,
		resolution_method: 'ai_community',
		appeal_deadline: new Date(now + 5 * DAY),
		governance_justification: null,
		winning_argument_index: 2,
		winning_stance: 'OPPOSE',
		resolved_at: new Date(now - 1 * DAY),
		arguments: [
			{
				stance: 'SUPPORT',
				body: 'When 15 minutes of passive interest income exceeds a worker\'s entire annual salary, the value assigned to human labor has been completely decoupled from economic reality. Apple holds $132.4 billion in liquid assets while its median worker earns $35,570. This is not a market outcome — it is a power imbalance. Apple can afford to pay living wages that reflect the dignity of the people who make their brand successful.',
				amendment_text: null,
				stake_amount: BigInt('700000'),
				engagement_tier: 2,
				weighted_score: 5200,
				total_stake: BigInt('1100000'),
				co_sign_count: 2,
				current_price: '0.22',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 8 * DAY).toISOString() },
					{ epoch: 1, price: '0.30', timestamp: new Date(now - 6 * DAY).toISOString() },
					{ epoch: 2, price: '0.27', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 3, price: '0.24', timestamp: new Date(now - 4 * DAY).toISOString() },
					{ epoch: 4, price: '0.22', timestamp: new Date(now - 3 * DAY).toISOString() },
				],
				position_count: 5,
				ai_scores: { reasoning: 6800, accuracy: 5900, evidence: 6200, constructiveness: 7200, feasibility: 4800 },
				ai_weighted: 6260,
				final_score: 5836,
				model_agreement: 0.70,
			},
			{
				stance: 'AMEND',
				body: 'The moral argument is compelling but the mechanism is wrong. Tying wages to interest income creates a volatile compensation structure that could actually hurt workers during low-rate environments. Instead, mandate that Apple allocate a fixed percentage (5%) of annual free cash flow to a worker equity pool, giving retail employees actual ownership in the company they build. Profit-sharing creates alignment; wage mandates create adversarial dynamics.',
				amendment_text: 'Replace salary restructuring with mandatory 5% annual free cash flow allocation to a worker equity pool for all employees below VP level, with 3-year vesting.',
				stake_amount: BigInt('600000'),
				engagement_tier: 2,
				weighted_score: 4800,
				total_stake: BigInt('900000'),
				co_sign_count: 1,
				current_price: '0.18',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 8 * DAY).toISOString() },
					{ epoch: 1, price: '0.28', timestamp: new Date(now - 6 * DAY).toISOString() },
					{ epoch: 2, price: '0.23', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 3, price: '0.20', timestamp: new Date(now - 4 * DAY).toISOString() },
					{ epoch: 4, price: '0.18', timestamp: new Date(now - 3 * DAY).toISOString() },
				],
				position_count: 4,
				ai_scores: { reasoning: 5500, accuracy: 5200, evidence: 5600, constructiveness: 6100, feasibility: 4200 },
				ai_weighted: 5340,
				final_score: 5124,
				model_agreement: 0.58,
			},
			{
				stance: 'OPPOSE',
				body: 'This proposition conflates corporate treasury management with labor economics in a way that is intellectually dishonest. Interest income is a return on decades of accumulated innovation and risk. Apple retail workers are paid at or above market rates — the median Apple retail salary of $35,570 is competitive with the sector. Mandating compensation based on unrelated financial metrics would set a precedent that destroys rational capital allocation across the entire economy. If we price labor by comparing it to interest income, should we also adjust salaries daily based on bond yields?',
				amendment_text: null,
				stake_amount: BigInt('1800000'),
				engagement_tier: 4,
				weighted_score: 8500,
				total_stake: BigInt('4200000'),
				co_sign_count: 11,
				current_price: '0.60',
				price_history: [
					{ epoch: 0, price: '0.333', timestamp: new Date(now - 8 * DAY).toISOString() },
					{ epoch: 1, price: '0.42', timestamp: new Date(now - 6 * DAY).toISOString() },
					{ epoch: 2, price: '0.50', timestamp: new Date(now - 5 * DAY).toISOString() },
					{ epoch: 3, price: '0.56', timestamp: new Date(now - 4 * DAY).toISOString() },
					{ epoch: 4, price: '0.60', timestamp: new Date(now - 3 * DAY).toISOString() },
				],
				position_count: 16,
				ai_scores: { reasoning: 8200, accuracy: 8500, evidence: 8100, constructiveness: 7200, feasibility: 8400 },
				ai_weighted: 8180,
				final_score: 8308,
				model_agreement: 0.91,
			},
		],
	},
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log('');
	console.log('='.repeat(60));
	console.log('STATIC DATABASE SEED');
	console.log('='.repeat(60));

	try {
		await teardownDatabase();

		// ── Create Users ─────────────────────────────────────────
		console.log('Seeding users...');
		for (const userData of USERS) {
			await db.user.create({
				data: {
					id: userData.id,
					email: userData.email,
					name: userData.name,
					avatar: userData.avatar,
					createdAt: new Date(userData.createdAt),
					updatedAt: new Date(userData.updatedAt),
					is_verified: userData.is_verified,
					verification_method: userData.verification_method,
					verification_data: userData.verification_data as InputJsonValue,
					verified_at: userData.verified_at ? new Date(userData.verified_at) : null,
					identity_hash: userData.identity_hash,
					identity_fingerprint: userData.identity_fingerprint,
					birth_year: userData.birth_year,
					identity_commitment: userData.identity_commitment,
					document_type: userData.document_type,
					encrypted_entropy: userData.encrypted_entropy,
					authority_level: userData.authority_level,
					trust_tier: userData.trust_tier,
					passkey_credential_id: userData.passkey_credential_id,
					passkey_public_key_jwk: userData.passkey_public_key_jwk as InputJsonValue,
					did_key: userData.did_key,
					passkey_created_at: userData.passkey_created_at ? new Date(userData.passkey_created_at) : null,
					passkey_last_used_at: userData.passkey_last_used_at ? new Date(userData.passkey_last_used_at) : null,
					address_verification_method: userData.address_verification_method,
					address_verified_at: userData.address_verified_at ? new Date(userData.address_verified_at) : null,
					wallet_address: userData.wallet_address,
					district_hash: userData.district_hash,
					trust_score: userData.trust_score,
					reputation_tier: userData.reputation_tier,
					district_verified: userData.district_verified,
					templates_contributed: userData.templates_contributed,
					template_adoption_rate: userData.template_adoption_rate,
					peer_endorsements: userData.peer_endorsements,
					active_months: userData.active_months,
					role: userData.role,
					organization: userData.organization,
					location: userData.location,
					connection: userData.connection,
					profile_completed_at: userData.profile_completed_at ? new Date(userData.profile_completed_at) : null,
					profile_visibility: userData.profile_visibility
				}
			});
			console.log(`  Created user: "${userData.name}" (${userData.email})`);
		}

		// ── Create Templates ──────────────────────────────────────
		console.log('\nSeeding templates...');
		for (const t of TEMPLATES) {
			await db.template.create({
				data: {
					id: t.id,
					title: t.title,
					slug: t.slug,
					description: t.description,
					message_body: t.message_body,
					preview: t.preview,
					category: t.category,
					topics: t.topics as unknown as InputJsonValue,
					type: t.type,
					deliveryMethod: t.deliveryMethod,
					country_code: t.country_code,
					status: t.status,
					is_public: t.is_public,
					verification_status: t.verification_status,
					consensus_approved: t.consensus_approved,
					sources: (t.sources || []) as unknown as InputJsonValue,
					research_log: (t.research_log || []) as unknown as InputJsonValue,
					recipient_config: (t.recipient_config || {}) as unknown as InputJsonValue,
					delivery_config: (t.delivery_config || {}) as unknown as InputJsonValue,
					cwc_config: (t.cwc_config || {}) as unknown as InputJsonValue,
					metrics: (t.metrics || {}) as unknown as InputJsonValue,
					createdAt: new Date(t.createdAt),
					user: { connect: { id: t.userId } }
				}
			});
			console.log(`  Created template: "${t.title}" (/${t.slug})`);
		}

		// ── Create Template Scopes ────────────────────────────────
		console.log('\nSeeding template scopes...');
		for (const s of SCOPES) {
			await db.templateScope.create({
				data: {
					id: s.id,
					template_id: s.template_id,
					country_code: s.country_code,
					region_code: s.region_code,
					locality_code: s.locality_code,
					district_code: s.district_code,
					display_text: s.display_text,
					scope_level: s.scope_level,
					power_structure_type: s.power_structure_type,
					audience_filter: s.audience_filter,
					scope_notes: s.scope_notes,
					confidence: s.confidence,
					extraction_method: s.extraction_method,
					validated_against: s.validated_against,
					estimated_reach: s.estimated_reach,
					latitude: s.latitude,
					longitude: s.longitude,
					created_at: new Date(s.created_at),
					updated_at: new Date(s.updated_at)
				}
			});
			console.log(`  Created scope: ${s.scope_level} (${s.country_code}${s.region_code ? '/' + s.region_code : ''}${s.locality_code ? '/' + s.locality_code : ''}) -> ${s.template_id}`);
		}

		// ── Create Template Jurisdictions ─────────────────────────
		console.log('\nSeeding template jurisdictions...');
		for (const j of JURISDICTIONS) {
			await db.templateJurisdiction.create({
				data: {
					id: j.id,
					template_id: j.template_id,
					jurisdiction_type: j.jurisdiction_type,
					congressional_district: j.congressional_district,
					senate_class: j.senate_class,
					state_code: j.state_code,
					state_senate_district: j.state_senate_district,
					state_house_district: j.state_house_district,
					county_fips: j.county_fips,
					county_name: j.county_name,
					city_name: j.city_name,
					city_fips: j.city_fips,
					school_district_id: j.school_district_id,
					school_district_name: j.school_district_name,
					latitude: j.latitude,
					longitude: j.longitude,
					estimated_population: j.estimated_population,
					coverage_notes: j.coverage_notes,
					created_at: new Date(j.created_at),
					updated_at: new Date(j.updated_at)
				}
			});
			console.log(`  Created jurisdiction: ${j.jurisdiction_type}${j.state_code ? ' (' + j.state_code + ')' : ''} -> ${j.template_id}`);
		}

		// ── Create Debates ───────────────────────────────────────
		console.log('\nSeeding debates...');
		for (const d of DEBATES) {
			const propositionHash = hashBody(d.proposition_text);
			await db.debate.create({
				data: {
					id: d.id,
					template_id: d.template_id,
					debate_id_onchain: d.debate_id_onchain,
					proposition_text: d.proposition_text,
					proposition_hash: propositionHash,
					action_domain: `debate.${d.template_id.slice(0, 8)}`,
					proposer_address: WALLET_ADDRS[d.proposer_index],
					proposer_bond: d.proposer_bond,
					deadline: d.deadline,
					jurisdiction_size: d.jurisdiction_size,
					status: d.status,
					argument_count: d.arguments.length,
					unique_participants: d.arguments.length,
					total_stake: d.arguments.reduce((sum, a) => sum + a.total_stake, BigInt(0)),
					winning_argument_index: d.winning_argument_index,
					winning_stance: d.winning_stance,
					resolved_at: d.resolved_at,
					ai_resolution: d.ai_resolution as unknown as InputJsonValue,
					ai_signature_count: d.ai_signature_count,
					ai_panel_consensus: d.ai_panel_consensus,
					resolution_method: d.resolution_method,
					appeal_deadline: d.appeal_deadline,
					governance_justification: d.governance_justification,
					market_status: d.market_status,
					market_liquidity: d.market_liquidity,
					current_prices: d.current_prices as unknown as InputJsonValue,
					current_epoch: d.current_epoch,
					trade_deadline: d.trade_deadline,
					resolution_deadline: d.resolution_deadline,
				},
			});
			console.log(`  Created debate: "${d.proposition_text.slice(0, 60)}..." (${d.status})`);

			// Create arguments for this debate
			for (let i = 0; i < d.arguments.length; i++) {
				const arg = d.arguments[i];
				const bodyHash = hashBody(arg.body);
				await db.debateArgument.create({
					data: {
						debate_id: d.id,
						argument_index: i,
						stance: arg.stance,
						body: arg.body,
						body_hash: bodyHash,
						amendment_text: arg.amendment_text,
						amendment_hash: arg.amendment_text ? hashBody(arg.amendment_text) : null,
						stake_amount: arg.stake_amount,
						engagement_tier: arg.engagement_tier,
						weighted_score: arg.weighted_score,
						total_stake: arg.total_stake,
						co_sign_count: arg.co_sign_count,
						current_price: arg.current_price,
						price_history: arg.price_history as unknown as InputJsonValue,
						position_count: arg.position_count,
						ai_scores: arg.ai_scores as unknown as InputJsonValue,
						ai_weighted: arg.ai_weighted,
						final_score: arg.final_score,
						model_agreement: arg.model_agreement,
					},
				});
			}
			console.log(`    ${d.arguments.length} arguments seeded`);
		}

		// ── Summary ──────────────────────────────────────────────
		const counts = {
			users: await db.user.count(),
			templates: await db.template.count(),
			published: await db.template.count({ where: { status: 'published' } }),
			drafts: await db.template.count({ where: { status: 'draft' } }),
			scopes: await db.templateScope.count(),
			jurisdictions: await db.templateJurisdiction.count(),
			debates: await db.debate.count(),
			debateArgs: await db.debateArgument.count(),
		};

		console.log('');
		console.log('='.repeat(60));
		console.log('SEED COMPLETE');
		console.log('='.repeat(60));
		console.log(`Users:          ${counts.users}`);
		console.log(`Templates:      ${counts.templates} (${counts.published} published, ${counts.drafts} drafts)`);
		console.log(`Scopes:         ${counts.scopes}`);
		console.log(`Jurisdictions:  ${counts.jurisdictions}`);
		console.log(`Debates:        ${counts.debates} (${counts.debateArgs} arguments)`);
		console.log('='.repeat(60));
	} catch (error) {
		console.error('\nFATAL:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

main();

