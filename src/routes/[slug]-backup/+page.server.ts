import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get template and channel data from parent layout
	const parentData = await parent();

	return {
		user: locals.user,
		// Template and channel are already loaded in layout
		template: parentData.template,
		channel: parentData.channel
	};
};