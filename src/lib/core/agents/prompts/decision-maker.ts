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

Identify 6-10 **positions** (NOT people) with direct power to act on the described issue.

## Rules

1. Return POSITIONS and ORGANIZATIONS only. Do NOT include any person's name.
2. Think structurally: who has budget authority, regulatory power, legislative jurisdiction, or operational control?
3. Consider ALL power structures — government, corporate, institutional, nonprofit, regulatory bodies.
4. Include both direct decision-makers (can act unilaterally) and influential gatekeepers (can block or enable action).
5. For each role, explain WHY that position has power over this specific issue.
6. Be specific about jurisdiction: "Mayor of San Francisco" not just "Mayor". "CEO of Pacific Gas & Electric" not just "CEO".
7. Order by power relevance: most direct authority first.

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

For each person, try in order:
1. Direct search: "[NAME] email [ORGANIZATION]"
2. Staff directory: "[ORGANIZATION] staff directory" or "[ORGANIZATION] leadership"
3. Domain discovery: Find any email at the organization to learn the domain pattern
4. Pattern inference: If you find john.doe@org.com, the pattern is likely firstname.lastname@org.com
5. Fallback: Contact page URL, press/media email, general contact email

## Output Schema

Return valid JSON:

\`\`\`
{
  "decision_makers": [{
    "name": string (full name of current holder),
    "title": string (their title at the organization),
    "organization": string,
    "reasoning": string (why this position has power — from the role description),
    "source_url": string (URL where you verified they currently hold this position),
    "email": string (discovered email — REQUIRED, skip candidate if not found),
    "recency_check": string (format: "Verified via [SOURCE] dated [DATE]. Source age: [N] days.")
  }],
  "research_summary": string (brief summary of research process and confidence)
}
\`\`\`

## Critical Rules

1. Extract names FROM search results, not from memory
2. No email = no inclusion — skip candidates without discovered emails
3. Recent sources only — reject verification sources older than 6 months
4. If a position appears vacant or you cannot find the current holder, note it in research_summary and skip
5. Never invent or guess emails — only report emails you actually find in search results`;

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build user prompt for Phase 1: Role Discovery
 */
export function buildRoleDiscoveryPrompt(
	subjectLine: string,
	coreIssue: string,
	topics: string[],
	voiceSample?: string
): string {
	const voiceBlock = voiceSample
		? `\n\nVoice Sample (the human stakes):\n"${voiceSample}"\n`
		: '';

	return `Identify the positions with power over this issue:

Subject: ${subjectLine}
Core Issue: ${coreIssue}
Topics: ${topics.join(', ')}
${voiceBlock}
Return 6-10 positions (NOT people) with direct authority or gatekeeping power over this issue.`;
}

/**
 * Build user prompt for Phase 2: Person Lookup
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
// Legacy exports for backwards compatibility
// ============================================================================

/** @deprecated Use ROLE_DISCOVERY_PROMPT and PERSON_LOOKUP_PROMPT instead */
export const DECISION_MAKER_PROMPT = ROLE_DISCOVERY_PROMPT;

/** @deprecated Use buildRoleDiscoveryPrompt and buildPersonLookupPrompt instead */
export function buildDecisionMakerPrompt(
	subjectLine: string,
	coreIssue: string,
	topics: string[],
	voiceSample?: string
): string {
	return buildRoleDiscoveryPrompt(subjectLine, coreIssue, topics, voiceSample);
}
