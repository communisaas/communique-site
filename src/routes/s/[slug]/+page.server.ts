import { error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { extractRecipientEmails, extractTemplateMetrics } from '$lib/types/templateConfig';
import type { PageServerLoad } from './$types';
import { detectCountryFromHeaders, resolveChannel } from '$lib/services/channelResolver';

export const load: PageServerLoad = async ({ params, locals, request }) => {
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

	// Track template view (increment metrics)
	await db.template.update({
		where: { id: template.id },
		data: {
			metrics: {
				...extractTemplateMetrics(template.metrics),
				views: (extractTemplateMetrics(template.metrics).views || 0) + 1
			}
		}
	});

	// Detect country and resolve channel
	const detectedCountry = detectCountryFromHeaders(request.headers) || 'US';
	const channelInfo = await resolveChannel(detectedCountry);

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
		is_public: template.is_public,
		metrics: extractTemplateMetrics(template.metrics),
		delivery_config: template.delivery_config,
		recipient_config: template.recipient_config,
		recipientEmails: extractRecipientEmails(template.recipient_config),
		applicable_countries: (template as any).applicable_countries ?? [],
		jurisdiction_level: (template as any).jurisdiction_level ?? null,
		specific_locations: (template as any).specific_locations ?? [],
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
		channel: channelInfo
	};
};
