import { find } from '$lib/data/database';
import { error } from '@sveltejs/kit';

function isUUID(s: string) {
	return new RegExp(
		'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
	).test(s);
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const whereCriteria: Criteria = {};

	if (isUUID(params.slug)) {
		whereCriteria.rowid = { equals: params.slug };
	} else {
		whereCriteria.shortid = { equals: params.slug };
	}

	const options = { where: whereCriteria };
	const email = await find('email', options);
	return new Response(JSON.stringify(email[0]));
}
