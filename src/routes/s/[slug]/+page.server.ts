import { redirect, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { funnelAnalytics } from '$lib/core/analytics/funnel';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const { slug } = params;
	
	// Validate template exists and is public
	const template = await db.template.findUnique({
		where: { 
			slug,
			is_public: true
		},
		select: {
			id: true,
			slug: true,
			deliveryMethod: true
		}
	});
	
	if (!template) {
		throw error(404, 'Template not found');
	}
	
	// Track share link click analytically
	await funnelAnalytics.trackTemplateView(template.id, 'share');
	
	// Build redirect URL with clean parameters
	const redirectUrl = new URL(`/${slug}`, url.origin);
	
	// Add source parameter for analytics
	redirectUrl.searchParams.set('source', 'share');
	
	// Add action=send to trigger immediate email flow
	redirectUrl.searchParams.set('action', 'send');
	
	// If user is not authenticated, add auth hint
	if (!locals.user) {
		redirectUrl.searchParams.set('auth', 'required');
	} else if (template.deliveryMethod === 'both') {
		// For congressional templates, check if user has address
		const hasCompleteAddress = Boolean(
			locals.user.street && 
			locals.user.city && 
			locals.user.state && 
			locals.user.zip
		);
		
		if (!hasCompleteAddress) {
			redirectUrl.searchParams.set('needs', 'address');
		}
	}
	
	// Redirect to main template page with parameters
	throw redirect(302, redirectUrl.toString());
};