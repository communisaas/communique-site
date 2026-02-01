/**
 * Bill Extraction API
 *
 * POST /api/documents/extract-bill - Extract structured data from a legislative bill
 *
 * Uses Reducto Extract API to parse congressional bills into structured format
 * including sponsors, funding, provisions, definitions, and effective dates.
 *
 * Request Body:
 * {
 *   url: "https://www.congress.gov/118/bills/hr1/BILLS-118hr1ih.pdf",
 *   congress?: 118,
 *   billType?: "hr",
 *   includeDefinitions?: true,
 *   maxProvisions?: 10
 * }
 *
 * Response: ExtractedBill with structured legislative data
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import { getReductoClient } from '$lib/server/reducto/client';
import type { BillExtractOptions } from '$lib/server/reducto/types';

const ALLOWED_DOMAINS = [
	'congress.gov',
	'www.congress.gov',
	'govinfo.gov',
	'www.govinfo.gov',
	'gpo.gov',
	'www.gpo.gov'
];

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Rate limiting: 10 requests per minute (expensive operation)
	const clientIp = getClientAddress();
	const rateLimitResult = await rateLimiter.limit(`bill-extract:${clientIp}`, 10, 60 * 1000);

	if (!rateLimitResult.success) {
		return json(
			{
				error: 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
				}
			}
		);
	}

	// Parse request body
	let body: BillExtractOptions;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate URL
	if (!body.url || typeof body.url !== 'string') {
		return json(
			{
				error: 'url is required',
				example: {
					url: 'https://www.congress.gov/118/bills/hr1/BILLS-118hr1ih.pdf',
					congress: 118,
					billType: 'hr'
				}
			},
			{ status: 400 }
		);
	}

	// Validate URL is from allowed domain
	let urlHost: string;
	try {
		const parsedUrl = new URL(body.url);
		urlHost = parsedUrl.hostname;
	} catch {
		return json({ error: 'Invalid URL format' }, { status: 400 });
	}

	if (!ALLOWED_DOMAINS.includes(urlHost)) {
		return json(
			{
				error: 'URL must be from congress.gov, govinfo.gov, or gpo.gov',
				allowedDomains: ALLOWED_DOMAINS
			},
			{ status: 400 }
		);
	}

	// Validate bill type if provided
	const validBillTypes = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'];
	if (body.billType && !validBillTypes.includes(body.billType)) {
		return json(
			{
				error: `Invalid billType. Must be one of: ${validBillTypes.join(', ')}`,
				provided: body.billType
			},
			{ status: 400 }
		);
	}

	// Validate congress number if provided
	if (body.congress !== undefined) {
		if (typeof body.congress !== 'number' || body.congress < 1 || body.congress > 200) {
			return json({ error: 'congress must be a number between 1 and 200' }, { status: 400 });
		}
	}

	try {
		const client = getReductoClient();
		const result = await client.extractBill({
			url: body.url,
			congress: body.congress,
			billType: body.billType,
			includeDefinitions: body.includeDefinitions ?? true,
			maxProvisions: body.maxProvisions ?? 10
		});

		if (!result.success) {
			return json(
				{
					error: result.error || 'Extraction failed',
					hint: 'Ensure the URL points to a valid bill document (PDF or HTML)'
				},
				{ status: 422 }
			);
		}

		return json({
			bill: result.bill,
			cached: result.cached,
			meta: {
				extractedAt: new Date().toISOString(),
				sourceUrl: body.url
			}
		});
	} catch (error) {
		console.error('[Bill Extract API] Error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('API key')) {
			return json(
				{ error: 'Document extraction service not configured' },
				{ status: 503 }
			);
		}

		return json({ error: 'Failed to extract bill data' }, { status: 500 });
	}
};

/**
 * GET /api/documents/extract-bill
 *
 * Returns usage instructions
 */
export const GET: RequestHandler = async () => {
	return json({
		message: 'Use POST to extract structured data from a legislative bill',
		usage: {
			method: 'POST',
			contentType: 'application/json',
			body: {
				url: 'URL to bill document (congress.gov, govinfo.gov, or gpo.gov)',
				congress: 'Congress number (optional, e.g., 118)',
				billType: 'Bill type (optional): hr, s, hjres, sjres, etc.',
				includeDefinitions: 'Extract defined terms (optional, default: true)',
				maxProvisions: 'Max provisions to extract (optional, default: 10)'
			}
		},
		extractedFields: [
			'billNumber', 'title', 'shortTitle',
			'congress', 'chamber', 'introducedDate',
			'sponsor', 'cosponsors', 'policyArea', 'subjects',
			'purpose', 'provisions', 'funding', 'definitions',
			'effectiveDates', 'sunsetDate', 'amendsLaws'
		],
		example: {
			url: 'https://www.congress.gov/118/bills/hr1/BILLS-118hr1ih.pdf',
			congress: 118,
			billType: 'hr',
			includeDefinitions: true
		}
	});
};
