import { error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { slug } = params;
	
	// Fetch complete template data - no redirect needed
	const template = await db.template.findUnique({
		where: { 
			slug,
			is_public: true
		}
	});
	
	if (!template) {
		throw error(404, 'Template not found');
	}
	
	return {
		template,
		user: locals.user
	};
};