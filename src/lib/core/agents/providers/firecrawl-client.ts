/**
 * Firecrawl API Client
 *
 * Wrapper around Firecrawl's Agent API for autonomous website navigation
 * and data extraction. Used for discovering organization leadership and
 * decision-makers from corporate websites.
 *
 * Firecrawl Agent API:
 * - Autonomous navigation (no URLs needed, just objectives)
 * - Structured data extraction via schemas
 * - Avoids LinkedIn/Twitter (blocked by those sites)
 */

import type { LeaderDocument, PolicyPositionDocument, OrganizationContactsDocument } from '$lib/server/mongodb/schema';

// ============================================================================
// Types
// ============================================================================

/**
 * Organization profile extracted by Firecrawl Agent
 */
export interface FirecrawlOrganizationProfile {
	name: string;
	website?: string;
	about?: string;
	industry?: string;
	headquarters?: {
		city?: string;
		state?: string;
		country?: string;
	};
	employeeCount?: string;
	leadership: FirecrawlLeader[];
	policyPositions: FirecrawlPolicyPosition[];
	contacts: {
		general?: string;
		press?: string;
		stakeholder?: string;
		phone?: string;
	};
}

export interface FirecrawlLeader {
	name: string;
	title: string;
	email?: string;
	emailVerified: boolean; // true if found directly, false if inferred
	linkedin?: string;
	department?: string;
	sourceUrl?: string;
	responsibilities?: string;
}

export interface FirecrawlPolicyPosition {
	topic: string;
	stance: string;
	summary: string;
	sourceUrl?: string;
}

/**
 * Firecrawl Agent API response structure
 */
interface FirecrawlAgentResponse<T> {
	success: boolean;
	data: T;
	jobId?: string;
	creditsUsed?: number;
	error?: string;
}

/**
 * Agent API request configuration
 */
interface AgentRequest {
	objective: string;
	schema?: unknown;
	startUrl?: string;
	maxPages?: number;
	onlyMainContent?: boolean;
}

// ============================================================================
// Firecrawl Client
// ============================================================================

export class FirecrawlClient {
	private apiKey: string;
	private baseUrl = 'https://api.firecrawl.dev/v1';

	constructor(apiKey?: string) {
		this.apiKey = apiKey || process.env.FIRECRAWL_API_KEY || '';

		if (!this.apiKey) {
			console.warn('[firecrawl-client] No API key provided. Set FIRECRAWL_API_KEY environment variable.');
		}
	}

	/**
	 * Discover organization leadership and profile using Agent API
	 *
	 * @param organizationName - Name of the organization to research
	 * @param topics - Topics to focus leadership discovery on
	 * @param startUrl - Optional starting URL (otherwise agent searches)
	 */
	async discoverOrganization(
		organizationName: string,
		topics: string[],
		startUrl?: string
	): Promise<FirecrawlOrganizationProfile> {
		console.log('[firecrawl-client] Discovering organization:', {
			name: organizationName,
			topics,
			startUrl
		});

		const objective = this.buildDiscoveryObjective(organizationName, topics);

		try {
			// Use Agent API for autonomous discovery
			const response = await this.agent<FirecrawlOrganizationProfile>({
				objective,
				startUrl,
				maxPages: 5,
				onlyMainContent: true
			});

			if (!response.success || !response.data) {
				throw new Error(`Firecrawl discovery failed: ${response.error || 'Unknown error'}`);
			}

			console.log('[firecrawl-client] Discovery successful:', {
				name: response.data.name,
				leadershipFound: response.data.leadership.length,
				creditsUsed: response.creditsUsed
			});

			return response.data;
		} catch (error) {
			console.error('[firecrawl-client] Discovery error:', error);
			throw new Error(
				`Failed to discover organization: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Build discovery objective prompt for Firecrawl Agent
	 */
	private buildDiscoveryObjective(organizationName: string, topics: string[]): string {
		const topicsText = topics.length > 0
			? `with focus on: ${topics.join(', ')}`
			: '';

		return `
Research ${organizationName} ${topicsText} and extract the following information:

## Organization Overview
- Official name and common aliases
- Mission statement or company description
- Industry/sector classification
- Headquarters location (city, state, country)
- Approximate employee count

## Leadership Team
Find executives, board members, and department heads who would have decision-making authority over ${topics.join(', ') || 'major organizational decisions'}.

For EACH leader, extract:
- Full name (as it appears officially)
- Official title
- Email address (CRITICAL - search thoroughly in contact pages, team pages, press sections, investor relations)
- LinkedIn profile URL (if available)
- Department or area of responsibility
- Brief description of their role

### Email Discovery Strategy
Search these locations for email addresses:
1. Contact/About pages and website footer
2. Leadership/Team/Executive pages
3. Press/Media contact sections
4. Investor relations pages
5. Staff directory if available
6. Individual biography pages

If you find ANY email at the organization, note the pattern:
- john.doe@company.com → pattern: firstname.lastname@domain
- jdoe@company.com → pattern: firstinitiallastname@domain

Mark emails as "verified" (found directly on site) or "inferred" (pattern-based guess).

## Policy Positions
Any public statements, commitments, or positions related to: ${topics.join(', ') || 'key issues'}

For each position:
- Topic area
- Organization's stance (support/oppose/neutral)
- Brief summary of their position
- Source URL for verification

## Contact Information
- General inquiries email
- Press/media contact email
- Stakeholder relations contact
- Main phone number

## Output Quality Requirements
- Only include information you can verify from the website
- Include source URLs for all leadership entries
- If leadership is not found, return empty array (don't guess)
- Prioritize accuracy over completeness
`.trim();
	}

	/**
	 * Call Firecrawl Agent API
	 */
	private async agent<T>(request: AgentRequest): Promise<FirecrawlAgentResponse<T>> {
		if (!this.apiKey) {
			throw new Error('Firecrawl API key not configured');
		}

		const url = `${this.baseUrl}/agent`;

		const body = {
			prompt: request.objective,
			schema: request.schema,
			url: request.startUrl,
			limit: request.maxPages || 5,
			pageOptions: {
				onlyMainContent: request.onlyMainContent ?? true
			}
		};

		console.log('[firecrawl-client] Calling Agent API...', {
			url,
			hasSchema: !!request.schema,
			maxPages: request.maxPages
		});

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.apiKey}`
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unable to read error response');
			throw new Error(`Firecrawl API error (${response.status}): ${errorText}`);
		}

		const data = await response.json();

		return {
			success: data.success ?? true,
			data: data.data || data,
			jobId: data.jobId,
			creditsUsed: data.creditsUsed
		};
	}

	/**
	 * Test API connectivity and authentication
	 */
	async testConnection(): Promise<boolean> {
		try {
			if (!this.apiKey) {
				return false;
			}

			// Simple health check - try to get account info or similar
			const response = await fetch(`${this.baseUrl}/account`, {
				headers: {
					'Authorization': `Bearer ${this.apiKey}`
				}
			});

			return response.ok;
		} catch (error) {
			console.error('[firecrawl-client] Connection test failed:', error);
			return false;
		}
	}
}

/**
 * Singleton Firecrawl client instance
 */
let firecrawlClient: FirecrawlClient | null = null;

export function getFirecrawlClient(): FirecrawlClient {
	if (!firecrawlClient) {
		firecrawlClient = new FirecrawlClient();
	}
	return firecrawlClient;
}
