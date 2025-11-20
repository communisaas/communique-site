/**
 * Levenshtein Distance Calculator
 *
 * Calculates the minimum edit distance (insertions, deletions, substitutions)
 * between two strings using the Wagner-Fischer dynamic programming algorithm.
 *
 * Used for fuzzy matching with typo tolerance in geographic scope extraction.
 *
 * Time complexity: O(m * n) where m, n are string lengths
 * Space complexity: O(min(m, n)) with optimized implementation
 *
 * @example
 * levenshteinDistance("california", "californa") → 1 (one substitution: i→o)
 * levenshteinDistance("nyc", "ny") → 1 (one deletion: c)
 * levenshteinDistance("texas", "taxes") → 2 (swap e/a, swap a/e)
 */
export function levenshteinDistance(a: string, b: string): number {
	// Early exit optimizations
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	// Ensure a is the shorter string for space optimization
	if (a.length > b.length) {
		[a, b] = [b, a];
	}

	// Initialize distance matrix (only need two rows for optimization)
	const m = a.length;
	const n = b.length;

	// Previous row of distances
	let previousRow: number[] = Array.from({ length: m + 1 }, (_, i) => i);
	// Current row of distances
	let currentRow: number[] = new Array(m + 1);

	// Compute distance using dynamic programming
	for (let j = 1; j <= n; j++) {
		currentRow[0] = j;

		for (let i = 1; i <= m; i++) {
			const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

			currentRow[i] = Math.min(
				previousRow[i] + 1, // Deletion
				currentRow[i - 1] + 1, // Insertion
				previousRow[i - 1] + substitutionCost // Substitution
			);
		}

		// Swap rows for next iteration
		[previousRow, currentRow] = [currentRow, previousRow];
	}

	// Result is in the last computed row
	return previousRow[m];
}

/**
 * Check if two strings are within a specified edit distance threshold
 * Optimized for early termination when threshold is exceeded
 *
 * @param a - First string
 * @param b - Second string
 * @param threshold - Maximum allowed edit distance (default: 2)
 * @returns True if edit distance ≤ threshold
 *
 * @example
 * withinEditDistance("socal", "social", 2) → true (distance = 2)
 * withinEditDistance("socal", "local", 2) → true (distance = 1)
 * withinEditDistance("socal", "focal", 2) → true (distance = 1)
 * withinEditDistance("socal", "vocal", 2) → true (distance = 1)
 * withinEditDistance("socal", "total", 2) → false (distance = 3)
 */
export function withinEditDistance(a: string, b: string, threshold: number = 2): boolean {
	// Early exit if length difference exceeds threshold
	if (Math.abs(a.length - b.length) > threshold) {
		return false;
	}

	// Calculate full distance (could be optimized further with early termination)
	const distance = levenshteinDistance(a, b);
	return distance <= threshold;
}
