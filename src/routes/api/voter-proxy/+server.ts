/**
 * VOTER Protocol API Proxy
 * 
 * Proxies requests from browser to VOTER Protocol backend
 * Handles authentication and CORS
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const VOTER_API_URL = env.VOTER_API_URL || 'http://localhost:8000';
const VOTER_API_KEY = env.VOTER_API_KEY || '';

// Proxy all requests to VOTER Protocol
export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Get the path after /api/voter-proxy
		const path = url.pathname.replace('/api/voter-proxy', '');
		
		// Get request body
		const body = await request.json();
		
		// Forward to VOTER Protocol
		const response = await fetch(`${VOTER_API_URL}${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': VOTER_API_KEY,
				// Forward user address if present
				...(request.headers.get('X-User-Address') && {
					'X-User-Address': request.headers.get('X-User-Address')!
				})
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw error(response.status, errorText || 'VOTER API error');
		}

		const data = await response.json();
		return json(data);

	} catch (err) {
		console.error('[VOTER Proxy] Error:', err);
		
		if (err instanceof Response) {
			throw err;
		}
		
		throw error(500, 'Failed to proxy request to VOTER Protocol');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Get the path after /api/voter-proxy
		const path = url.pathname.replace('/api/voter-proxy', '');
		
		// Forward to VOTER Protocol
		const response = await fetch(`${VOTER_API_URL}${path}`, {
			method: 'GET',
			headers: {
				'X-API-Key': VOTER_API_KEY
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw error(response.status, errorText || 'VOTER API error');
		}

		const data = await response.json();
		return json(data);

	} catch (err) {
		console.error('[VOTER Proxy] Error:', err);
		
		if (err instanceof Response) {
			throw err;
		}
		
		throw error(500, 'Failed to proxy request to VOTER Protocol');
	}
};