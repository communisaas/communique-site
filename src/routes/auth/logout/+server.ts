import { redirect } from '@sveltejs/kit';
import { invalidateSession, sessionCookieName } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.session) {
		redirect(302, '/');
	}
	
	await invalidateSession(locals.session.id);
	cookies.delete(sessionCookieName, { path: '/' });
	
	redirect(302, '/');
};

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.session) {
		redirect(302, '/');
	}
	
	await invalidateSession(locals.session.id);
	cookies.delete(sessionCookieName, { path: '/' });
	
	redirect(302, '/');
}; 