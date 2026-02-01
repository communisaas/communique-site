import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { extractRecipientEmails } from '$lib/types/templateConfig';
import {
	createApiError,
	createValidationError,
	type ApiResponse,
	type ApiError
} from '$lib/types/errors';
import type { Prisma as _Prisma } from '@prisma/client';
import type { UnknownRecord } from '$lib/types/any-replacements';
import { moderateTemplate } from '$lib/core/server/moderation';
import { generateBatchEmbeddings } from '$lib/core/search/gemini-embeddings';
import { z } from 'zod';

// Import GeoScope for agent-extracted geographic scope
import type { GeoScope } from '$lib/core/agents/types';

// Validation schema for template creation - matches Prisma schema field names
interface CreateTemplateRequest {
	title: string;
	slug?: string; // HACKATHON: Accept slug from AI agent (don't regenerate)
	message_body: string;
	sources?: Array<{ num: number; title: string; url: string; type: string }>; // Citation sources from AI agent
	research_log?: string[]; // Agent's research process log
	category?: string;
	topics?: string[]; // Topic tags from AI (1-5 lowercase strings for search/filtering)
	type: string;
	deliveryMethod: string; // Prisma field name (mapped to delivery_method in database)
	preview: string;
	description?: string;
	status?: string;
	is_public?: boolean;
	delivery_config?: UnknownRecord;
	cwc_config?: UnknownRecord;
	recipient_config?: UnknownRecord;
	metrics?: UnknownRecord;
	geographic_scope?: GeoScope; // Agent-extracted geographic scope for TemplateScope creation
}

type ValidationError = ApiError;

function validateTemplateData(data: unknown): {
	isValid: boolean;
	errors: ValidationError[];
	validData?: CreateTemplateRequest;
} {
	const errors: ValidationError[] = [];

	if (!data || typeof data !== 'object') {
		errors.push(createValidationError('body', 'VALIDATION_REQUIRED', 'Invalid request body'));
		return { isValid: false, errors };
	}

	const templateData = data as Record<string, unknown>;

	// Required fields validation
	if (!templateData.title || typeof templateData.title !== 'string' || !templateData.title.trim()) {
		errors.push(
			createValidationError('title', 'VALIDATION_REQUIRED', 'Template title is required')
		);
	} else if (templateData.title.length > 500) {
		// HACKATHON: Increased from 200 to 500 for generous limits
		errors.push(
			createValidationError(
				'title',
				'VALIDATION_TOO_LONG',
				'Title must be less than 500 characters'
			)
		);
	}

	if (
		!templateData.message_body ||
		typeof templateData.message_body !== 'string' ||
		!templateData.message_body.trim()
	) {
		errors.push(
			createValidationError('message_body', 'VALIDATION_REQUIRED', 'Message content is required')
		);
	} else if (templateData.message_body.length > 50000) {
		// HACKATHON: Increased from 10,000 to 50,000 for generous limits
		errors.push(
			createValidationError(
				'message_body',
				'VALIDATION_TOO_LONG',
				'Message must be less than 50,000 characters'
			)
		);
	}

	if (
		!templateData.preview ||
		typeof templateData.preview !== 'string' ||
		!templateData.preview.trim()
	) {
		errors.push(
			createValidationError('preview', 'VALIDATION_REQUIRED', 'Preview text is required')
		);
	} else if (templateData.preview.length > 500) {
		errors.push(
			createValidationError(
				'preview',
				'VALIDATION_TOO_LONG',
				'Preview must be less than 500 characters'
			)
		);
	}

	if (!templateData.type || typeof templateData.type !== 'string') {
		errors.push(createValidationError('type', 'VALIDATION_REQUIRED', 'Template type is required'));
	}

	if (!templateData.deliveryMethod || typeof templateData.deliveryMethod !== 'string') {
		errors.push(
			createValidationError('deliveryMethod', 'VALIDATION_REQUIRED', 'Delivery method is required')
		);
	}

	if (errors.length > 0) {
		return { isValid: false, errors };
	}

	// Return valid data with defaults
	const validData: CreateTemplateRequest = {
		title: templateData.title as string,
		slug: (templateData.slug as string) || undefined, // HACKATHON: Extract slug from request
		message_body: templateData.message_body as string,
		sources:
			(templateData.sources as Array<{ num: number; title: string; url: string; type: string }>) ||
			[],
		research_log: (templateData.research_log as string[]) || [],
		preview: templateData.preview as string,
		type: templateData.type as string,
		deliveryMethod: templateData.deliveryMethod as string,
		category: (templateData.category as string) || 'General',
		topics: (templateData.topics as string[]) || [],
		description:
			(templateData.description as string) ||
			(templateData.preview as string)?.substring(0, 160) ||
			'',
		status: (templateData.status as string) || 'draft',
		is_public: Boolean(templateData.is_public) || false,
		delivery_config: (templateData.delivery_config as UnknownRecord) || {},
		cwc_config: (templateData.cwc_config as UnknownRecord) || {},
		recipient_config: (templateData.recipient_config as UnknownRecord) || {},
		metrics: (templateData.metrics as UnknownRecord) || {
			sent: 0,
			opened: 0,
			clicked: 0,
			views: 0
		},
		geographic_scope: (templateData.geographic_scope as GeoScope) || undefined
	};

	return { isValid: true, errors: [], validData };
}

// Zod schema for metrics validation (shared by GET and POST)
const MetricsSchema = z
	.object({
		opened: z.number().optional(),
		clicked: z.number().optional(),
		responded: z.number().optional(),
		views: z.number().optional(),
		total_districts: z.number().optional(),
		district_coverage_percent: z.number().optional(),
		personalization_rate: z.number().optional(),
		effectiveness_score: z.number().optional(),
		cascade_depth: z.number().optional(),
		viral_coefficient: z.number().optional(),
		funnel_views: z.number().optional(),
		modal_views: z.number().optional(),
		onboarding_starts: z.number().optional(),
		onboarding_completes: z.number().optional(),
		auth_completions: z.number().optional(),
		shares: z.number().optional()
	})
	.passthrough();

/**
 * Format a raw Prisma template for client consumption.
 * Adds computed fields required by the Template interface:
 * - coordinationScale: 0-1 logarithmic scale based on verified_sends
 * - isNew: true if created within last 7 days
 * - send_count: mapped from verified_sends for frontend compatibility
 */
function formatTemplateForClient(
	template: {
		id: string;
		slug: string;
		title: string;
		description: string | null;
		category: string;
		topics: unknown;
		type: string;
		deliveryMethod: string;
		message_body: string;
		preview: string;
		verified_sends: number;
		unique_districts: number;
		metrics: unknown;
		delivery_config: unknown;
		cwc_config: unknown;
		recipient_config: unknown;
		campaign_id: string | null;
		status: string;
		is_public: boolean;
		createdAt: Date;
		jurisdictions?: unknown[];
		applicable_countries?: string[] | null;
		specific_locations?: string[] | null;
		jurisdiction_level?: string | null;
	},
	scope?: UnknownRecord | null
) {
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
					`[Templates API] Invalid metrics for template ${template.id}:`,
					result.error.flatten()
				);
			}
		} catch (error) {
			console.warn(`[Templates API] Failed to parse metrics for template ${template.id}:`, error);
		}
	} else {
		const result = MetricsSchema.safeParse(template.metrics || {});
		if (result.success) {
			jsonMetrics = result.data;
		} else {
			console.warn(
				`[Templates API] Invalid metrics object for template ${template.id}:`,
				result.error.flatten()
			);
		}
	}

	// Calculate coordination scale (0-1 range, logarithmic for perceptual encoding)
	// 1 send = 0.0, 10 sends = 0.33, 100 sends = 0.67, 1000+ sends = 1.0
	const sendCount = template.verified_sends || 0;
	const coordinationScale = Math.min(1.0, Math.log10(Math.max(1, sendCount)) / 3);

	// Determine if template is "new" (created in last 7 days)
	const createdAt = new Date(template.createdAt);
	const now = new Date();
	const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
	const isNew = daysSinceCreation <= 7;

	return {
		id: template.id,
		slug: template.slug,
		title: template.title,
		description: template.description || '',
		category: template.category,
		topics: (template.topics as string[]) || [],
		type: template.type,
		deliveryMethod: template.deliveryMethod,
		subject: template.title,
		message_body: template.message_body,
		preview: template.preview,

		// === PERCEPTUAL ENCODING PROPERTIES ===
		coordinationScale, // 0-1 scale for visual weight (card size)
		isNew, // Temporal signal for "New" badge

		// === AGGREGATE METRICS (consistent with schema) ===
		verified_sends: template.verified_sends, // Integer field from schema
		unique_districts: template.unique_districts, // Integer field from schema
		send_count: template.verified_sends, // Frontend compatibility (mapped from verified_sends)

		// === METRICS OBJECT (backward compatibility + JSON fields) ===
		metrics: {
			// Aggregate fields (single source of truth)
			sent: template.verified_sends, // Use schema field as source of truth
			districts_covered: template.unique_districts, // Use schema field as source of truth

			// JSON-only metrics (not in schema as integers)
			opened: (jsonMetrics as { opened?: number }).opened || 0,
			clicked: (jsonMetrics as { clicked?: number }).clicked || 0,
			responded: (jsonMetrics as { responded?: number }).responded || 0,
			views: (jsonMetrics as { views?: number }).views || 0,

			// Congressional-specific (fallback to JSON if not in aggregate)
			total_districts: (jsonMetrics as { total_districts?: number }).total_districts || 435,
			district_coverage_percent:
				(jsonMetrics as { district_coverage_percent?: number }).district_coverage_percent ||
				(template.unique_districts ? Math.round((template.unique_districts / 435) * 100) : 0),

			// AI/Analytics metrics from JSON
			personalization_rate:
				(jsonMetrics as { personalization_rate?: number }).personalization_rate || 0,
			effectiveness_score: (jsonMetrics as { effectiveness_score?: number }).effectiveness_score,
			cascade_depth: (jsonMetrics as { cascade_depth?: number }).cascade_depth,
			viral_coefficient: (jsonMetrics as { viral_coefficient?: number }).viral_coefficient,

			// Funnel tracking metrics from JSON
			funnel_views: (jsonMetrics as { funnel_views?: number }).funnel_views,
			modal_views: (jsonMetrics as { modal_views?: number }).modal_views,
			onboarding_starts: (jsonMetrics as { onboarding_starts?: number }).onboarding_starts,
			onboarding_completes: (jsonMetrics as { onboarding_completes?: number }).onboarding_completes,
			auth_completions: (jsonMetrics as { auth_completions?: number }).auth_completions,
			shares: (jsonMetrics as { shares?: number }).shares
		},

		delivery_config: template.delivery_config,
		cwc_config: template.cwc_config,
		recipient_config: template.recipient_config,
		campaign_id: template.campaign_id,
		status: template.status,
		is_public: template.is_public,

		// Jurisdictions for location filtering (Phase 3)
		jurisdictions: template.jurisdictions || [],

		// Optional scope from separate table
		scope: scope || null,

		// Legacy fields for backward compatibility
		applicable_countries: template.applicable_countries || null,
		specific_locations: template.specific_locations || null,
		jurisdiction_level: template.jurisdiction_level || null,

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
						`[Templates API] Failed to parse recipient_config for template ${template.id}:`,
						error
					);
				}
			} else {
				const result = RecipientConfigSchema.safeParse(template.recipient_config);
				recipientConfig = result.success ? result.data : null;
			}

			return extractRecipientEmails(recipientConfig);
		})()
	};
}

export const GET: RequestHandler = async () => {
	try {
		const dbTemplates = await db.template.findMany({
			where: {
				is_public: true
			},
			orderBy: {
				createdAt: 'desc'
			},
			include: {
				jurisdictions: true // Include jurisdictions for location filtering
			}
		});

		// Include template scopes - handle if table doesn't exist
		let scopes: UnknownRecord[] = [];
		try {
			// Check if template_scope table exists in the db schema
			if ('template_scope' in db) {
				scopes = await (
					db as unknown as {
						template_scope: { findMany: (params: unknown) => Promise<UnknownRecord[]> };
					}
				).template_scope.findMany({
					where: { template_id: { in: dbTemplates.map((t) => t.id) } }
				});
			}
		} catch (error) {
			// template_scope table might not exist, continue without scopes
			console.warn('template_scope table not found, continuing without scopes');
		}

		const idToScope = new Map(scopes.map((s) => [s.template_id, s]));

		// Use shared formatting helper for consistency between GET and POST
		const formattedTemplates = dbTemplates.map((template) =>
			formatTemplateForClient(template, idToScope.get(template.id))
		);

		const response: ApiResponse = {
			success: true,
			data: formattedTemplates
		};

		return json(response);
	} catch (error) {
		console.error('Templates API error:', error);
		console.error('Error details:', {
			message: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			name: error instanceof Error ? error.name : undefined
		});

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_DATABASE', 'Failed to fetch templates')
		};

		return json(response, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse request body
		let requestData: unknown;
		try {
			requestData = await request.json();
		} catch (error) {
			const response: ApiResponse = {
				success: false,
				error: createApiError(
					'validation',
					'VALIDATION_INVALID_FORMAT',
					'Invalid JSON in request body'
				)
			};
			return json(response, { status: 400 });
		}

		// Validate template data
		const validation = validateTemplateData(requestData);
		if (!validation.isValid) {
			const response: ApiResponse = {
				success: false,
				errors: validation.errors
			};
			return json(response, { status: 400 });
		}

		// validData is guaranteed to exist when isValid is true
		if (!validation.validData) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'VALIDATION_MISSING_DATA', 'Validation passed but data is missing')
			};
			return json(response, { status: 400 });
		}
		const validData = validation.validData;

		// === 2-LAYER CONTENT MODERATION (Llama Guard 4 + Gemini) ===
		// Layer 1: Llama Guard 4 (MLCommons S1-S14 hazard taxonomy)
		//   - Elections (S13), Defamation (S5), specialized for civic content
		//   - 14,400 free requests/day via GROQ
		// Layer 2: Gemini 2.5 Flash (quality assessment)
		//   - Policy relevance, professionalism, congressional appropriateness
		let consensusResult;

		try {
			const moderationResult = await moderateTemplate({
				title: validData.title,
				message_body: validData.message_body,
				category: validData.category
			});

			if (!moderationResult.approved) {
				// Determine error type based on which layer rejected
				const isSafetyRejection = !moderationResult.safety?.safe;
				const errorCode = isSafetyRejection ? 'CONTENT_FLAGGED' : 'QUALITY_REJECTED';

				console.log(`Moderation REJECTED template (${isSafetyRejection ? 'safety' : 'quality'}):`, {
					hazards: moderationResult.safety?.hazards,
					summary: moderationResult.summary,
					latencyMs: moderationResult.latency_ms
				});

				const response: ApiResponse = {
					success: false,
					error: createValidationError('message_body', errorCode, moderationResult.summary)
				};
				return json(response, { status: 400 });
			}

			// Convert to legacy format for backward compatibility with DB storage
			// Inline conversion (deprecated function removed)
			const votes = [];
			if (moderationResult.prompt_guard) {
				votes.push({
					agent: 'prompt-guard',
					approved: moderationResult.prompt_guard.safe,
					confidence: 1.0 - moderationResult.prompt_guard.score,
					reasoning: moderationResult.prompt_guard.safe
						? 'No prompt injection detected'
						: `Injection detected (${(moderationResult.prompt_guard.score * 100).toFixed(1)}%)`,
					timestamp: moderationResult.prompt_guard.timestamp
				});
			}
			if (moderationResult.safety) {
				votes.push({
					agent: 'llama-guard',
					approved: moderationResult.safety.safe,
					confidence: moderationResult.safety.safe ? 1.0 : 0.0,
					reasoning: moderationResult.safety.reasoning,
					timestamp: moderationResult.safety.timestamp
				});
			}
			if (moderationResult.quality) {
				votes.push({
					agent: 'gemini',
					approved: moderationResult.quality.approved,
					confidence: moderationResult.quality.confidence,
					reasoning: moderationResult.quality.reasoning,
					timestamp: moderationResult.quality.timestamp
				});
			}
			const approvedCount = votes.filter((v) => v.approved).length;
			const consensusType =
				approvedCount === votes.length ? 'unanimous' : approvedCount === 0 ? 'unanimous' : 'split';

			consensusResult = {
				approved: moderationResult.approved,
				consensus_type: consensusType,
				votes,
				final_confidence:
					moderationResult.quality?.confidence ?? (moderationResult.safety?.safe ? 1.0 : 0.0),
				reasoning_summary: moderationResult.summary,
				timestamp: new Date().toISOString()
			};

			console.log('Moderation APPROVED template:', {
				safetyModel: moderationResult.safety?.model,
				qualityModel: moderationResult.quality?.model,
				confidence: moderationResult.quality?.confidence,
				latencyMs: moderationResult.latency_ms
			});
		} catch (moderationError) {
			console.error('Content moderation error:', moderationError);
			// Atomic: if moderation fails, don't create the template
			// This prevents slug consumption on failed publishes
			const errorMessage =
				moderationError instanceof Error ? moderationError.message : 'Content moderation failed';
			const response: ApiResponse = {
				success: false,
				error: createApiError(
					'server',
					'MODERATION_FAILED',
					`Unable to verify content: ${errorMessage}. Please try again.`
				)
			};
			return json(response, { status: 503 });
		}

		const user = locals.user;

		if (user) {
			// Authenticated user - save to database
			try {
				// HACKATHON FIX: Use AI-generated slug if provided, otherwise generate from title
				// This preserves the slug created by the subject line generator agent
				const slug = validData.slug?.trim()
					? validData.slug.trim()
					: validData.title
							.toLowerCase()
							.replace(/[^a-z0-9\s-]/g, '')
							.replace(/\s+/g, '-')
							.substring(0, 100); // Increased from 50 to 100 for generous limits

				const existingTemplate = await db.template.findUnique({
					where: { slug }
				});

				if (existingTemplate) {
					const response: ApiResponse = {
						success: false,
						error: createValidationError(
							'slug',
							'VALIDATION_DUPLICATE',
							'This link is already taken. Please choose a different one or customize your link.'
						)
					};
					return json(response, { status: 400 });
				}

				// Create template with optional TemplateScope in a transaction
				const newTemplate = await db.$transaction(async (tx) => {
					// Step 1: Create the template
					const template = await tx.template.create({
						data: {
							title: validData.title,
							description: validData.description || '',
							message_body: validData.message_body,
							sources: validData.sources || [],
							research_log: validData.research_log || [],
							category: validData.category || 'General',
							topics: validData.topics || [],
							type: validData.type,
							deliveryMethod: validData.deliveryMethod,
							preview: validData.preview,
							delivery_config: validData.delivery_config || {},
							cwc_config: validData.cwc_config || {},
							recipient_config: validData.recipient_config || {},
							metrics: validData.metrics || {},
							// Auto-publish if moderation passes - no manual review needed
							status: consensusResult?.approved ? 'published' : 'draft',
							is_public: consensusResult?.approved ?? false,
							slug,
							// Use Prisma relation connect syntax instead of scalar userId
							user: { connect: { id: user.id } },
							// Consolidated verification fields with defaults
							verification_status: consensusResult?.approved ? 'approved' : 'pending',
							country_code: 'US',
							reputation_applied: false,
							// Multi-agent consensus tracking via consensus_approved boolean
							consensus_approved: consensusResult?.approved ?? false
						}
					});

					// Step 2: Create TemplateScope if geographic_scope was extracted
					if (validData.geographic_scope && validData.geographic_scope.type !== 'international') {
						const geo = validData.geographic_scope;

						// Derive DB fields from GeoScope discriminated union
						let countryCode = 'US';
						let regionCode: string | null = null;
						let localityCode: string | null = null;
						let scopeLevel = 'country';
						let displayText = 'Nationwide';

						if (geo.type === 'nationwide') {
							countryCode = geo.country;
							displayText = geo.country;
						} else if (geo.type === 'subnational') {
							countryCode = geo.country;
							if (geo.subdivision) {
								regionCode = geo.subdivision;
								scopeLevel = 'region';
								displayText = geo.subdivision;
							}
							if (geo.locality) {
								localityCode = geo.locality;
								scopeLevel = 'locality';
								displayText = geo.locality + (geo.subdivision ? `, ${geo.subdivision}` : '');
							}
						}

						await tx.templateScope.create({
							data: {
								template_id: template.id,
								country_code: countryCode,
								region_code: regionCode,
								locality_code: localityCode,
								display_text: displayText,
								scope_level: scopeLevel,
								confidence: 1.0,
								extraction_method: 'gemini_inline',
								power_structure_type: null,
								audience_filter: null,
								scope_notes: null,
								validated_against: null
							}
						});
					}

					return template;
				});

				// Set verification fields for congressional templates (deliveryMethod === 'cwc')
				if (validData.deliveryMethod === 'cwc') {
					try {
						// Update template with initial verification status
						await db.template.update({
							where: { id: newTemplate.id },
							data: {
								verification_status: 'pending',
								country_code: 'US', // TODO: Extract from user profile
								reputation_applied: false
							}
						});

						// Trigger moderation pipeline via webhook
						await triggerModerationPipeline(newTemplate.id);
						console.log(`Set verification status for congressional template ${newTemplate.id}`);
					} catch (error) {
						console.error('Failed to set template verification status');
						// Don't fail the template creation, just log the error
					}
				}

				// Generate embeddings for searchability (FREE via Gemini)
				// Only generate if template is public (passed moderation)
				if (newTemplate.is_public) {
					try {
						const locationText = `${newTemplate.title} ${newTemplate.description || ''} ${newTemplate.category}`;
						const topicText = `${newTemplate.title} ${newTemplate.description || ''} ${newTemplate.message_body}`;

						const embeddings = await generateBatchEmbeddings(
							[locationText, topicText],
							{ taskType: 'RETRIEVAL_DOCUMENT' }
						);

						await db.template.update({
							where: { id: newTemplate.id },
							data: {
								location_embedding: embeddings[0],
								topic_embedding: embeddings[1],
								embedding_version: 'v1',
								embeddings_updated_at: new Date()
							}
						});

						console.log(`[embeddings] Generated for template ${newTemplate.id}`);
					} catch (embeddingError) {
						// Don't fail template creation if embedding generation fails
						console.error('[embeddings] Failed to generate:', embeddingError);
					}
				}

				// Format template with computed fields for client consumption
				// This ensures POST returns the same structure as GET for consistency
				const formattedTemplate = formatTemplateForClient(newTemplate, null);

				const response: ApiResponse = {
					success: true,
					data: formattedTemplate
				};

				return json(response);
			} catch (error) {
				console.error('Database error creating template:', error);
				console.error('Template creation error details:', {
					message: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined
				});

				const response: ApiResponse = {
					success: false,
					error: createApiError('server', 'SERVER_DATABASE', 'Failed to save template to database')
				};

				return json(response, { status: 500 });
			}
		} else {
			// Guest users cannot create templates - require authentication
			const response: ApiResponse = {
				success: false,
				error: createApiError('auth', 'AUTH_REQUIRED', 'Authentication required to create templates')
			};
			return json(response, { status: 401 });
		}
	} catch (error) {
		console.error('Template POST error:', error);
		console.error('POST error details:', {
			message: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		});

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'An unexpected error occurred')
		};

		return json(response, { status: 500 });
	}
};

/**
 * Trigger moderation pipeline for a template
 */
async function triggerModerationPipeline(templateId: string) {
	try {
		// Call our own moderation webhook with the template ID
		const response = await fetch(
			`${process.env.ORIGIN || 'http://localhost:5173'}/api/webhooks/template-moderation`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || 'demo-secret'
				},
				body: JSON.stringify({
					template_id: templateId,
					source: 'template-creation',
					timestamp: new Date().toISOString()
				})
			}
		);

		if (!response.ok) {
			throw new Error(`Webhook failed with status ${response.status}`);
		}

		const result = await response.json();
		console.log(`Moderation pipeline triggered for template ${templateId}:`, result);

		return result;
	} catch (error) {
		console.error('Moderation pipeline error:', error);
		console.error('Moderation error details:', {
			message: error instanceof Error ? error.message : 'Unknown error',
			templateId
		});
		// Don't throw - we don't want to fail template creation if moderation fails to trigger
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}
