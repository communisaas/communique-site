import { error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { extractRecipientEmails, extractTemplateMetrics } from '$lib/types/templateConfig';
import type { LayoutServerLoad } from './$types';
import { detectCountryFromHeaders, resolveChannel } from '$lib/services/channelResolver';
import { FEATURES } from '$lib/config/features';

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

	// Gate CWC templates behind CONGRESSIONAL feature flag
	if (!FEATURES.CONGRESSIONAL && template.deliveryMethod === 'cwc') {
		throw error(404, 'Template not found');
	}

	// Fire-and-forget: view tracking should not block SSR response
	const currentMetrics = extractTemplateMetrics(template.metrics);
	db.template.update({
		where: { id: template.id },
		data: {
			metrics: {
				...currentMetrics,
				views: (currentMetrics.views || 0) + 1
			}
		}
	}).catch((err) => console.warn('[slug layout] View tracking failed:', err));

	// Detect country and resolve channel
	const detectedCountry = detectCountryFromHeaders(request.headers) || 'US';
	const channelInfo = await resolveChannel(detectedCountry);

	// Reuse currentMetrics (already extracted above for view tracking)
	const jsonMetrics = currentMetrics;

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
		sources: template.sources || [],
		research_log: template.research_log || [],
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
