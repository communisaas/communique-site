import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET = (({ params }) => {
	// TODO differentiate email slugs from internal routes
	throw redirect(302, `/#${params.slug}`);
}) satisfies RequestHandler;
