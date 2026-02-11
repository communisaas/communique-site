import type { PageServerLoad } from './$types';
import { db } from '$lib/core/db';
import { extractRecipientEmails } from '$lib/types/templateConfig';
import { z } from 'zod';

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

		// Zod schema for metrics validation
		const MetricsSchema = z
			.object({
				total_districts: z.number().optional(),
				district_coverage_percent: z.number().optional(),
				opened: z.number().optional(),
				clicked: z.number().optional(),
				views: z.number().optional()
			})
			.passthrough();

		const templates = dbTemplates.map((template) => {
			// Extract metrics from JSON field with validation
			let jsonMetrics = {};
			if (typeof template.metrics === 'string') {
				try {
					const parsed = JSON.parse(template.metrics);
					const result = MetricsSchema.safeParse(parsed);
					if (result.success) {
						jsonMetrics = result.data;
					} else {
						console.warn(
							`[Browse Page] Invalid metrics for template ${template.id}:`,
							result.error.flatten()
						);
					}
				} catch (error) {
					console.warn(`[Browse Page] Failed to parse metrics for template ${template.id}:`, error);
				}
			} else {
				const result = MetricsSchema.safeParse(template.metrics || {});
				if (result.success) {
					jsonMetrics = result.data;
				} else {
					console.warn(
						`[Browse Page] Invalid metrics object for template ${template.id}:`,
						result.error.flatten()
					);
				}
			}

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
				recipientEmails: (() => {
					// Validate and parse recipient_config
					const RecipientConfigSchema = z.unknown();
					let recipientConfig = null;

					if (typeof template.recipient_config === 'string') {
						try {
							const parsed = JSON.parse(template.recipient_config);
							const result = RecipientConfigSchema.safeParse(parsed);
							recipientConfig = result.success ? result.data : null;
						} catch (error) {
							console.warn(
								`[Browse Page] Failed to parse recipient_config for template ${template.id}:`,
								error
							);
						}
					} else {
						const result = RecipientConfigSchema.safeParse(template.recipient_config);
						recipientConfig = result.success ? result.data : null;
					}

					return extractRecipientEmails(recipientConfig);
				})(),

				// Geographic targeting
				applicable_countries: (template as any).applicable_countries ?? [],
				jurisdiction_level: (template as any).jurisdiction_level ?? null,
				specific_locations: (template as any).specific_locations ?? [],

				// Metadata
				is_public: template.is_public,

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
