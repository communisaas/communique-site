import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { extractRecipientEmails, extractTemplateMetrics } from '$lib/types/templateConfig';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
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

	// Fire-and-forget: view tracking should not block SSR response
	const currentMetrics = extractTemplateMetrics(template.metrics);
	db.template.update({
		where: { id: template.id },
		data: {
			metrics: {
				...currentMetrics,
				views: (currentMetrics.views || 0) + 1,
				modal_views: (currentMetrics.modal_views || 0) + 1
			}
		}
	}).catch((err) => console.warn('[template-modal] View tracking failed:', err));

	// Allow unauthenticated access via QR code / direct link
	// Users can send via mailto FIRST, then we prompt account creation
	// This removes friction for viral template sharing

	// Format template for client
	const formattedTemplate = {
		id: template.id,
		slug: template.slug,
		title: template.title,
		description: template.description,
		category: template.category,
		type: template.type,
		deliveryMethod: template.deliveryMethod,
		subject: template.title,
		message_body: template.message_body,
		preview: template.preview,
		metrics: extractTemplateMetrics(template.metrics),
		delivery_config: template.delivery_config,
		recipient_config: (template.recipient_config as Record<string, unknown>) ?? undefined,
		recipientEmails: extractRecipientEmails(template.recipient_config),
		author: template.user
			? {
					name: template.user.name,
					avatar: template.user.avatar
				}
			: null,
		createdAt: template.createdAt.toISOString()
	};

	return {
		template: formattedTemplate,
		user: locals.user,
		modalMode: true
	};
};
