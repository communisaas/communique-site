/**
 * Mail Server API: User Resolution by Email
 * Internal endpoint for mail server to resolve users
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url, request }) => {
	// Authenticate the mail server
	const authHeader = request.headers.get('authorization');
	if (!authHeader || authHeader !== `Bearer ${env.COMMUNIQUE_API_KEY}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const email = url.searchParams.get('email');
	if (!email) {
		return json({ error: 'Email parameter required' }, { status: 400 });
	}

	try {
		// Look up user by email (consolidated User model only has primary email)
		const user = await db.user.findUnique({
			where: { email: email.toLowerCase() },
			select: {
				id: true,
				email: true,
				name: true,
				street: true,
				city: true,
				state: true,
				zip: true,
				is_verified: true
			}
		});

		if (user) {
			return json({
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					street: user.street,
					city: user.city,
					state: user.state,
					zip: user.zip,
					is_verified: user.is_verified
				},
				emailType: 'primary',
				isVerified: user.is_verified
			});
		}

		// No user found
		return json({ user: null, emailType: null });
	} catch {
		console.error('Error occurred');
		return json({ error: 'Failed to resolve user' }, { status: 500 });
	}
};
