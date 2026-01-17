/**
 * Grounding Mode JSON Utilities
 *
 * When using Google Search grounding, JSON schema enforcement is incompatible.
 * These utilities handle the manual JSON extraction required in grounding mode.
 *
 * Used by: decision-maker-identification, decision-maker-enrichment
 *
 * Why this exists:
 * - Gemini API limitation: enableGrounding + responseMimeType='application/json' don't work together
 * - Model may wrap JSON in markdown code blocks
 * - Model may include preamble/postamble text around JSON
 * - Responses may have trailing commas or other minor syntax errors
 */

export interface ExtractedJson<T> {
	data: T | null;
	success: boolean;
	error?: string;
	/** The cleaned JSON string before parsing (useful for debugging) */
	cleanedText?: string;
}

/**
 * Extract and parse JSON from a grounding-mode response
 *
 * Handles:
 * - Markdown code blocks (```json ... ```)
 * - Surrounding text (finds first { to last })
 * - Trailing commas
 * - Missing commas between objects
 *
 * @param responseText - Raw response text from Gemini
 * @returns Extracted data or null with error details
 */
export function extractJsonFromGroundingResponse<T>(responseText: string): ExtractedJson<T> {
	if (!responseText?.trim()) {
		return { data: null, success: false, error: 'Empty response' };
	}

	let cleaned = responseText.trim();

	// Step 1: Strip markdown code blocks if present
	const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (jsonMatch) {
		cleaned = jsonMatch[1].trim();
	}

	// Step 2: Extract JSON object if surrounded by text
	const jsonStartIndex = cleaned.indexOf('{');
	const jsonEndIndex = cleaned.lastIndexOf('}');

	if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex <= jsonStartIndex) {
		// Try array format
		const arrayStart = cleaned.indexOf('[');
		const arrayEnd = cleaned.lastIndexOf(']');
		if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
			cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
		} else {
			return {
				data: null,
				success: false,
				error: 'No JSON object or array found',
				cleanedText: cleaned
			};
		}
	} else {
		cleaned = cleaned.slice(jsonStartIndex, jsonEndIndex + 1);
	}

	// Step 3: Attempt direct parse
	try {
		const data = JSON.parse(cleaned) as T;
		return { data, success: true, cleanedText: cleaned };
	} catch (firstError) {
		// Step 4: Try sanitizing common LLM JSON errors
		try {
			const sanitized = cleaned
				.replace(/,\s*}/g, '}') // Remove trailing comma before }
				.replace(/,\s*]/g, ']') // Remove trailing comma before ]
				.replace(/}\s*{/g, '}, {') // Insert missing comma between objects
				.replace(/]\s*\[/g, '], ['); // Insert missing comma between arrays

			const data = JSON.parse(sanitized) as T;
			return { data, success: true, cleanedText: sanitized };
		} catch (secondError) {
			return {
				data: null,
				success: false,
				error: `JSON parse failed: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
				cleanedText: cleaned
			};
		}
	}
}

/**
 * Type guard to check if extraction succeeded
 */
export function isSuccessfulExtraction<T>(
	result: ExtractedJson<T>
): result is ExtractedJson<T> & { data: T; success: true } {
	return result.success && result.data !== null;
}
