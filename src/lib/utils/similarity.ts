/**
 * Calculate Levenshtein distance between two strings
 * Returns 0.0-1.0 where 0 = identical, 1 = completely different
 */
export function calculateSimilarity(a: string, b: string): number {
	const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
	const maxLength = Math.max(a.length, b.length);
	if (maxLength === 0) return 0;
	return distance / maxLength;
}

function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1
				);
			}
		}
	}

	return matrix[b.length][a.length];
}
