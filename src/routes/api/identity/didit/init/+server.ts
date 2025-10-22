import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVerificationSession } from '$lib/core/server/verification-sessions';

/**
 * Initialize Didit.me verification session
 * Creates session and returns verification URL for user redirect
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, templateSlug } = await request.json();

		if (!userId) {
			throw error(400, 'Missing user_id');
		}

		// Create session with Didit API
		const response = await fetch('https://verification.didit.me/v2/session/', {
			method: 'POST',
			headers: {
				'x-api-key': process.env.DIDIT_API_KEY!,
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				workflow_id: process.env.DIDIT_APP_ID,
				metadata: {
					user_id: userId,
					template_slug: templateSlug,
					timestamp: Date.now()
				},
				vendor_data: userId,
				// Redirect user back to our app after verification
				redirect_url: `${process.env.ORIGIN || 'http://localhost:5173'}/verify-complete?session_id={session_id}`
			})
		});

		if (!response.ok) {
			const errorData = await response.text();
			console.error('Didit API error:', errorData);
			throw error(500, 'Failed to create Didit session');
		}

		const data = await response.json();
		const { session_id, verification_url } = data;

		// Store session in our database
		await createVerificationSession({
			userId,
			method: 'didit',
			challenge: session_id // Store Didit session ID as challenge
		});

		return json({
			success: true,
			session_id,
			verification_url
		});
	} catch (err) {
		console.error('Didit init error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to initialize Didit verification');
	}
};
