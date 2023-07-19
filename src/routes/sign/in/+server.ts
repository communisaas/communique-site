import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET = (async ({ url }) => {
	const searchParams = url.searchParams.toString();
	throw redirect(302, `/#signin#${searchParams}`);
}) satisfies RequestHandler;
