/**
 * Congress.gov API Client
 *
 * API wrapper for the Congress.gov API to fetch legislative data.
 * Used for proactive legislative feed ingestion (Phase 2E).
 *
 * API Documentation: https://api.congress.gov/
 *
 * Rate Limits:
 * - 5,000 requests per hour (with API key)
 * - Implements exponential backoff for rate limiting
 *
 * @module congress/client
 */

// ============================================================================
// Configuration
// ============================================================================

const CONGRESS_API_BASE = 'https://api.congress.gov/v3';
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;

// Rate limiting configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
const MAX_REQUESTS_PER_HOUR = 5000;

// Track request count for rate limiting
let requestCount = 0;
let windowStart = Date.now();

// ============================================================================
// Types
// ============================================================================

/**
 * Bill information from Congress.gov
 */
export interface Bill {
	/** Bill number (e.g., "H.R. 1234", "S. 5678") */
	number: string;
	/** Short title of the bill */
	title: string;
	/** Date the bill was introduced */
	introducedDate: Date;
	/** Bill sponsor name */
	sponsor: string;
	/** Current status/latest action */
	status: string;
	/** Congress number (e.g., 118 for 118th Congress) */
	congress: number;
	/** Chamber of origin: house or senate */
	chamber: 'house' | 'senate';
	/** Bill type: hr, s, hjres, sjres, hconres, sconres, hres, sres */
	type: BillType;
	/** Summary if available */
	summary?: string;
	/** URL to full text PDF/XML */
	fullTextUrl?: string;
	/** Congress.gov URL */
	congressUrl: string;
	/** Policy areas/topics */
	policyArea?: string;
	/** Latest action date */
	latestActionDate?: Date;
	/** Latest action text */
	latestAction?: string;
	/** Cosponsors count */
	cosponsorsCount?: number;
}

/**
 * Detailed bill information including full text and amendments
 */
export interface BillDetails extends Bill {
	/** Full bill summary with version info */
	summaries?: BillSummary[];
	/** List of actions taken on the bill */
	actions?: BillAction[];
	/** Cosponsors */
	cosponsors?: BillCosponsor[];
	/** Related bills */
	relatedBills?: RelatedBill[];
	/** Subjects/topics */
	subjects?: string[];
	/** Committees */
	committees?: BillCommittee[];
	/** Text versions available */
	textVersions?: TextVersion[];
}

export interface BillSummary {
	/** Summary text */
	text: string;
	/** Version (e.g., "Introduced in House") */
	versionCode: string;
	/** Date of summary */
	actionDate: Date;
	/** Update date */
	updateDate: Date;
}

export interface BillAction {
	/** Action text */
	text: string;
	/** Action date */
	actionDate: Date;
	/** Action type */
	type?: string;
	/** Source system */
	sourceSystem?: string;
}

export interface BillCosponsor {
	/** Cosponsor name */
	name: string;
	/** Party (R, D, I) */
	party: string;
	/** State */
	state: string;
	/** Date joined as cosponsor */
	sponsorshipDate: Date;
}

export interface RelatedBill {
	/** Bill number */
	number: string;
	/** Bill type */
	type: BillType;
	/** Congress number */
	congress: number;
	/** Relationship type */
	relationshipType: string;
}

export interface BillCommittee {
	/** Committee name */
	name: string;
	/** Chamber */
	chamber: 'house' | 'senate';
	/** System code */
	systemCode?: string;
}

export interface TextVersion {
	/** Version type (e.g., "Introduced", "Engrossed") */
	type: string;
	/** Date */
	date: Date;
	/** Formats available */
	formats: {
		type: 'PDF' | 'XML' | 'HTML';
		url: string;
	}[];
}

export type BillType = 'hr' | 's' | 'hjres' | 'sjres' | 'hconres' | 'sconres' | 'hres' | 'sres';

export interface FetchRecentBillsOptions {
	/** Congress number (defaults to current: 118) */
	congress?: number;
	/** Chamber filter */
	chamber?: 'house' | 'senate';
	/** Bill type filter */
	type?: BillType;
	/** Maximum number of bills to fetch (default: 20, max: 250) */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
	/** Only bills introduced after this date */
	fromDate?: Date;
	/** Only bills introduced before this date */
	toDate?: Date;
	/** Sort by field */
	sort?: 'updateDate' | 'introducedDate';
}

// ============================================================================
// Internal Types (API Response)
// ============================================================================

interface CongressApiResponse<T> {
	bills?: T[];
	bill?: T;
	pagination?: {
		count: number;
		next?: string;
	};
}

interface CongressApiBill {
	number: string;
	title: string;
	originChamber: string;
	originChamberCode: string;
	type: string;
	introducedDate: string;
	updateDate: string;
	congress: number;
	url: string;
	latestAction?: {
		actionDate: string;
		text: string;
	};
	policyArea?: {
		name: string;
	};
	sponsors?: Array<{
		firstName: string;
		lastName: string;
		party: string;
		state: string;
	}>;
	cosponsors?: number;
}

interface CongressApiBillDetails extends Omit<CongressApiBill, 'cosponsors'> {
	summaries?: Array<{
		versionCode: string;
		actionDate: string;
		updateDate: string;
		text: string;
	}>;
	actions?: {
		item: Array<{
			actionDate: string;
			text: string;
			type?: string;
			sourceSystem?: {
				name: string;
			};
		}>;
	};
	cosponsors?: {
		item: Array<{
			firstName: string;
			lastName: string;
			party: string;
			state: string;
			sponsorshipDate: string;
		}>;
	};
	relatedBills?: {
		item: Array<{
			number: number;
			type: string;
			congress: number;
			relationshipDetails: Array<{
				type: string;
			}>;
		}>;
	};
	subjects?: {
		legislativeSubjects?: {
			item: Array<{
				name: string;
			}>;
		};
	};
	committees?: {
		item: Array<{
			name: string;
			chamber: string;
			systemCode?: string;
		}>;
	};
	textVersions?: {
		item: Array<{
			type: string;
			date: string;
			formats: Array<{
				type: string;
				url: string;
			}>;
		}>;
	};
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check if we can make another request within rate limits
 */
function checkRateLimit(): void {
	const now = Date.now();

	// Reset window if needed
	if (now - windowStart > RATE_LIMIT_WINDOW) {
		windowStart = now;
		requestCount = 0;
	}

	if (requestCount >= MAX_REQUESTS_PER_HOUR) {
		const timeUntilReset = RATE_LIMIT_WINDOW - (now - windowStart);
		throw new Error(
			`Rate limit exceeded. ${MAX_REQUESTS_PER_HOUR} requests per hour. ` +
				`Reset in ${Math.ceil(timeUntilReset / 1000 / 60)} minutes.`
		);
	}
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): {
	requestsRemaining: number;
	resetTime: Date;
	currentCount: number;
} {
	const now = Date.now();

	// Reset window if expired
	if (now - windowStart > RATE_LIMIT_WINDOW) {
		windowStart = now;
		requestCount = 0;
	}

	return {
		requestsRemaining: Math.max(0, MAX_REQUESTS_PER_HOUR - requestCount),
		resetTime: new Date(windowStart + RATE_LIMIT_WINDOW),
		currentCount: requestCount
	};
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Validate API key is configured
 */
function validateApiKey(): void {
	if (!CONGRESS_API_KEY) {
		throw new Error(
			'CONGRESS_API_KEY environment variable is not set. ' +
				'Get your API key at https://api.congress.gov/sign-up/'
		);
	}
}

/**
 * Make a request to Congress.gov API with retry logic
 */
async function congressRequest<T>(endpoint: string, retryCount = 0): Promise<T> {
	validateApiKey();
	checkRateLimit();

	const url = new URL(`${CONGRESS_API_BASE}${endpoint}`);
	url.searchParams.set('api_key', CONGRESS_API_KEY!);
	url.searchParams.set('format', 'json');

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

		requestCount++;

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		// Handle rate limiting from API
		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
			const delay = Math.min(retryAfter * 1000, 120000); // Max 2 minutes

			if (retryCount < MAX_RETRIES) {
				console.warn(
					`[Congress API] Rate limited, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return congressRequest<T>(endpoint, retryCount + 1);
			}

			throw new Error(`Rate limited after ${MAX_RETRIES} retries`);
		}

		// Handle other errors
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Congress API error (${response.status}): ${errorText}`);
		}

		return (await response.json()) as T;
	} catch (error) {
		// Retry on network errors
		if (retryCount < MAX_RETRIES && error instanceof Error) {
			const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);

			console.warn(
				`[Congress API] Request failed, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
				error.message
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
			return congressRequest<T>(endpoint, retryCount + 1);
		}

		throw error;
	}
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Get the current Congress number
 * Congress terms start January 3 of odd years
 */
export function getCurrentCongress(): number {
	const now = new Date();
	const year = now.getFullYear();
	// Congress number = (year - 1787) / 2, rounded down
	// 118th Congress: 2023-2025
	return Math.floor((year - 1787) / 2);
}

/**
 * Fetch recent bills from Congress.gov
 *
 * @param options - Query options
 * @returns Array of bills
 *
 * @example
 * // Get recent House bills
 * const bills = await fetchRecentBills({ chamber: 'house', limit: 10 });
 *
 * // Get bills from specific Congress
 * const bills = await fetchRecentBills({ congress: 117, limit: 50 });
 */
export async function fetchRecentBills(options: FetchRecentBillsOptions = {}): Promise<Bill[]> {
	const {
		congress = getCurrentCongress(),
		chamber,
		type,
		limit = 20,
		offset = 0,
		fromDate,
		toDate,
		sort = 'updateDate'
	} = options;

	// Build endpoint
	let endpoint = `/bill/${congress}`;

	// Add chamber/type filter if specified
	if (chamber && type) {
		endpoint += `/${type}`;
	} else if (chamber) {
		// Map chamber to bill type prefix
		const prefix = chamber === 'house' ? 'hr' : 's';
		endpoint += `/${prefix}`;
	} else if (type) {
		endpoint += `/${type}`;
	}

	// Build query params
	const params = new URLSearchParams();
	params.set('limit', Math.min(limit, 250).toString());
	params.set('offset', offset.toString());
	params.set('sort', sort);

	if (fromDate) {
		params.set('fromDateTime', fromDate.toISOString());
	}
	if (toDate) {
		params.set('toDateTime', toDate.toISOString());
	}

	const queryString = params.toString();
	const fullEndpoint = `${endpoint}?${queryString}`;

	console.log(`[Congress API] Fetching bills: ${fullEndpoint}`);

	const response = await congressRequest<CongressApiResponse<CongressApiBill>>(fullEndpoint);

	if (!response.bills) {
		return [];
	}

	return response.bills.map(transformBill);
}

/**
 * Fetch detailed information about a specific bill
 *
 * @param congress - Congress number
 * @param type - Bill type (hr, s, etc.)
 * @param number - Bill number
 * @returns Detailed bill information
 *
 * @example
 * const details = await fetchBillDetails(118, 'hr', 1);
 */
export async function fetchBillDetails(
	congress: number,
	type: BillType,
	number: number | string
): Promise<BillDetails> {
	const endpoint = `/bill/${congress}/${type}/${number}`;

	console.log(`[Congress API] Fetching bill details: ${endpoint}`);

	const response = await congressRequest<{ bill: CongressApiBillDetails }>(endpoint);

	if (!response.bill) {
		throw new Error(`Bill not found: ${congress}/${type}/${number}`);
	}

	return transformBillDetails(response.bill);
}

/**
 * Fetch bill by Congress.gov ID (e.g., "118-hr-1234")
 *
 * @param billId - Bill ID in format "congress-type-number"
 * @returns Detailed bill information
 */
export async function fetchBillById(billId: string): Promise<BillDetails> {
	const match = billId.match(/^(\d+)-([a-z]+)-(\d+)$/i);
	if (!match) {
		throw new Error(`Invalid bill ID format: ${billId}. Expected format: "118-hr-1234"`);
	}

	const [, congress, type, number] = match;
	return fetchBillDetails(parseInt(congress), type.toLowerCase() as BillType, number);
}

/**
 * Search for bills by keyword
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Array of matching bills
 */
export async function searchBills(
	query: string,
	options: {
		congress?: number;
		limit?: number;
		offset?: number;
	} = {}
): Promise<Bill[]> {
	const { congress = getCurrentCongress(), limit = 20, offset = 0 } = options;

	// Congress.gov API doesn't have a direct search endpoint
	// We fetch recent bills and filter client-side for now
	// TODO: Consider using summaries endpoint for better search
	const bills = await fetchRecentBills({
		congress,
		limit: Math.min(limit * 5, 250), // Fetch more to filter
		offset
	});

	const queryLower = query.toLowerCase();
	return bills
		.filter(
			(bill) =>
				bill.title.toLowerCase().includes(queryLower) ||
				bill.policyArea?.toLowerCase().includes(queryLower)
		)
		.slice(0, limit);
}

/**
 * Get bills updated since a specific date
 * Useful for incremental updates
 *
 * @param since - Date to check updates from
 * @param options - Additional options
 * @returns Bills updated since the given date
 */
export async function getBillsUpdatedSince(
	since: Date,
	options: Omit<FetchRecentBillsOptions, 'fromDate' | 'sort'> = {}
): Promise<Bill[]> {
	return fetchRecentBills({
		...options,
		fromDate: since,
		sort: 'updateDate'
	});
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformBill(apiBill: CongressApiBill): Bill {
	const chamberCode = apiBill.originChamberCode?.toLowerCase();
	const chamber: 'house' | 'senate' =
		chamberCode === 'h' || apiBill.originChamber?.toLowerCase() === 'house' ? 'house' : 'senate';

	const sponsor = apiBill.sponsors?.[0];
	const sponsorName = sponsor
		? `${sponsor.firstName} ${sponsor.lastName} (${sponsor.party}-${sponsor.state})`
		: 'Unknown';

	return {
		number: `${apiBill.type.toUpperCase()} ${apiBill.number}`,
		title: apiBill.title,
		introducedDate: new Date(apiBill.introducedDate),
		sponsor: sponsorName,
		status: apiBill.latestAction?.text || 'Unknown',
		congress: apiBill.congress,
		chamber,
		type: apiBill.type.toLowerCase() as BillType,
		congressUrl: apiBill.url,
		policyArea: apiBill.policyArea?.name,
		latestActionDate: apiBill.latestAction ? new Date(apiBill.latestAction.actionDate) : undefined,
		latestAction: apiBill.latestAction?.text,
		cosponsorsCount: typeof apiBill.cosponsors === 'number' ? apiBill.cosponsors : undefined
	};
}

function transformBillDetails(apiBill: CongressApiBillDetails): BillDetails {
	// Create base bill manually since CongressApiBillDetails has different cosponsors type
	const chamberCode = apiBill.originChamberCode?.toLowerCase();
	const chamber: 'house' | 'senate' =
		chamberCode === 'h' || apiBill.originChamber?.toLowerCase() === 'house' ? 'house' : 'senate';

	const sponsor = apiBill.sponsors?.[0];
	const sponsorName = sponsor
		? `${sponsor.firstName} ${sponsor.lastName} (${sponsor.party}-${sponsor.state})`
		: 'Unknown';

	const base: Bill = {
		number: `${apiBill.type.toUpperCase()} ${apiBill.number}`,
		title: apiBill.title,
		introducedDate: new Date(apiBill.introducedDate),
		sponsor: sponsorName,
		status: apiBill.latestAction?.text || 'Unknown',
		congress: apiBill.congress,
		chamber,
		type: apiBill.type.toLowerCase() as BillType,
		congressUrl: apiBill.url,
		policyArea: apiBill.policyArea?.name,
		latestActionDate: apiBill.latestAction ? new Date(apiBill.latestAction.actionDate) : undefined,
		latestAction: apiBill.latestAction?.text,
		cosponsorsCount: apiBill.cosponsors?.item?.length
	};

	return {
		...base,
		summaries: apiBill.summaries?.map((s) => ({
			text: s.text,
			versionCode: s.versionCode,
			actionDate: new Date(s.actionDate),
			updateDate: new Date(s.updateDate)
		})),
		actions: apiBill.actions?.item?.map((a) => ({
			text: a.text,
			actionDate: new Date(a.actionDate),
			type: a.type,
			sourceSystem: a.sourceSystem?.name
		})),
		cosponsors: apiBill.cosponsors?.item?.map((c) => ({
			name: `${c.firstName} ${c.lastName}`,
			party: c.party,
			state: c.state,
			sponsorshipDate: new Date(c.sponsorshipDate)
		})),
		relatedBills: apiBill.relatedBills?.item?.map((r) => ({
			number: r.number.toString(),
			type: r.type.toLowerCase() as BillType,
			congress: r.congress,
			relationshipType: r.relationshipDetails?.[0]?.type || 'Related'
		})),
		subjects: apiBill.subjects?.legislativeSubjects?.item?.map((s) => s.name),
		committees: apiBill.committees?.item?.map((c) => ({
			name: c.name,
			chamber: c.chamber.toLowerCase() as 'house' | 'senate',
			systemCode: c.systemCode
		})),
		textVersions: apiBill.textVersions?.item?.map((t) => ({
			type: t.type,
			date: new Date(t.date),
			formats: t.formats.map((f) => ({
				type: f.type as 'PDF' | 'XML' | 'HTML',
				url: f.url
			}))
		}))
	};
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check for Congress.gov API
 * Verifies API key is valid and service is reachable
 *
 * @returns true if healthy, false otherwise
 */
export async function healthCheck(): Promise<boolean> {
	try {
		validateApiKey();

		// Fetch a single bill as health check
		const bills = await fetchRecentBills({ limit: 1 });

		console.log('[Congress API] Health check passed');
		return bills.length > 0;
	} catch (error) {
		console.error('[Congress API] Health check failed:', error);
		return false;
	}
}
