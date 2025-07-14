import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const { slug } = params;
	
	// Look up template by slug
	const template = await db.template.findUnique({
		where: { 
			slug,
			is_public: true // Only show public templates via deep links
		},
		include: {
			user: {
				select: {
					name: true,
					avatar: true
				}
			}
		}
	});
	
	if (!template) {
		throw error(404, 'Template not found');
	}
	
	// Track template modal view
	await db.template.update({
		where: { id: template.id },
		data: {
			metrics: {
				...(template.metrics as any),
				views: ((template.metrics as any)?.views || 0) + 1,
				modal_views: ((template.metrics as any)?.modal_views || 0) + 1
			}
		}
	});
	
	// Check if user is authenticated
	if (!locals.user) {
		// Redirect to main template page with auth prompt
		throw redirect(302, `/${slug}?auth=required&source=modal`);
	}
	
	// Format template for client
	const formattedTemplate = {
		id: template.id,
		slug: template.slug,
		title: template.title,
		description: template.description,
		category: template.category,
		type: template.type,
		deliveryMethod: template.deliveryMethod,
		subject: template.subject,
		message_body: template.message_body,
		preview: template.preview,
		metrics: template.metrics as any,
		delivery_config: template.delivery_config,
		recipient_config: template.recipient_config,
		recipientEmails: (template.recipient_config as any)?.emails as string[] | undefined,
		author: template.user ? {
			name: template.user.name,
			avatar: template.user.avatar
		} : null,
		createdAt: template.createdAt.toISOString()
	};
	
	return {
		template: formattedTemplate,
		user: locals.user,
		modalMode: true
	};
};