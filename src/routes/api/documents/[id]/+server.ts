/**
 * Document Detail API Endpoint
 *
 * Fetches a parsed document by ID from the Reducto cache.
 * Used by the L3 DocumentDetail component for full document analysis view.
 *
 * @module api/documents/[id]
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getReductoClient } from '$lib/server/reducto/client';
import { rateLimiter } from '$lib/server/rate-limiter';
import type { ParsedDocument } from '$lib/server/reducto/types';

// ============================================================================
// Types
// ============================================================================

/**
 * API response for document fetch
 */
interface DocumentResponse {
	success: true;
	data: {
		document: ParsedDocument;
	};
}

/**
 * API error response
 */
interface DocumentErrorResponse {
	success: false;
	error: {
		code: string;
		message: string;
	};
}

type ApiResponse = DocumentResponse | DocumentErrorResponse;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Rate limit configuration
 * - 60 requests per minute per IP for document fetches
 * - Generous limit for legitimate L3 exploration
 */
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/documents/[id]
 *
 * Fetch a parsed document by its ID.
 *
 * @param params.id - Document ID (from Reducto or MongoDB)
 * @returns ParsedDocument JSON or error
 */
export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const { id } = params;

	// Validate document ID
	if (!id || typeof id !== 'string') {
		return json(
			{
				success: false,
				error: {
					code: 'INVALID_ID',
					message: 'Document ID is required'
				}
			} satisfies DocumentErrorResponse,
			{ status: 400 }
		);
	}

	// Validate ID format (alphanumeric, hyphens, underscores, 1-64 chars)
	if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
		return json(
			{
				success: false,
				error: {
					code: 'INVALID_ID_FORMAT',
					message: 'Invalid document ID format'
				}
			} satisfies DocumentErrorResponse,
			{ status: 400 }
		);
	}

	// Rate limiting by IP
	try {
		const clientIp = getClientAddress();
		const rateLimitKey = `documents:${clientIp}`;
		const rateLimitResult = await rateLimiter.limit(
			rateLimitKey,
			RATE_LIMIT_MAX,
			RATE_LIMIT_WINDOW_MS
		);

		if (!rateLimitResult.success) {
			return json(
				{
					success: false,
					error: {
						code: 'RATE_LIMITED',
						message: 'Too many requests. Please try again later.'
					}
				} satisfies DocumentErrorResponse,
				{
					status: 429,
					headers: {
						'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
						'X-RateLimit-Limit': String(rateLimitResult.limit),
						'X-RateLimit-Remaining': String(rateLimitResult.remaining),
						'X-RateLimit-Reset': String(rateLimitResult.reset)
					}
				}
			);
		}
	} catch (rateLimitError) {
		// Log but don't fail on rate limit errors
		console.warn('[Documents API] Rate limit check failed:', rateLimitError);
	}

	// Fetch document from Reducto client
	try {
		const client = getReductoClient();
		const document = await client.getById(id);

		if (!document) {
			return json(
				{
					success: false,
					error: {
						code: 'NOT_FOUND',
						message: 'Document not found'
					}
				} satisfies DocumentErrorResponse,
				{ status: 404 }
			);
		}

		// Return successful response
		const response: DocumentResponse = {
			success: true,
			data: {
				document
			}
		};

		return json(response, {
			headers: {
				// Cache for 5 minutes on CDN, stale-while-revalidate for 1 hour
				'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
			}
		});
	} catch (err) {
		console.error('[Documents API] Error fetching document:', err);

		// Handle specific error types
		if (err instanceof Error) {
			// MongoDB connection errors
			if (err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
				return json(
					{
						success: false,
						error: {
							code: 'SERVICE_UNAVAILABLE',
							message: 'Document service temporarily unavailable'
						}
					} satisfies DocumentErrorResponse,
					{ status: 503 }
				);
			}
		}

		// Generic server error
		return json(
			{
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'Failed to retrieve document'
				}
			} satisfies DocumentErrorResponse,
			{ status: 500 }
		);
	}
};
