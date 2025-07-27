import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const session = await locals.auth.validate();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userTemplates = await db.template.findMany({
			where: {
				userId: session.user.id
			},
			orderBy: {
				updatedAt: 'desc'
			}
		});

		return json(userTemplates);
	} catch (error) {
		return json({ error: 'Failed to fetch templates' }, { status: 500 });
	}
}; 