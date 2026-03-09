import { redirect } from '@sveltejs/kit';
import { loadOrgContext } from '$lib/server/org';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, `/auth/google?returnTo=/org/${params.slug}`);
	}

	const { org, membership } = await loadOrgContext(params.slug, locals.user.id);

	return { org, membership };
};
