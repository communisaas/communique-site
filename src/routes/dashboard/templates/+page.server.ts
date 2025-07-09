import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ fetch, locals }) => {
	const session = await locals.auth.validate();
	if (!session) {
		throw redirect(302, '/demo/lucia/login');
	}

	const response = await fetch('/api/user/templates');

	if (!response.ok) {
		return { templates: [] };
	}

	const templates = await response.json();
	return { templates };
};

export const actions: Actions = {
	publish: async ({ fetch, request }) => {
		const data = await request.formData();
		const templateId = data.get('id');

		if (!templateId) {
			return { success: false, error: 'Template ID is required' };
		}

		const response = await fetch(`/api/templates/${templateId}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				status: 'published'
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			return { success: false, error: errorData.error || 'Failed to publish template' };
		}

		return { success: true };
	}
}; 