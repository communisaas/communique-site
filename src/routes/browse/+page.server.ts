import type { PageServerLoad } from './$types';
import { db } from '$lib/core/db';
import { extractRecipientEmails } from '$lib/types/templateConfig';

export const load: PageServerLoad = async () => {
	try {
		const dbTemplates = await db.template.findMany({
			where: {
				is_public: true
			},
			orderBy: {
				createdAt: 'desc'
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

		const templates = dbTemplates.map((template) => {
			// Extract metrics from JSON field
			const jsonMetrics =
				typeof template.metrics === 'string'
					? JSON.parse(template.metrics)
					: template.metrics || {};

			return {
				id: template.id,
				slug: template.slug,
				title: template.title,
				description: template.description,
				category: template.category,
				type: template.type,
				deliveryMethod: template.deliveryMethod,
				preview: template.preview,
				message_body: template.message_body,
				subject: template.title,

				// === AGGREGATE METRICS (consistent structure) ===
				verified_sends: template.verified_sends,
				unique_districts: template.unique_districts,

				// === METRICS OBJECT (backward compatibility) ===
				metrics: {
					sent: template.verified_sends, // Use schema field as source of truth
					districts_covered: template.unique_districts, // Use schema field as source of truth
					total_districts: (jsonMetrics as { total_districts?: number }).total_districts || 435,
					district_coverage_percent:
						(jsonMetrics as { district_coverage_percent?: number }).district_coverage_percent ||
						(template.unique_districts ? Math.round((template.unique_districts / 435) * 100) : 0),
					opened: (jsonMetrics as { opened?: number }).opened || 0,
					clicked: (jsonMetrics as { clicked?: number }).clicked || 0,
					views: (jsonMetrics as { views?: number }).views || 0
				},

				// Config
				delivery_config: template.delivery_config,
				recipient_config: template.recipient_config,
				recipientEmails: extractRecipientEmails(
					typeof template.recipient_config === 'string'
						? JSON.parse(template.recipient_config)
						: template.recipient_config
				),

				// Metadata
				is_public: template.is_public,
				applicable_countries: template.applicable_countries ?? [],
				jurisdiction_level: template.jurisdiction_level ?? null,
				specific_locations: template.specific_locations ?? [],

				// Author
				author: template.user
					? {
							name: template.user.name,
							avatar: template.user.avatar
						}
					: null,

				createdAt: template.createdAt.toISOString()
			};
		});

		return {
			templates
		};
	} catch (error) {
		console.error('Browse page load error:', error);
		// Return empty array on error to prevent page crash
		return {
			templates: []
		};
	}
};
