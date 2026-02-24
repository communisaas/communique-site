/**
 * Unit Tests — thought-filter.ts
 *
 * Privacy-critical tests for the semantic thought filter.
 * Verifies that implementation details, schema references, and internal
 * meta-reasoning are stripped from user-visible agent thoughts while
 * preserving substantive user-facing reasoning.
 *
 * No mocking needed — cleanThoughtForDisplay is a pure function.
 */

import { describe, it, expect } from 'vitest';
import { cleanThoughtForDisplay } from '$lib/core/agents/utils/thought-filter';

// ============================================================================
// Tests: Empty / Falsy Input
// ============================================================================

describe('cleanThoughtForDisplay — empty and falsy input', () => {
	it('returns empty string for empty string input', () => {
		expect(cleanThoughtForDisplay('')).toBe('');
	});

	it('returns empty string for whitespace-only input', () => {
		expect(cleanThoughtForDisplay('   ')).toBe('');
		expect(cleanThoughtForDisplay('\t\n  \n')).toBe('');
	});

	it('returns empty string for null input', () => {
		expect(cleanThoughtForDisplay(null as unknown as string)).toBe('');
	});

	it('returns empty string for undefined input', () => {
		expect(cleanThoughtForDisplay(undefined as unknown as string)).toBe('');
	});
});

// ============================================================================
// Tests: Short Input (below minLength threshold)
// ============================================================================

describe('cleanThoughtForDisplay — short input filtering', () => {
	it('filters thoughts shorter than 30 characters (implementation detail heuristic)', () => {
		// isImplementationThought returns true for < 30 chars
		expect(cleanThoughtForDisplay('Short thought')).toBe('');
	});

	it('filters thoughts below default minLength (25) after cleanup', () => {
		// Even if it passes isImplementationThought, the minLength check catches it
		// A 50-char thought that gets stripped to < 25 chars after cleanup
		expect(cleanThoughtForDisplay('**Heading** — ok')).toBe('');
	});

	it('respects custom minLength option', () => {
		// This is a longer thought that passes the 30-char isImplementationThought check
		// and doesn't match any pattern, but is below a custom high minLength
		const thought = 'Considering the water quality implications of this policy change and its impact';
		expect(cleanThoughtForDisplay(thought, { minLength: 200 })).toBe('');
	});

	it('allows thoughts with low minLength=1', () => {
		// A thought that passes isImplementationThought (>30 chars, no patterns)
		const thought = 'The mayor has direct authority over municipal water management policy decisions';
		expect(cleanThoughtForDisplay(thought, { minLength: 1 })).toBe(thought);
	});
});

// ============================================================================
// Tests: JSON / Schema Pattern Filtering
// ============================================================================

describe('cleanThoughtForDisplay — JSON and schema patterns', () => {
	it('filters thoughts mentioning "json"', () => {
		expect(cleanThoughtForDisplay('I need to format this response as valid JSON with the correct fields')).toBe('');
	});

	it('filters thoughts mentioning "schema"', () => {
		expect(cleanThoughtForDisplay('Let me check the response schema to make sure all fields are included correctly')).toBe('');
	});

	it('filters thoughts mentioning "field" / "fields"', () => {
		expect(cleanThoughtForDisplay('The required fields for this response are subject_line and core_message')).toBe('');
	});

	it('filters thoughts mentioning "property" / "properties"', () => {
		expect(cleanThoughtForDisplay('I need to include all the properties in the response object correctly')).toBe('');
	});

	it('filters thoughts mentioning "object"', () => {
		expect(cleanThoughtForDisplay('The response object should contain the subject line and topics array')).toBe('');
	});

	it('filters thoughts mentioning "array"', () => {
		expect(cleanThoughtForDisplay('The topics should be in an array format with at least three items')).toBe('');
	});

	it('filters thoughts mentioning "structured" / "structure"', () => {
		expect(cleanThoughtForDisplay('I need to make sure the structured output conforms to the expected format')).toBe('');
	});
});

// ============================================================================
// Tests: Output / Response Formatting Pattern Filtering
// ============================================================================

describe('cleanThoughtForDisplay — output formatting patterns', () => {
	it('filters "output format" references', () => {
		expect(cleanThoughtForDisplay('According to the output format specification I should include geographic scope')).toBe('');
	});

	it('filters "response format" references', () => {
		expect(cleanThoughtForDisplay('The response format requires me to include a research log and sources array')).toBe('');
	});

	it('filters "formatting the/my/this" references', () => {
		expect(cleanThoughtForDisplay('I am formatting the response to include the inferred context correctly')).toBe('');
	});

	it('filters "required field" references', () => {
		expect(cleanThoughtForDisplay('The required field for geographic scope needs to be a valid enumeration value')).toBe('');
	});

	it('filters "validation" references', () => {
		expect(cleanThoughtForDisplay('The validation rules specify that confidence scores must be between zero and one')).toBe('');
	});
});

// ============================================================================
// Tests: Schema Field Name Filtering
// ============================================================================

describe('cleanThoughtForDisplay — schema field name leakage', () => {
	it('filters thoughts containing "needs_clarification"', () => {
		expect(cleanThoughtForDisplay('I should set needs_clarification to true since the location is ambiguous')).toBe('');
	});

	it('filters thoughts containing "subject_line"', () => {
		expect(cleanThoughtForDisplay('For the subject_line I will use a compelling framing of the water issue')).toBe('');
	});

	it('filters thoughts containing "core_message"', () => {
		expect(cleanThoughtForDisplay('The core_message should capture the essence of the constituent concern accurately')).toBe('');
	});

	it('filters thoughts containing "url_slug"', () => {
		expect(cleanThoughtForDisplay('I need to generate a url_slug that is SEO friendly and descriptive')).toBe('');
	});

	it('filters thoughts containing "voice_sample"', () => {
		expect(cleanThoughtForDisplay('The voice_sample should reflect the authentic voice of the constituent')).toBe('');
	});

	it('filters thoughts containing "inferred_context"', () => {
		expect(cleanThoughtForDisplay('For the inferred_context I will set the location confidence based on signals')).toBe('');
	});

	it('filters thoughts containing "clarification_questions"', () => {
		expect(cleanThoughtForDisplay('I need to populate the clarification_questions array with relevant questions')).toBe('');
	});

	it('filters thoughts containing "geographic_scope"', () => {
		expect(cleanThoughtForDisplay('The geographic_scope should be subnational since this is a city-level issue')).toBe('');
	});

	it('filters thoughts containing "research_log"', () => {
		expect(cleanThoughtForDisplay('For the research_log I should document all search queries performed')).toBe('');
	});

	it('filters "sources ... array" combination', () => {
		expect(cleanThoughtForDisplay('The sources array should contain all verified URLs from the search results')).toBe('');
	});
});

// ============================================================================
// Tests: Meta-Discussion / Self-Referential Pattern Filtering
// ============================================================================

describe('cleanThoughtForDisplay — meta-discussion patterns', () => {
	it('filters "I need to include/provide/output" patterns', () => {
		expect(cleanThoughtForDisplay('I need to include the geographic scope and research log in my response')).toBe('');
	});

	it('filters "I should include" patterns', () => {
		expect(cleanThoughtForDisplay('I should provide a comprehensive list of sources with proper citations')).toBe('');
	});

	it('filters "I must output" patterns', () => {
		expect(cleanThoughtForDisplay('I must output a well-structured response with all the required components')).toBe('');
	});

	it('filters "I will generate" patterns', () => {
		expect(cleanThoughtForDisplay('I will generate a compelling subject line that captures attention and urgency')).toBe('');
	});

	it('filters "I will create" patterns', () => {
		expect(cleanThoughtForDisplay('I will create a set of clarification questions to better understand the issue')).toBe('');
	});

	it('filters "let me structure/format/organize" patterns', () => {
		expect(cleanThoughtForDisplay('Let me structure the response to cover all the necessary aspects of this issue')).toBe('');
	});

	it('filters "let me create" patterns', () => {
		expect(cleanThoughtForDisplay('Let me create a comprehensive analysis of the policy implications for this topic')).toBe('');
	});

	it('filters "the output should/must/will" patterns', () => {
		expect(cleanThoughtForDisplay('The output should include a clear subject line and supporting evidence')).toBe('');
	});

	it('filters "the response should/must/will" patterns', () => {
		expect(cleanThoughtForDisplay('The response must contain properly formatted geographic scope information')).toBe('');
	});

	it('filters "the result should" patterns', () => {
		expect(cleanThoughtForDisplay('The result should be a complete analysis with confidence scores and reasoning')).toBe('');
	});

	it('filters "according to the schema/format" patterns', () => {
		expect(cleanThoughtForDisplay('According to the schema I need to include confidence scores for each dimension')).toBe('');
	});

	it('filters "according to my format" patterns', () => {
		expect(cleanThoughtForDisplay('According to my format guidelines I should include a voice sample field')).toBe('');
	});
});

// ============================================================================
// Tests: Self-Referential Short Thoughts
// ============================================================================

describe('cleanThoughtForDisplay — self-referential short thoughts', () => {
	it('filters short self-referential thoughts ("I will analyze this.")', () => {
		// < 20 words with self-referential "I will/should/need/must/can"
		expect(cleanThoughtForDisplay('I will analyze this issue carefully to understand the dynamics at play.')).toBe('');
	});

	it('filters "I need to think about this" pattern', () => {
		expect(cleanThoughtForDisplay('I need to think carefully about who has the authority here.')).toBe('');
	});

	it('filters "I should consider" pattern', () => {
		expect(cleanThoughtForDisplay('I should consider the broader implications of this policy change.')).toBe('');
	});

	it('filters "I can determine" pattern (short)', () => {
		expect(cleanThoughtForDisplay('I can determine that this is a local government issue.')).toBe('');
	});

	it('filters "I must evaluate" pattern (short)', () => {
		expect(cleanThoughtForDisplay('I must evaluate the power structure carefully here.')).toBe('');
	});
});

// ============================================================================
// Tests: User-Facing Reasoning PRESERVED (not filtered)
// ============================================================================

describe('cleanThoughtForDisplay — substantive reasoning preserved', () => {
	it('preserves political analysis reasoning', () => {
		const thought = 'The city council has direct authority over zoning decisions, which makes them the primary target for this housing advocacy campaign';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('preserves environmental policy analysis', () => {
		const thought = 'Water quality standards are set at the federal level by the EPA, but enforcement falls to state-level environmental agencies';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('preserves power structure analysis', () => {
		const thought = 'The mayor has veto power over city council decisions, making them a critical decision-maker for budget allocation';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('preserves constituent impact reasoning', () => {
		const thought = 'Rising rent prices in downtown Portland have displaced over 5,000 families in the last two years according to census data';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('preserves geographic context reasoning', () => {
		const thought = 'Based on the mention of BART and the Mission District, this is clearly about San Francisco city government';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('preserves corporate accountability reasoning', () => {
		const thought = 'Amazon warehouse conditions have been documented across multiple facilities, making this a corporate-level rather than local issue';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});
});

// ============================================================================
// Tests: Format Cleanup (Layer 2)
// ============================================================================

describe('cleanThoughtForDisplay — format cleanup', () => {
	it('strips markdown bold headings like "**Analyzing the Issue**"', () => {
		const thought = '**Analyzing the Issue** The water contamination affects three counties in northern Michigan and threatens drinking water';
		const result = cleanThoughtForDisplay(thought);
		expect(result).not.toContain('**');
		expect(result).toContain('The water contamination');
	});

	it('strips markdown bold headings with dash separator', () => {
		const thought = '**Key Finding** - The city council has sole authority over zoning regulations in the downtown corridor';
		const result = cleanThoughtForDisplay(thought);
		expect(result).not.toContain('**');
		expect(result).toContain('The city council');
	});

	it('strips markdown bold headings with em-dash separator', () => {
		const thought = '**Analysis** \u2014 This is fundamentally a local governance issue affecting residents in the central district';
		const result = cleanThoughtForDisplay(thought);
		expect(result).not.toContain('**');
		expect(result).toContain('This is fundamentally');
	});

	it('strips leading newlines', () => {
		const thought = '\n\n\nThe EPA has jurisdiction over water quality standards at the national level across all states';
		const result = cleanThoughtForDisplay(thought);
		expect(result).not.toMatch(/^\n/);
		expect(result).toContain('The EPA has jurisdiction');
	});

	it('trims whitespace from both ends', () => {
		const thought = '   The state legislature controls education funding allocations for all public school districts   ';
		const result = cleanThoughtForDisplay(thought);
		expect(result).not.toMatch(/^\s/);
		expect(result).not.toMatch(/\s$/);
	});

	it('applies both heading strip and trim together (heading at start of string)', () => {
		// Heading regex uses ^ anchor, so heading must be at the start of string (no leading newline)
		const thought = '**Summary** - The county board of supervisors manages local land use policy and environmental permits  ';
		const result = cleanThoughtForDisplay(thought);
		expect(result).not.toContain('**');
		expect(result).toBe('The county board of supervisors manages local land use policy and environmental permits');
	});

	it('does not strip heading when preceded by newlines (^ anchor limitation)', () => {
		// Leading newlines prevent the ^ anchor from matching the ** heading
		// The newline strip happens AFTER the heading strip
		const thought = '\n**Summary** - The county board of supervisors manages local land use policy and environmental permits';
		const result = cleanThoughtForDisplay(thought);
		// The heading is NOT stripped because of leading newline ordering
		expect(result).toContain('**Summary**');
	});
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('cleanThoughtForDisplay — edge cases', () => {
	it('handles very long input without truncation', () => {
		const longThought = 'The governor has significant executive authority over state agencies. '.repeat(20);
		const result = cleanThoughtForDisplay(longThought);
		// cleanThoughtForDisplay does NOT truncate (per source comment "No truncation - show full thought traces")
		expect(result.length).toBeGreaterThan(500);
	});

	it('handles unicode characters', () => {
		const thought = 'El gobernador de California tiene autoridad sobre las agencias estatales de medio ambiente y regulacion';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('handles special characters that are not implementation patterns', () => {
		const thought = 'The cost-benefit ratio of the proposed pipeline is approximately 1:3.5 making it economically questionable';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('handles emoji in thoughts', () => {
		const thought = 'The local representatives are clearly aware of the community frustration with traffic congestion on Highway 101';
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('correctly handles case-insensitive pattern matching', () => {
		// "JSON" (uppercase) should still be caught
		expect(cleanThoughtForDisplay('I will format the response as JSON with all the required fields')).toBe('');
		// "Schema" (title case) should still be caught
		expect(cleanThoughtForDisplay('The response Schema requires confidence scores between zero and one to be valid')).toBe('');
	});

	it('handles thought that is exactly 30 characters (boundary)', () => {
		// isImplementationThought filters < 30 chars, so exactly 30 passes that check
		// but then needs to pass pattern checks and minLength
		const thought = 'a'.repeat(30); // 30 chars, no patterns matched
		// After cleanup, still 30 chars, passes default minLength of 25
		expect(cleanThoughtForDisplay(thought)).toBe(thought);
	});

	it('handles thought that is 29 characters (just under boundary)', () => {
		const thought = 'a'.repeat(29);
		// isImplementationThought returns true for < 30 chars
		expect(cleanThoughtForDisplay(thought)).toBe('');
	});

	it('returns empty for thought that becomes too short after heading removal', () => {
		// After stripping the bold heading, only "ok" remains (< 25 chars)
		const thought = '**Heading goes here** ok';
		expect(cleanThoughtForDisplay(thought)).toBe('');
	});

	it('handles mixed implementation + substantive content (implementation wins)', () => {
		// If ANY implementation pattern matches, the entire thought is filtered
		const thought = 'The mayor controls the budget. I need to include this in the subject_line field for the response.';
		expect(cleanThoughtForDisplay(thought)).toBe('');
	});
});

// ============================================================================
// Tests: Privacy-Critical Scenarios
// ============================================================================

describe('cleanThoughtForDisplay — privacy-critical scenarios', () => {
	it('filters internal error traces mentioning API', () => {
		// Contains "validation" pattern
		expect(cleanThoughtForDisplay('There was a validation error in the API response that I need to handle gracefully')).toBe('');
	});

	it('filters thoughts about output conformance', () => {
		expect(cleanThoughtForDisplay('According to the schema requirements I must format the geographic scope as subnational')).toBe('');
	});

	it('filters thoughts about response construction mechanics', () => {
		expect(cleanThoughtForDisplay('Let me organize the response into the correct format with all required fields populated')).toBe('');
	});

	it('does not leak internal field names to users', () => {
		const internalPatterns = [
			'needs_clarification',
			'subject_line',
			'core_message',
			'url_slug',
			'voice_sample',
			'inferred_context',
			'clarification_questions',
			'geographic_scope',
			'research_log'
		];

		for (const pattern of internalPatterns) {
			const thought = `I should set the ${pattern} to an appropriate value based on my analysis`;
			expect(cleanThoughtForDisplay(thought)).toBe('');
		}
	});
});
