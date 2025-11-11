/**
 * Didit.me Verification Initialization Endpoint
 *
 * Creates a new verification session with Didit.me and returns the URL
 * for the user to complete identity verification.
 *
 * API Documentation: https://docs.didit.me/reference/create-session-verification-sessions
 *
 * Flow:
 * 1. Client calls this endpoint with userId and templateSlug
 * 2. Server creates session with Didit.me API (POST /v2/session/)
 * 3. Returns verification URL for user redirect
 * 4. User completes verification on Didit.me
 * 5. Didit.me sends webhook to /api/identity/didit/webhook with results
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const { userId, templateSlug } = await request.json();

		if (!userId) {
			throw error(400, 'Missing userId');
		}

		// Validate Didit.me configuration
		const apiKey = process.env.DIDIT_API_KEY;
		const workflowId = process.env.DIDIT_WORKFLOW_ID;

		if (!apiKey) {
			console.error('[Didit.me] DIDIT_API_KEY not configured');
			throw error(500, 'Didit.me integration not configured');
		}

		if (!workflowId) {
			console.error('[Didit.me] DIDIT_WORKFLOW_ID not configured');
			throw error(500, 'Didit.me workflow not configured');
		}

		// Construct webhook callback URL
		const protocol = url.protocol === 'http:' && url.hostname === 'localhost' ? 'http:' : 'https:';
		const callbackUrl = `${protocol}//${url.host}/api/identity/didit/webhook`;

		// Prepare session request (API documentation compliant)
		const sessionRequest = {
			workflow_id: workflowId,
			callback: callbackUrl,
			vendor_data: userId, // Use userId for mapping webhook events
			metadata: {
				template_slug: templateSlug || '',
				initiated_at: new Date().toISOString()
			}
		};

		console.log('[Didit.me] Creating verification session:', {
			workflow_id: sessionRequest.workflow_id,
			callback: sessionRequest.callback,
			vendor_data: sessionRequest.vendor_data
		});

		// Create verification session with Didit.me API
		const response = await fetch('https://verification.didit.me/v2/session/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey
			},
			body: JSON.stringify(sessionRequest)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[Didit.me] Session creation failed:', {
				status: response.status,
				statusText: response.statusText,
				error: errorText
			});
			throw error(response.status, 'Failed to create verification session');
		}

		const sessionData = await response.json();

		console.log('[Didit.me] Session created successfully:', {
			session_id: sessionData.session_id,
			session_number: sessionData.session_number,
			status: sessionData.status
		});

		// Return verification URL and session details to client
		return json({
			success: true,
			verificationUrl: sessionData.url,
			sessionId: sessionData.session_id,
			sessionToken: sessionData.session_token,
			status: sessionData.status
		});
	} catch (err) {
		console.error('[Didit.me] Initialization error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to initialize Didit verification');
	}
};
