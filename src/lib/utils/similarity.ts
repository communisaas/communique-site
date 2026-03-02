/**
 * String similarity via Levenshtein distance.
 * Space-optimized: O(min(m,n)) using two-row Wagner-Fischer.
 */

function levenshteinDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	// Shorter string as rows → less memory
	if (a.length > b.length) [a, b] = [b, a];

	const m = a.length;
	const n = b.length;
	let prev: number[] = Array.from({ length: m + 1 }, (_, i) => i);
	let curr: number[] = new Array(m + 1);

	for (let j = 1; j <= n; j++) {
		curr[0] = j;
		for (let i = 1; i <= m; i++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
		}
		[prev, curr] = [curr, prev];
	}
	return prev[m];
}

/** Normalized distance: 0 = identical, 1 = completely different */
export function calculateSimilarity(a: string, b: string): number {
	const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
	const maxLength = Math.max(a.length, b.length);
	if (maxLength === 0) return 0;
	return distance / maxLength;
}
