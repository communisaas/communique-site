/**
 * Decision-Maker Discovery Prompts — Three-Phase Parallel Architecture
 *
 * Phase 1 (Role Discovery): Identify POSITIONS with power over the issue.
 *   - No grounding needed. LLMs excel at structural/institutional reasoning.
 *   - Explicitly forbids names to prevent stale parametric recall.
 *
 * Phase 2a (Identity Resolution): Parallel direct Exa searches + single extraction call.
 *   - NOT agentic. Search queries derived from Phase 1 roles.
 *   - One generateWithThoughts() call extracts names from search result titles.
 *
 * Phase 2b (Contact Hunting): Per-identity parallel mini-agents.
 *   - Each identity gets its own executeWithFunctionCalling session.
 *   - Budget: 1 search + 2 reads per identity. Isolated contexts.
 *   - Email verification: must find email verbatim in page content.
 */

// ============================================================================
// Phase 1: Role Discovery — Structural reasoning, no names
// ============================================================================

export const ROLE_DISCOVERY_PROMPT = `You are a power-structure analyst identifying which POSITIONS have direct authority over civic and institutional issues.

## Mission

Identify 8-10 **positions** (NOT people) with direct power to act on the described issue.

## Rules

1. Return POSITIONS and ORGANIZATIONS only. Do NOT include any person's name.
2. Think structurally: who has budget authority, regulatory power, legislative jurisdiction, or operational control?
3. Consider ALL power structures — government, corporate, institutional, nonprofit, regulatory bodies, coalition partners (unions, NGOs, trade associations), and amplifiers (editorial boards, prominent advocates, influential commentators).
4. Include direct decision-makers (can act unilaterally), gatekeepers (can block or enable action), coalition partners (can mobilize constituencies or apply pressure), and amplifiers (can shift public narrative or build momentum).
5. For each role, explain WHY that position has power over this specific issue. Your reasoning should naturally convey the type of power (direct authority, gatekeeping, coalition leverage, amplification reach).
6. Be specific about jurisdiction: "Mayor of San Francisco" not just "Mayor". "CEO of Pacific Gas & Electric" not just "CEO".
7. Order by power relevance: most direct authority first, then gatekeepers, then coalition partners, then amplifiers.
8. Consider alternative jurisdiction paths: if direct paths may be blocked (e.g., unresponsive executive), identify who has legislative oversight. If federal action is gridlocked, what state or local positions have parallel authority? Include these alternative vectors when relevant.

## Output

Return a JSON object with a "roles" array. Each role has:
- position: The title/role (e.g., "Mayor", "CEO", "Chair of Senate Committee on Environment")
- organization: The specific organization (e.g., "City of San Francisco", "Pacific Gas & Electric", "U.S. Senate")
- jurisdiction: Geographic or institutional scope (e.g., "San Francisco, CA", "California", "Federal")
- reasoning: Why this position has power over the issue (1-2 sentences)
- search_query: A suggested search query to find the current holder (e.g., "current Mayor of San Francisco 2026")

CRITICAL: Do NOT include any person's name. We look up current holders separately.`;

// ============================================================================
// Phase 1: Prompt Builder
// ============================================================================

/**
 * Build user prompt for Phase 1: Role Discovery
 */
export function buildRoleDiscoveryPrompt(
	subjectLine: string,
	coreMessage: string,
	topics: string[],
	voiceSample?: string
): string {
	const voiceBlock = voiceSample
		? `\n\nVoice Sample (the human stakes):\n"${voiceSample}"\n`
		: '';

	return `Identify the positions with power over this matter:

Subject: ${subjectLine}
Core Message: ${coreMessage}
Topics: ${topics.join(', ')}
${voiceBlock}
Return 8-10 positions (NOT people) with direct authority, gatekeeping power, coalition leverage, or amplification reach over this matter.`;
}

// ============================================================================
// Phase 2a: Identity Extraction — Parallel search + single extraction call
// ============================================================================

/**
 * @deprecated Replaced by IDENTITY_EXTRACTION_PROMPT (non-agentic parallel approach).
 * Kept for reference only — not imported anywhere.
 */
export const IDENTITY_RESOLUTION_PROMPT = `DEPRECATED — see IDENTITY_EXTRACTION_PROMPT`;

/** @deprecated Replaced by buildIdentityExtractionPrompt. */
export function buildIdentityResolutionPrompt(
	roles: Array<{
		position: string;
		organization: string;
		jurisdiction: string;
		reasoning: string;
		search_query: string;
	}>
): string {
	return 'DEPRECATED';
}

// ============================================================================
// Phase 2b: Contact Hunting — Full tools, maximum agent autonomy
// ============================================================================

/** Resolved identity from Phase 2a */
export interface ResolvedIdentity {
	position: string;
	name: string;
	title: string;
	organization: string;
	search_evidence: string;
}

/** Cached contact info for prompt injection */
export interface CachedContactInfo {
	name: string | null;
	title: string | null;
	email: string | null;
	emailSource: string | null;
	orgKey: string;
}

/**
 * @deprecated Replaced by SINGLE_CONTACT_PROMPT (per-identity parallel approach).
 * Kept for reference only.
 *
 * Template variables: {CURRENT_DATE}, {CURRENT_YEAR}, {MAX_SEARCHES}, {MAX_PAGE_READS}, {DOMAIN_CONTEXT}, {CACHED_CONTACTS}
 */
export const CONTACT_HUNTING_PROMPT = `You are finding email addresses for NAMED individuals at specific organizations.

TODAY'S DATE: {CURRENT_DATE}
CURRENT YEAR: {CURRENT_YEAR}

## YOUR MISSION

You are given a list of people with confirmed identities. Your ONLY job is finding their email addresses. Identities are already confirmed — you do not need to verify who holds each position.

## TOOLS

You have two tools:
- **search_web**: Search the web. Returns titles, URLs, published dates, relevance scores, url_hint (page type), and suggested_contact_urls.
- **read_page**: Read a web page. Returns full text, contact_hints (pre-extracted emails, phones, social URLs), and url_hint.

Use these signals however you see fit. Emails appear in unexpected places — news articles, press releases, third-party directories, campaign sites, staff listings. Use your judgment about what to search for and what to read.

## CONTEXT

{DOMAIN_CONTEXT}

{CACHED_CONTACTS}

## RULES

1. ONLY report emails you found on a page you read via read_page
2. When you find an email, note the URL — we verify the source page contains it
3. Do NOT construct or guess email addresses
4. General office emails (mayor@city.gov, press@org.com) ARE acceptable when they're the published way to reach that office
5. When no email is found, capture what you DID find (phone numbers, contact form URLs, social profiles, press contacts) in the contact_notes field — this information is valuable

## BUDGET

- Maximum **{MAX_SEARCHES}** web searches
- Maximum **{MAX_PAGE_READS}** page reads
- Focus your entire budget on finding emails. Do NOT spend reads verifying identities — they are already confirmed.
- When budget runs low, produce your final JSON output. Partial results are better than no results.

## OUTPUT

Return a JSON object with NO markdown code fences:

{
  "decision_makers": [
    {
      "name": "Full Name",
      "title": "Official Title",
      "organization": "Organization Name",
      "reasoning": "Why this position has power over the issue",
      "email": "verified@email.gov or NO_EMAIL_FOUND",
      "email_source": "URL where you read the email, or empty string",
      "recency_check": "Identity confirmed via [search evidence]",
      "contact_notes": "Alternative contact info found: phone (555) 123-4567, contact form at https://..."
    }
  ],
  "research_summary": "Brief summary of email search outcomes"
}

Include ALL people from the input, even those without emails. Return JSON directly.`;

/**
 * @deprecated Replaced by buildSingleContactPrompt (per-identity parallel approach).
 * Kept for reference only.
 */
export function buildContactHuntingPrompt(
	identities: ResolvedIdentity[],
	cachedContacts: CachedContactInfo[],
	subjectLine: string,
	roles: Array<{ position: string; organization: string; reasoning: string }>
): string {
	// Build a map of cached contacts by orgKey + title
	const cacheMap = new Map<string, CachedContactInfo>();
	for (const c of cachedContacts) {
		if (c.title) {
			cacheMap.set(`${c.orgKey}::${c.title.toLowerCase()}`, c);
		}
	}

	// Format each identity with cache annotation
	const identityList = identities
		.map((id, i) => {
			// Find matching role for reasoning
			const role = roles.find(
				(r) =>
					r.position.toLowerCase() === id.position.toLowerCase() &&
					r.organization.toLowerCase() === id.organization.toLowerCase()
			);

			const orgKey = id.organization
				.toLowerCase()
				.replace(/^the\s+/, '')
				.replace(/['']/g, '')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');

			const cached = cacheMap.get(`${orgKey}::${id.title.toLowerCase()}`);

			if (cached?.email) {
				return `${i}. **${id.name}** — ${id.title} at ${id.organization} [ALREADY RESOLVED — use cached email: ${cached.email}]`;
			}

			const evidenceLine = id.search_evidence
				? `\n   Identity evidence: ${id.search_evidence}`
				: '';
			const reasoningLine = role?.reasoning
				? `\n   Power relevance: ${role.reasoning}`
				: '';

			return `${i}. **${id.name}** — ${id.title} at ${id.organization}${evidenceLine}${reasoningLine}`;
		})
		.join('\n\n');

	// Generate domain context from organization types
	const orgTypes = detectOrgTypes(identities.map((id) => id.organization));
	const domainContext = generateDomainContext(orgTypes);

	// Format cached contacts note
	const cachedNote =
		cachedContacts.filter((c) => c.email).length > 0
			? `Already resolved (skip research for these):\n${cachedContacts
					.filter((c) => c.email)
					.map((c) => `- ${c.name || 'Unknown'} at ${c.orgKey}: ${c.email}`)
					.join('\n')}`
			: 'No cached contacts available.';

	return `Find email addresses for these individuals. Their identities are already confirmed.

Issue context: "${subjectLine}"

## PEOPLE TO FIND EMAILS FOR

${identityList}

For each person, search for and read pages where their email address appears. Return results for ALL people as JSON.`;
}

// ============================================================================
// Domain Context Helpers — Observational patterns, NOT directives
// ============================================================================

type OrgType = 'government' | 'union' | 'think_tank' | 'corporate' | 'nonprofit' | 'media' | 'other';

function detectOrgTypes(organizations: string[]): Set<OrgType> {
	const types = new Set<OrgType>();
	for (const org of organizations) {
		const lower = org.toLowerCase();
		if (
			/congress|senate|house|committee|commission|department|agency|city of|county of|state of|mayor|governor/.test(
				lower
			)
		) {
			types.add('government');
		} else if (/union|afl-cio|seiu|teamsters|federation|labor/.test(lower)) {
			types.add('union');
		} else if (/institute|foundation|center for|policy|research|council on/.test(lower)) {
			types.add('think_tank');
		} else if (/inc|corp|llc|company|group|enterprises/.test(lower)) {
			types.add('corporate');
		} else if (/association|society|alliance|coalition|network/.test(lower)) {
			types.add('nonprofit');
		} else if (/times|post|news|journal|media|press|editorial/.test(lower)) {
			types.add('media');
		} else {
			types.add('other');
		}
	}
	return types;
}

function generateDomainContext(orgTypes: Set<OrgType>): string {
	const observations: string[] = [];

	if (orgTypes.has('government')) {
		observations.push(
			'Government offices typically publish phone numbers and contact forms rather than email addresses. Staff directories, when available, may list individual emails. Congressional offices sometimes publish emails on senate.gov or house.gov profile pages.'
		);
	}
	if (orgTypes.has('union')) {
		observations.push(
			'Labor unions and advocacy organizations often publish press and media contact emails. National offices tend to have general contact forms, but press contacts are frequently available.'
		);
	}
	if (orgTypes.has('think_tank')) {
		observations.push(
			'Think tanks and policy institutes tend to list staff emails on team/people pages. Researchers and analysts often have published email addresses.'
		);
	}
	if (orgTypes.has('corporate')) {
		observations.push(
			'Corporate executives rarely publish direct email addresses. Investor relations and press contacts are more commonly available. SEC filings sometimes contain contact information.'
		);
	}
	if (orgTypes.has('media')) {
		observations.push(
			'Media organizations typically publish editorial contact emails. Reporters and editors often have published email addresses on bylines or staff pages.'
		);
	}

	if (observations.length === 0) return '';

	return `Domain patterns (for context, not constraints — use your judgment):\n${observations.map((o) => `- ${o}`).join('\n')}`;
}

/**
 * Generate a single-line domain hint for a specific organization.
 * Used by per-identity mini-agents in Phase 2b.
 */
export function generateDomainHintForOrg(organization: string): string {
	const types = detectOrgTypes([organization]);
	const context = generateDomainContext(types);
	if (!context) return '';
	return `\n${context}\n`;
}

// ============================================================================
// Phase 2a: Identity Extraction — Non-agentic parallel approach
// ============================================================================

/**
 * System prompt for Phase 2a identity extraction.
 * Used with generateWithThoughts() — NOT agentic, no function calling.
 * Receives pre-fetched search results and extracts names from titles.
 *
 * Template variables: {CURRENT_DATE}
 */
export const IDENTITY_EXTRACTION_PROMPT = `You are an identity extraction system. Given search results about institutional positions, extract the name of the current holder from search result metadata.

Rules:
- Use the MOST RECENT results (check publishedDate) as primary evidence
- Search result titles are your evidence: "John Smith Named New CEO of Acme Corp"
- If multiple names appear for the same role, prefer the most recent result
- If no name can be determined, set name to "UNKNOWN" and explain what you found
- search_evidence should cite the specific result title and date

Today's date: {CURRENT_DATE}

Return a JSON object (no markdown code fences):

{
  "identities": [
    {
      "position": "original position description from input",
      "name": "Full Name or UNKNOWN",
      "title": "official title (may differ from position)",
      "organization": "organization name",
      "search_evidence": "From: 'result title' (YYYY-MM-DD)"
    }
  ]
}

Include ALL positions from the input. Return JSON directly.`;

/**
 * Build user prompt for Phase 2a: identity extraction from pre-fetched search results.
 *
 * Input: roles paired with their Exa search hits.
 */
export function buildIdentityExtractionPrompt(
	roleResults: Array<{
		role: { position: string; organization: string; jurisdiction: string };
		hits: Array<{ url: string; title: string; publishedDate?: string; score?: number }>;
	}>
): string {
	const sections = roleResults
		.map((rr, i) => {
			const hitLines =
				rr.hits.length > 0
					? rr.hits
							.slice(0, 10) // Cap at 10 results per role to control prompt size
							.map(
								(h, j) =>
									`  ${j + 1}. "${h.title}" (${h.publishedDate || 'no date'}) — ${h.url.slice(0, 80)}`
							)
							.join('\n')
					: '  (no search results found)';

			return `## Position ${i}: ${rr.role.position} (${rr.role.organization}, ${rr.role.jurisdiction})\nSearch results:\n${hitLines}`;
		})
		.join('\n\n');

	return `Extract the current holder for each position from the search results below.\n\n${sections}`;
}

// ============================================================================
// Phase 2b: Single-Contact Hunting — Per-identity mini-agents
// ============================================================================

/**
 * System prompt for per-identity contact hunting mini-agents.
 * Each mini-agent has a tiny budget (1 search + 2 reads) focused on ONE person.
 *
 * Design: maximum agency, minimum prescription.
 * Template variables: {MAX_SEARCHES}, {MAX_PAGE_READS}, {DOMAIN_HINT}, {CURRENT_DATE}
 */
export const SINGLE_CONTACT_PROMPT = `You are searching for the email address of ONE specific person. You have two tools: search_web and read_page.

Budget: {MAX_SEARCHES} search(es), {MAX_PAGE_READS} page read(s).

Rules:
1. Emails you report MUST appear verbatim in a page you read via read_page.
2. Do NOT construct, guess, or infer email addresses.
3. General office emails ARE acceptable (mayor@city.gov, press@org.com) — these are valid published contact paths.
4. Tool responses include contact_hints (pre-extracted emails/phones) and url_hint (page type). Use these however you see fit.
5. If no email found, capture alternatives (phone, form URL, social profile) in contact_notes.
{DOMAIN_HINT}
Today's date: {CURRENT_DATE}

Return a JSON object (no markdown code fences):

{
  "decision_makers": [{
    "name": "Full Name",
    "title": "Official Title",
    "organization": "Organization Name",
    "reasoning": "Why this position matters (1 sentence)",
    "email": "found@email.com or NO_EMAIL_FOUND",
    "email_source": "URL where email appeared in read_page text, or empty string",
    "recency_check": "Identity confirmed via [search evidence]",
    "contact_notes": "Alternative contacts found, or empty string"
  }],
  "research_summary": "What you found"
}

Return JSON directly — no markdown code blocks.`;

/**
 * Build focused user prompt for a single-identity contact hunting mini-agent.
 *
 * When identity is UNKNOWN, the mission expands: identify the person first,
 * then find their email. The agent gets a bigger budget for this (2 searches).
 */
export function buildSingleContactPrompt(
	identity: ResolvedIdentity,
	reasoning: string
): string {
	if (identity.name === 'UNKNOWN') {
		return `Identify who currently holds this position AND find their email address:

**${identity.title}** at ${identity.organization}
Why this position matters: ${reasoning || 'Key decision-maker for this issue.'}

Step 1: Search to find the CURRENT person in this role. Use the most recent results.
Step 2: Once you have a name, search for their email.

You MUST return the person's actual name in the "name" field — never return "Unknown" or "UNKNOWN".
If you cannot determine who holds this position, set name to the most specific title you can find.`;
	}

	return `Find the email address for:

**${identity.name}** — ${identity.title} at ${identity.organization}
Identity confirmed via: ${identity.search_evidence}
Why they matter: ${reasoning || 'Key decision-maker for this issue.'}`;
}
