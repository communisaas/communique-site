import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface DecisionMaker {
	name: string;
	role: string;
	company: string;
	email: string;
	confidence: number;
	source: string;
	verified: boolean;
}

/**
 * Search for decision-maker emails using waterfall strategy:
 * 1. Hunter.io API (if available)
 * 2. Clearbit API (if available)
 * 3. Pattern guessing with confidence scoring
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	// Authentication required to prevent API key abuse
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const query = url.searchParams.get('q');
	const templateId = url.searchParams.get('templateId');

	if (!query) {
		return json({ error: 'Query parameter required' }, { status: 400 });
	}

	try {
		// Tier 1: Try Hunter.io (if API key configured)
		const hunterResults = await tryHunterIO(query);
		if (hunterResults.length > 0) {
			return json({ results: hunterResults, source: 'hunter.io' });
		}

		// Tier 2: Try Clearbit (if API key configured)
		const clearbitResults = await tryClearbit(query);
		if (clearbitResults.length > 0) {
			return json({ results: clearbitResults, source: 'clearbit' });
		}

		// Tier 3: Pattern guessing fallback
		const guessedResults = guessEmailPattern(query);
		return json({ results: guessedResults, source: 'pattern-guess' });
	} catch (error) {
		console.error('Decision-maker search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
};

/**
 * Try Hunter.io Email Finder API
 * Free tier: 50 searches/month
 * API: https://api.hunter.io/v2/email-finder
 */
async function tryHunterIO(query: string): Promise<DecisionMaker[]> {
	const apiKey = process.env.HUNTER_IO_API_KEY;
	if (!apiKey) return [];

	try {
		// Parse query into parts
		const { firstName, lastName, domain } = parseQuery(query);
		if (!firstName || !lastName || !domain) return [];

		const url = new URL('https://api.hunter.io/v2/email-finder');
		url.searchParams.set('domain', domain);
		url.searchParams.set('first_name', firstName);
		url.searchParams.set('last_name', lastName);
		url.searchParams.set('api_key', apiKey);

		const response = await fetch(url.toString());
		if (!response.ok) return [];

		const data = await response.json();
		if (!data.data?.email) return [];

		return [
			{
				name: `${firstName} ${lastName}`,
				role: data.data.position || 'Executive',
				company: data.data.organization || domain,
				email: data.data.email,
				confidence: data.data.score || 95,
				source: 'hunter.io',
				verified: true
			}
		];
	} catch (error) {
		console.error('Hunter.io error:', error);
		return [];
	}
}

/**
 * Try Clearbit Company API
 * Free tier: 1000 requests/month
 * API: https://company.clearbit.com/v2/companies/find
 */
async function tryClearbit(query: string): Promise<DecisionMaker[]> {
	const apiKey = process.env.CLEARBIT_API_KEY;
	if (!apiKey) return [];

	try {
		const { domain } = parseQuery(query);
		if (!domain) return [];

		const url = new URL('https://company.clearbit.com/v2/companies/find');
		url.searchParams.set('domain', domain);

		const response = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${apiKey}` }
		});

		if (!response.ok) return [];

		const data = await response.json();
		const results: DecisionMaker[] = [];

		// Extract CEO/executives if available
		if (data.person?.name && data.person?.email) {
			results.push({
				name: data.person.name,
				role: data.person.role || 'Executive',
				company: data.name,
				email: data.person.email,
				confidence: 85,
				source: 'clearbit',
				verified: true
			});
		}

		return results;
	} catch (error) {
		console.error('Clearbit error:', error);
		return [];
	}
}

/**
 * Pattern guessing fallback
 * Generates common email patterns with low confidence scores
 */
function guessEmailPattern(query: string): DecisionMaker[] {
	const { firstName, lastName, domain, company } = parseQuery(query);
	if (!firstName || !lastName || !domain) return [];

	const patterns = [
		`${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
		`${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
		`${firstName[0].toLowerCase()}${lastName.toLowerCase()}@${domain}`,
		`${firstName.toLowerCase()}@${domain}`
	];

	return patterns.map((email, index) => ({
		name: `${firstName} ${lastName}`,
		role: 'Executive',
		company: company || domain,
		email,
		confidence: 50 - index * 5, // Decreasing confidence
		source: 'pattern-guess',
		verified: false
	}));
}

/**
 * Parse search query into structured data
 * Examples:
 * - "Tim Cook" → firstName: Tim, lastName: Cook
 * - "Apple CEO" → company: Apple, role: CEO
 * - "Tim Cook Apple" → firstName: Tim, lastName: Cook, company: Apple
 */
function parseQuery(query: string): {
	firstName?: string;
	lastName?: string;
	domain?: string;
	company?: string;
} {
	const parts = query.trim().split(/\s+/);

	// Simple heuristics for now
	if (parts.length === 2) {
		// "Tim Cook" or "Apple CEO"
		if (parts[1].toLowerCase() === 'ceo' || parts[1].toLowerCase() === 'cto') {
			return { company: parts[0], domain: `${parts[0].toLowerCase()}.com` };
		}
		return { firstName: parts[0], lastName: parts[1] };
	}

	if (parts.length === 3) {
		// "Tim Cook Apple"
		return {
			firstName: parts[0],
			lastName: parts[1],
			company: parts[2],
			domain: `${parts[2].toLowerCase()}.com`
		};
	}

	// Fallback
	return { company: parts[0], domain: `${parts[0].toLowerCase()}.com` };
}
