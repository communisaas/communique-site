/**
 * Decision-Maker Discovery Prompts — Two-Phase Architecture
 *
 * Phase 1 (Role Discovery): Identify POSITIONS with power over the issue.
 *   - No grounding needed. LLMs excel at structural/institutional reasoning.
 *   - Explicitly forbids names to prevent stale parametric recall.
 *   - Uses responseSchema for guaranteed JSON structure.
 *
 * Phase 2 (Person Lookup): Search for who CURRENTLY holds each role.
 *   - Google Search grounding enabled. Information flows from search → name extraction.
 *   - The model enters with positions to fill, not names to verify.
 *   - This inversion eliminates confirmation bias from training data.
 */

// ============================================================================
// Phase 1: Role Discovery — Structural reasoning, no names
// ============================================================================

export const ROLE_DISCOVERY_PROMPT = `You are a power-structure analyst identifying which POSITIONS have direct authority over civic and institutional issues.

## Mission

Identify 10-15 **positions** (NOT people) with direct power to act on the described issue.

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
// Phase 2: Person Lookup — Grounded search for current holders
// ============================================================================

/**
 * @deprecated Use URL_TRIAGE_PROMPT + CONTENT_EXTRACTION_PROMPT for Exa-backed lookup
 */
export const PERSON_LOOKUP_PROMPT = `You are a researcher finding WHO currently holds specific positions and their contact information.

TODAY'S DATE: {CURRENT_DATE}
CURRENT YEAR: {CURRENT_YEAR}

## Mission

For each position listed below, find the CURRENT holder and their contact information using web search.

## Search Protocol

For EACH position:
1. Search using the provided search query (or construct one: "current [POSITION] [ORGANIZATION] {CURRENT_YEAR}")
2. Extract the name FROM THE SEARCH RESULTS, not from your memory
3. Look for their official email address
4. Record the source URL where you found this information

## Recency Verification

- ONLY use sources from the last 6 months
- If you find a name but the source is older than 6 months, search for "[NAME] resigned" or "new [POSITION] [ORGANIZATION]" to verify
- If you cannot verify a holder is current, note this in recency_check

## Email Discovery

For each person, search in order:
1. Direct search: "[NAME] email [ORGANIZATION]"
2. Staff directory: "[ORGANIZATION] staff directory" or "[ORGANIZATION] leadership"
3. Official contact page: "[ORGANIZATION] contact" or "[NAME] contact information"
4. Press/media contacts: "[ORGANIZATION] press contact" or "[ORGANIZATION] media inquiries"

CRITICAL EMAIL RULES:
- ONLY return emails that appear VERBATIM in your search results
- Do NOT infer or guess emails based on patterns (e.g., guessing firstname.lastname@domain.com)
- If you cannot find an actual email in search results, set email to "NO_EMAIL_FOUND"
- A grounded email from an official .gov or .org source is worth more than an inferred email

## Output Schema

Return valid JSON:

\`\`\`
{
  "decision_makers": [{
    "name": string (full name of current holder),
    "title": string (their title at the organization),
    "organization": string,
    "reasoning": string (why this position has power — from the role description),
    "email": string (discovered email OR "NO_EMAIL_FOUND" if not found in search results),
    "email_source": string (the specific URL where you found this email, or empty if NO_EMAIL_FOUND),
    "recency_check": string (format: "Verified via [SOURCE] dated [DATE]. Source age: [N] days.")
  }],
  "research_summary": string (brief summary of research process and confidence)
}
\`\`\`

## Critical Rules

1. Extract names FROM search results, not from memory
2. Recent sources only — reject verification sources older than 6 months
3. If a position appears vacant or you cannot find the current holder, note it in research_summary and skip
4. NEVER invent, guess, or pattern-infer emails — only report emails you actually find verbatim in search results
5. If you cannot find a real email, set email to "NO_EMAIL_FOUND" — do not skip the candidate
6. For each email you DO find, note the specific source where you found it in your reasoning
7. Source URLs are automatically extracted from search grounding — focus on finding accurate information`;

// ============================================================================
// Prompt Builders
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
Return 10-15 positions (NOT people) with direct authority, gatekeeping power, coalition leverage, or amplification reach over this matter.`;
}

/**
 * @deprecated Use buildUrlTriagePrompt + buildContentExtractionPrompt for Exa-backed lookup
 */
export function buildPersonLookupPrompt(
	roles: Array<{ position: string; organization: string; jurisdiction: string; reasoning: string; search_query: string }>,
	subjectLine: string
): string {
	const roleList = roles
		.map(
			(role, i) =>
				`${i + 1}. **${role.position}** at ${role.organization} (${role.jurisdiction})
   - Why: ${role.reasoning}
   - Search: "${role.search_query}"`
		)
		.join('\n\n');

	return `Find the CURRENT holders of these positions and their email addresses.

Issue context: "${subjectLine}"

## Positions to Research

${roleList}

For each position, search the web to find who currently holds it, verify they are the current holder, and discover their email address. Return results as JSON.`;
}

// ============================================================================
// Phase 2a: URL Triage — Select best URLs from Exa search results (Step B)
// ============================================================================

export const URL_TRIAGE_PROMPT = `You are a research assistant selecting the most promising web pages for finding current holders of specific positions and their contact information.

TODAY'S DATE: {CURRENT_DATE}
CURRENT YEAR: {CURRENT_YEAR}

## Mission

For each position below, review the search results and select the 2-3 URLs most likely to contain:
1. Confirmation of who CURRENTLY holds this position
2. Their official email address or a contact page with email addresses

## Selection Criteria (in order of priority)

1. **Official organization websites** — .gov, .edu, organization's own domain
2. **Staff directories and leadership pages** — URLs containing /staff, /directory, /leadership, /team, /about, /people, /contact
3. **Recent pages** — prefer pages published within the last 6 months (check publishedDate)
4. **Contact pages** — any page likely to list email addresses

## What to AVOID selecting

- News articles (unlikely to have email addresses)
- Social media profiles
- Wikipedia pages
- Job listings
- Pages older than 1 year unless they are official staff directories

## Output

Return valid JSON with NO other text:

\`\`\`
{
  "url_selections": [
    {
      "role_index": 0,
      "selected_urls": ["url1", "url2"],
      "reasoning": "Brief explanation of why these URLs were selected"
    }
  ]
}
\`\`\`

Select exactly 2-3 URLs per role. If no promising URLs exist for a role, return an empty selected_urls array with reasoning explaining why.`;

// ============================================================================
// Phase 2b: Content Extraction — Extract contact info from fetched pages (Step D)
// ============================================================================

export const CONTENT_EXTRACTION_PROMPT = `You are a researcher extracting verified contact information from web page content that has already been retrieved for you.

TODAY'S DATE: {CURRENT_DATE}
CURRENT YEAR: {CURRENT_YEAR}

## Mission

For each position listed below, examine the provided page content and extract:
- The name of the person who CURRENTLY holds this position
- Their official title
- Their email address (MUST appear VERBATIM in the page content provided)
- The specific URL of the page where you found this information

## CRITICAL EMAIL RULES

1. ONLY report an email if it appears CHARACTER-FOR-CHARACTER in the page content provided below
2. Do NOT infer or construct emails from naming patterns (e.g., do NOT guess firstname.lastname@domain.com)
3. Do NOT construct emails from domain names you see in URLs
4. If no email appears verbatim in the provided content, set email to "NO_EMAIL_FOUND"
5. When you find an email, note the EXACT URL of the page that contained it in email_source

## Recency Verification

- Cross-reference names across multiple pages when possible
- Note the publication dates of your sources
- If sources conflict about who currently holds a position, prefer the most recent source
- Flag any indication that a person has left the role

## Output Schema

Return valid JSON with NO other text:

\`\`\`
{
  "decision_makers": [{
    "name": string,
    "title": string,
    "organization": string,
    "reasoning": string,
    "email": string,
    "email_source": string,
    "recency_check": string
  }],
  "research_summary": string
}
\`\`\`

Field details:
- name: Full name of the current holder
- title: Their exact title at the organization
- organization: The organization name
- reasoning: Why this position has power over the issue (from the role description)
- email: The email found VERBATIM in page content, OR "NO_EMAIL_FOUND"
- email_source: The exact URL of the page containing the email (empty string if NO_EMAIL_FOUND)
- recency_check: Format: "Verified via [SOURCE TITLE] dated [DATE]. Source age: [N] days."
- research_summary: Brief summary of research process and confidence level`;

// ============================================================================
// Phase 2c: Unified Extraction — Single-call extraction for multiple roles (Wave 1B)
// ============================================================================

/**
 * Unified extraction prompt for Wave 1B architecture.
 * Combines role resolution and contact extraction in a single Gemini call.
 * Eliminates triage step by trusting Exa's ranking.
 *
 * Key features:
 * - Processes multiple roles in one call
 * - Uses 0-based indexing for role and page references
 * - Includes free-form contact_notes for alternative contact paths
 * - Strict email verification requirements
 */
export const UNIFIED_EXTRACTION_PROMPT = `You are extracting verified contact information for multiple positions from retrieved web pages.

TODAY'S DATE: {CURRENT_DATE}
CURRENT YEAR: {CURRENT_YEAR}

## MISSION

For each position listed below, find the CURRENT holder from the provided page content and extract their contact information.

## CRITICAL EMAIL RULES

1. ONLY report an email as verified if it appears CHARACTER-FOR-CHARACTER in the page content provided
2. The email must be clearly associated with this specific person (near their name, in their bio, in a staff listing)
3. General inboxes (info@, contact@, press@) only count if explicitly listed as this person's direct contact
4. Do NOT infer or construct emails from naming patterns
5. If you cannot verify an email belongs to this specific person, set email to null and email_verified to false

## CONTACT DISCOVERY

Beyond the primary email, note any alternative contact paths you discover:
- Scheduler or executive assistant contacts
- Press office or media relations
- Chief of staff or deputy contacts
- General office phone or contact form
- Any other relevant contact information

Record these in the contact_notes field as free-form text.

## OUTPUT FORMAT

Return valid JSON:

{
  "extractions": [
    {
      "role_index": number,
      "name": "Full Name" | null,
      "title": "Exact Title" | null,
      "email": "verified@email.gov" | null,
      "email_verified": boolean,
      "email_source_page": number | null,
      "contact_notes": "Free-form notes about alternative contacts discovered",
      "resolved": boolean,
      "recency_note": "Verification source and date"
    }
  ],
  "research_summary": "Brief summary of extraction process and confidence"
}

Field definitions:
- role_index: The index of the position from the input list (0-based)
- name: Full name of current holder, or null if not found
- title: Their exact title at the organization
- email: Verified email found in page content, or null
- email_verified: true ONLY if email appears verbatim in provided content
- email_source_page: Index of the page where email was found (0-based)
- contact_notes: Any alternative contact paths discovered (scheduler, press, etc.)
- resolved: true if we confidently identified the current holder
- recency_note: How we verified this person is current (e.g., "Staff directory dated Jan 2026")`;

/**
 * Build user prompt for unified extraction.
 * Combines role requirements with fetched page contents for single-call extraction.
 *
 * @param roles - Discovered roles from Phase 1
 * @param pageContents - Fetched page contents from Exa
 * @param subjectLine - Issue context for relevance
 * @returns Formatted user prompt
 */
export function buildUnifiedExtractionPrompt(
	roles: Array<{
		position: string;
		organization: string;
		jurisdiction: string;
		reasoning: string;
	}>,
	pageContents: Array<{
		url: string;
		title: string;
		text: string;
		publishedDate?: string;
	}>,
	subjectLine: string
): string {
	// Format roles
	const roleList = roles
		.map(
			(role, i) =>
				`${i}. **${role.position}** at ${role.organization} (${role.jurisdiction})\n   Why: ${role.reasoning}`
		)
		.join('\n\n');

	// Format page contents
	const pageBlocks = pageContents
		.map((page, i) => {
			const date = page.publishedDate ? ` | Published: ${page.publishedDate}` : '';
			return `--- PAGE ${i} ---
URL: ${page.url}
Title: ${page.title}${date}

${page.text}

--- END PAGE ${i} ---`;
		})
		.join('\n\n');

	return `Extract contact information for these positions from the provided page content.

Issue context: "${subjectLine}"

## POSITIONS TO RESOLVE

${roleList}

## RETRIEVED PAGE CONTENT

${pageBlocks}

For each position, identify the current holder from the pages above. Report their email ONLY if it appears verbatim in the content. Note any alternative contact paths in contact_notes.`;
}

// ============================================================================
// Exa-backed Prompt Builders (Steps B and D)
// ============================================================================

/**
 * Build user prompt for Step B: URL Triage
 * Formats discovered roles and Exa search results for Gemini to select best URLs.
 */
export function buildUrlTriagePrompt(
	roles: Array<{
		position: string;
		organization: string;
		jurisdiction: string;
		reasoning: string;
	}>,
	searchResults: Array<{
		organization: string;
		roleIndices: number[];
		hits: Array<{
			url: string;
			title: string;
			publishedDate?: string;
			author?: string;
		}>;
	}>
): string {
	// Format roles
	const roleList = roles
		.map(
			(role, i) =>
				`${i}. **${role.position}** at ${role.organization} (${role.jurisdiction})`
		)
		.join('\n');

	// Format search results grouped by organization
	const resultSections = searchResults
		.map((orgResult) => {
			const roleRefs = orgResult.roleIndices
				.map((i) => `Role ${i}`)
				.join(', ');
			const hitList = orgResult.hits
				.map((hit, j) => {
					const date = hit.publishedDate
						? ` (${hit.publishedDate})`
						: '';
					const author = hit.author ? ` by ${hit.author}` : '';
					return `  ${j + 1}. ${hit.title}${date}${author}\n     URL: ${hit.url}`;
				})
				.join('\n');

			return `### ${orgResult.organization} (covers ${roleRefs})\n${hitList}`;
		})
		.join('\n\n');

	return `Select the best URLs for finding current holders and email addresses for these positions.

## Positions to Research

${roleList}

## Search Results

${resultSections}

For each role (by index), select 2-3 URLs most likely to contain the current holder's name and email address. Return as JSON.`;
}

/**
 * Build user prompt for Step D: Content Extraction
 * Formats discovered roles and fetched page content for Gemini to extract contact information.
 */
export function buildContentExtractionPrompt(
	roles: Array<{
		position: string;
		organization: string;
		jurisdiction: string;
		reasoning: string;
	}>,
	pageContents: Array<{
		url: string;
		title: string;
		text: string;
		publishedDate?: string;
	}>,
	subjectLine: string
): string {
	// Format roles
	const roleList = roles
		.map(
			(role, i) =>
				`${i + 1}. **${role.position}** at ${role.organization} (${role.jurisdiction})\n   Why: ${role.reasoning}`
		)
		.join('\n\n');

	// Format page contents with clear URL labels
	const pageBlocks = pageContents
		.map((page, i) => {
			const date = page.publishedDate
				? ` | Published: ${page.publishedDate}`
				: '';
			return `--- PAGE ${i + 1} ---
URL: ${page.url}
Title: ${page.title}${date}

${page.text}

--- END PAGE ${i + 1} ---`;
		})
		.join('\n\n');

	return `Find the CURRENT holders of these positions and their email addresses from the page content provided below.

Issue context: "${subjectLine}"

## Positions to Research

${roleList}

## Retrieved Page Content

The following pages have been fetched and their full text content is provided. Extract names and email addresses ONLY from this content.

${pageBlocks}

For each position, identify the current holder from the page content above. Report their email ONLY if it appears verbatim in the content. Return results as JSON.`;
}

// ============================================================================
// Legacy exports for backwards compatibility
// ============================================================================

/** @deprecated Use ROLE_DISCOVERY_PROMPT and PERSON_LOOKUP_PROMPT instead */
export const DECISION_MAKER_PROMPT = ROLE_DISCOVERY_PROMPT;

/** @deprecated Use buildRoleDiscoveryPrompt and buildPersonLookupPrompt instead */
export function buildDecisionMakerPrompt(
	subjectLine: string,
	coreMessage: string,
	topics: string[],
	voiceSample?: string
): string {
	return buildRoleDiscoveryPrompt(subjectLine, coreMessage, topics, voiceSample);
}
