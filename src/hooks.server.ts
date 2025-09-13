import { dev } from '$app/environment';
import * as auth from '$lib/core/auth/auth.js';
import type { Handle } from '@sveltejs/kit';

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(auth.sessionCookieName);
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await auth.validateSession(sessionId);
	if (session) {
		event.cookies.set(auth.sessionCookieName, session.id, {
			path: '/',
			sameSite: 'lax',
			httpOnly: true,
			expires: session.expiresAt,
			secure: !dev
		});
	} else {
		event.cookies.delete(auth.sessionCookieName, { path: '/' });
	}

	event.locals.user = user ? {
		id: user.id,
		email: user.email,
		name: user.name,
		street: user.street,
		city: user.city,
		state: user.state,
		zip: user.zip,
		congressional_district: user.congressional_district,
		is_verified: user.is_verified,
		is_active: true, // Default since field doesn't exist in schema
		is_banned: false, // Default since field doesn't exist in schema
		is_admin: false, // Default since field doesn't exist in schema
		profile_picture: user.avatar,
		phone: user.phone,
		role: user.role,
		organization: user.organization,
		location: user.location,
		connection: user.connection,
		connection_details: user.connection_details,
		profile_completed_at: user.profile_completed_at,
		profile_visibility: user.profile_visibility,
		verification_method: user.verification_method,
		verified_at: user.verified_at,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt
	} : null;
	event.locals.session = session;

	return resolve(event);
};

export const handle = handleAuth;
