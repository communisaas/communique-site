/**
 * Thought Filter for Agent Traces
 *
 * Filters implementation details from user-visible agent thoughts.
 * Models often "think out loud" about output formatting, JSON structure,
 * and schema compliance — these are internal details that break immersion.
 *
 * Two-layer approach based on research:
 * 1. Prompt engineering: Tell model to focus on problem, not format
 * 2. Semantic filtering: Filter thoughts that discuss implementation
 *
 * @see https://arxiv.org/pdf/2503.09780 (AGENTDAM privacy research)
 * @see https://www.marktechpost.com/2025/06/25/new-ai-research-reveals-privacy-risks-in-llm-reasoning-traces/
 */

/**
 * Implementation detail patterns to filter from user-visible thoughts
 *
 * Research shows naive regex filtering is brittle, but semantic patterns
 * targeting specific leakage categories work well. We filter thoughts that
 * discuss output formatting rather than problem-solving.
 */
const IMPLEMENTATION_PATTERNS = [
	// JSON/schema structure
	/\bjson\b/i,
	/\bschema\b/i,
	/\bfield[s]?\b/i,
	/\bproperty|properties\b/i,
	/\bobject\b/i,
	/\barray\b/i,
	/\bstruct(ure)?d?\b/i,
	// Output formatting
	/\boutput format/i,
	/\bresponse format/i,
	/\bformat(ting)?\s+(the|my|this)/i,
	/\brequired field/i,
	/\bvalid(ation)?\b/i,
	// Common schema field names
	/\bneeds_clarification\b/i,
	/\bsubject_line\b/i,
	/\bcore_message\b/i,
	/\burl_slug\b/i,
	/\bvoice_sample\b/i,
	/\binferred_context\b/i,
	/\bclarification_questions\b/i,
	/\bgeographic_scope\b/i,
	/\bresearch_log\b/i,
	/\bsources\b.*\barray\b/i,
	// Meta-discussion about response
	/\bI (need to|should|must|will) (include|provide|output|return|generate|create)\b/i,
	/\blet me (structure|format|organize|create)\b/i,
	/\bthe (output|response|result) (should|must|will)\b/i,
	/\baccording to (the|my) (schema|format|structure)\b/i
];

/**
 * Check if a thought is primarily about implementation details
 */
function isImplementationThought(thought: string): boolean {
	const lowerThought = thought.toLowerCase();

	// Quick length check - very short thoughts are often format-related
	if (thought.length < 30) return true;

	// Check against implementation patterns
	for (const pattern of IMPLEMENTATION_PATTERNS) {
		if (pattern.test(thought)) {
			return true;
		}
	}

	// Check if thought is mostly about "I will/should/need to" without substance
	const selfReferentialCount = (lowerThought.match(/\bi (will|should|need|must|can)\b/g) || [])
		.length;
	const wordCount = thought.split(/\s+/).length;
	if (selfReferentialCount > 0 && wordCount < 20) {
		return true;
	}

	return false;
}

/**
 * Clean thought content for UI display
 *
 * Two-layer approach:
 * 1. Semantic filtering: Skip thoughts about implementation details
 * 2. Format cleanup: Remove markdown artifacts from remaining thoughts
 *
 * @param thought - Raw thought content from the model
 * @param options - Configuration options
 * @returns Cleaned thought string, or empty string if thought should be filtered
 */
export function cleanThoughtForDisplay(
	thought: string,
	options: {
		minLength?: number;
	} = {}
): string {
	const { minLength = 25 } = options;

	if (!thought?.trim()) return '';

	// Layer 1: Semantic filter - skip implementation-focused thoughts
	if (isImplementationThought(thought)) {
		return '';
	}

	// Layer 2: Format cleanup for user-visible thoughts
	// Remove markdown bold headings like "**Analyzing the Issue**"
	let cleaned = thought.replace(/^\*\*([^*]+)\*\*\s*[-–—]?\s*/i, '');

	// Remove leading newlines
	cleaned = cleaned.replace(/^\n+/, '');

	// Trim
	cleaned = cleaned.trim();

	// Skip if too short after cleanup (likely format-only content)
	if (cleaned.length < minLength) {
		return '';
	}

	// No truncation - show full thought traces
	return cleaned;
}
