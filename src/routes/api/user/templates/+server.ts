import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ _locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userTemplates = await db.template.findMany({
			where: {
				userId: locals.user.id
			},
			orderBy: {
				updatedAt: 'desc'
			}
		});

		return json(userTemplates);
	} catch (err) {
		return json({ error: 'Failed to fetch templates' }, { status: 500 });
	}
};
