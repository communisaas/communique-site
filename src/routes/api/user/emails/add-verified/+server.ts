/**
 * Add Verified Email Endpoint
 * Handles auto-verified email addition from bounce flow
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifySignedToken } from '$lib/core/auth/tokens';
import { db } from '$lib/core/db';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url, locals }) => {
	const token = url.searchParams.get('token');
	const redirectPath = url.searchParams.get('redirect');

	if (!token) {
		throw redirect(302, '/settings/emails?error=missing_token');
	}

	try {
		// Verify the signed token
		const payload = await verifySignedToken<{
			email: string;
			userId: string;
			templateSlug?: string;
			timestamp: number;
			purpose: string;
		}>(token, {
			secret: env.EMAIL_VERIFICATION_SECRET || env.JWT_SECRET || 'development-secret',
			maxAge: 24 * 60 * 60 // 24 hours
		});

		// Validate token purpose
		if (payload.purpose !== 'email_verification') {
			throw new Error('Invalid token purpose');
		}

		// Check if email already exists for this user
		const existingEmail = await db.userEmail.findFirst({
			where: {
				email: payload.email.toLowerCase(),
				userId: payload.userId
			}
		});

		if (existingEmail) {
			// Email already added, just ensure it's verified
			if (!existingEmail.isVerified) {
				await db.userEmail.update({
					where: { id: existingEmail.id },
					data: {
						isVerified: true,
						verifiedAt: new Date()
					}
				});
			}
		} else {
			// Check if this email belongs to another user
			const emailInUse = await db.user.findUnique({
				where: { email: payload.email.toLowerCase() }
			});

			if (emailInUse) {
				throw redirect(302, '/settings/emails?error=email_in_use');
			}

			// Check secondary emails of other users
			const secondaryInUse = await db.userEmail.findFirst({
				where: {
					email: payload.email.toLowerCase(),
					NOT: { userId: payload.userId }
				}
			});

			if (secondaryInUse) {
				throw redirect(302, '/settings/emails?error=email_in_use');
			}

			// Add and auto-verify the email
			await db.userEmail.create({
				data: {
					userId: payload.userId,
					email: payload.email.toLowerCase(),
					isVerified: true,
					verifiedAt: new Date(),
					isPrimary: false
				}
			});
		}

		// Log the verification event
		await db.auditLog.create({
			data: {
				user_id: payload.userId,
				action: 'email_added_via_bounce',
				metadata: {
					email: payload.email,
					method: 'bounce_link',
					templateSlug: payload.templateSlug
				},
				created_at: new Date()
			}
		});

		// Redirect to the appropriate location
		const destination =
			redirectPath ||
			(payload.templateSlug
				? `/s/${payload.templateSlug}?email_added=true`
				: '/settings/emails?success=email_added');

		throw redirect(302, destination);
	} catch (error) {
		console.error('Email verification error:', error);

		// If it's already a redirect, pass it through
		if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
			throw error;
		}

		// Otherwise redirect to error page
		throw redirect(302, '/settings/emails?error=invalid_token');
	}
};
