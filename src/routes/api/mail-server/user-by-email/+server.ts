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
		// First check primary email
		let user = await db.user.findUnique({
			where: { email: email.toLowerCase() },
			select: {
				id: true,
				email: true,
				name: true,
				street: true,
				city: true,
				state: true,
				zip: true,
				is_verified: true,
				secondary_emails: {
					where: { email: email.toLowerCase() },
					select: {
						email: true,
						isVerified: true
					}
				}
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
				isVerified: true // Primary email is always verified
			});
		}

		// Check secondary emails
		const userEmail = await db.userEmail.findUnique({
			where: { email: email.toLowerCase() },
			include: {
				user: {
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
				}
			}
		});

		if (userEmail) {
			return json({
				user: {
					id: userEmail.user.id,
					email: userEmail.user.email,
					name: userEmail.user.name,
					street: userEmail.user.street,
					city: userEmail.user.city,
					state: userEmail.user.state,
					zip: userEmail.user.zip,
					is_verified: userEmail.user.is_verified
				},
				emailType: 'secondary',
				isVerified: userEmail.isVerified,
				secondaryEmail: userEmail.email
			});
		}

		// No user found
		return json({ user: null, emailType: null });

	} catch (error) {
		console.error('Error resolving user by email:', error);
		return json(
			{ error: 'Failed to resolve user' },
			{ status: 500 }
		);
	}
};