import { error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { extractRecipientEmails, extractTemplateMetrics } from '$lib/types/templateConfig';
import type { LayoutServerLoad } from './$types';
import { detectCountryFromHeaders, resolveChannel } from '$lib/services/channelResolver';

export const load: LayoutServerLoad = async ({ params, locals: _locals, request }) => {
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

	// Extract metrics from JSON field
	const jsonMetrics = extractTemplateMetrics(template.metrics);

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
		is_public: template.is_public,

		// === AGGREGATE METRICS (consistent with schema) ===
		verified_sends: template.verified_sends,
		unique_districts: template.unique_districts,

		// === METRICS OBJECT (backward compatibility) ===
		metrics: {
			sent: template.verified_sends, // Use schema field as source of truth
			districts_covered: template.unique_districts, // Use schema field as source of truth
			total_districts: jsonMetrics.total_districts || 435,
			district_coverage_percent:
				jsonMetrics.district_coverage_percent ||
				(template.unique_districts ? Math.round((template.unique_districts / 435) * 100) : 0),
			opened: jsonMetrics.opened || 0,
			clicked: jsonMetrics.clicked || 0,
			responded: jsonMetrics.responded || 0,
			views: jsonMetrics.views || 0
		},

		delivery_config: template.delivery_config,
		recipient_config: template.recipient_config,
		recipientEmails: extractRecipientEmails(template.recipient_config),
		applicable_countries: template.applicable_countries ?? [],
		jurisdiction_level: template.jurisdiction_level ?? null,
		specific_locations: template.specific_locations ?? [],
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
		channel: channelInfo
	};
};
