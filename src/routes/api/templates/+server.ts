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
import { moderateTemplate, containsProhibitedPatterns } from '$lib/core/server/content-moderation';
import {
	getMultiAgentConsensus,
	getSingleAgentModeration
} from '$lib/core/server/multi-agent-consensus';
import { env } from '$env/dynamic/private';

// Import ScopeMapping type for geographic scope
import type { ScopeMapping } from '$lib/utils/scope-mapper-international';

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
	geographic_scope?: ScopeMapping; // Agent-extracted geographic scope for TemplateScope creation
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
		geographic_scope: (templateData.geographic_scope as ScopeMapping) || undefined
	};

	return { isValid: true, errors: [], validData };
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

		const formattedTemplates = dbTemplates.map((template) => {
			// Extract metrics from JSON field
			const jsonMetrics =
				typeof template.metrics === 'string'
					? JSON.parse(template.metrics)
					: template.metrics || {};

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
				description: template.description,
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
					effectiveness_score: (jsonMetrics as { effectiveness_score?: number })
						.effectiveness_score,
					cascade_depth: (jsonMetrics as { cascade_depth?: number }).cascade_depth,
					viral_coefficient: (jsonMetrics as { viral_coefficient?: number }).viral_coefficient,

					// Funnel tracking metrics from JSON
					funnel_views: (jsonMetrics as { funnel_views?: number }).funnel_views,
					modal_views: (jsonMetrics as { modal_views?: number }).modal_views,
					onboarding_starts: (jsonMetrics as { onboarding_starts?: number }).onboarding_starts,
					onboarding_completes: (jsonMetrics as { onboarding_completes?: number })
						.onboarding_completes,
					auth_completions: (jsonMetrics as { auth_completions?: number }).auth_completions,
					shares: (jsonMetrics as { shares?: number }).shares
				},

				delivery_config: template.delivery_config,
				cwc_config: template.cwc_config,
				recipient_config: template.recipient_config,
				campaign_id: template.campaign_id,
				status: template.status,
				is_public: template.is_public,

				// Geographic scope fields
				applicable_countries: template.applicable_countries,
				jurisdiction_level: template.jurisdiction_level,
				specific_locations: template.specific_locations,

				// Jurisdictions for location filtering (Phase 3)
				jurisdictions: template.jurisdictions || [],

				// Optional scope from separate table
				scope: idToScope.get(template.id) || null,

				recipientEmails: extractRecipientEmails(
					typeof template.recipient_config === 'string'
						? JSON.parse(template.recipient_config)
						: template.recipient_config
				)
			};
		});

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

		const validData = validation.validData!;

		// === PHASE 1: 3-LAYER CONTENT MODERATION ===
		// Layer 1: Pattern matching (fast, no API call)
		// Layer 2: OpenAI safety filter (illegal content)
		// Layer 3: Multi-agent consensus (quality assessment)
		let consensusResult;

		try {
			// Layer 1: Check prohibited patterns first (instant)
			const combinedContent = `${validData.title}\n\n${validData.message_body}`;
			if (containsProhibitedPatterns(combinedContent)) {
				const response: ApiResponse = {
					success: false,
					error: createValidationError(
						'message_body',
						'CONTENT_PROHIBITED',
						'Content contains prohibited patterns. Please revise your message.'
					)
				};
				return json(response, { status: 400 });
			}

			// Layer 2: OpenAI Moderation API for safety (FREE tier: 20 requests/min)
			const moderationResult = await moderateTemplate({
				title: validData.title,
				message_body: validData.message_body
			});

			if (!moderationResult.approved) {
				console.log('OpenAI moderation REJECTED template:', {
					flagged_categories: moderationResult.flagged_categories,
					timestamp: moderationResult.timestamp
				});

				const response: ApiResponse = {
					success: false,
					error: createValidationError(
						'message_body',
						'CONTENT_FLAGGED',
						`Content flagged for: ${moderationResult.flagged_categories.join(', ')}. Please revise your message to comply with content policies.`
					)
				};
				return json(response, { status: 400 });
			}

			// Layer 3: Multi-agent consensus for quality (configurable)
			const useMultiAgent = env.CONSENSUS_TYPE === 'multi_agent';

			if (useMultiAgent) {
				consensusResult = await getMultiAgentConsensus({
					title: validData.title,
					message_body: validData.message_body,
					category: validData.category
				});

				if (!consensusResult.approved) {
					console.log('Multi-agent consensus REJECTED template:', {
						consensus_type: consensusResult.consensus_type,
						votes: consensusResult.votes.map((v) => ({
							agent: v.agent,
							approved: v.approved,
							confidence: v.confidence
						})),
						timestamp: consensusResult.timestamp
					});

					const response: ApiResponse = {
						success: false,
						error: createValidationError(
							'message_body',
							'QUALITY_REJECTED',
							`Template quality assessment failed (${consensusResult.consensus_type}): ${consensusResult.reasoning_summary}`
						)
					};
					return json(response, { status: 400 });
				}

				console.log('Multi-agent consensus APPROVED template:', {
					consensus_type: consensusResult.consensus_type,
					confidence: consensusResult.final_confidence,
					timestamp: consensusResult.timestamp
				});
			} else {
				// Fallback: Single-agent moderation (OpenAI only)
				consensusResult = await getSingleAgentModeration({
					title: validData.title,
					message_body: validData.message_body,
					category: validData.category
				});

				console.log('Single-agent moderation result:', {
					approved: consensusResult.approved,
					confidence: consensusResult.final_confidence
				});
			}
		} catch (moderationError) {
			console.error('Content moderation error:', moderationError);
			// Don't block template creation if moderation fails - log and continue
			// In production, queue for manual review instead
			consensusResult = null;
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
							status: validData.status || 'draft',
							is_public: validData.is_public || false,
							slug,
							userId: user.id,
							// Consolidated verification fields with defaults
							verification_status: consensusResult?.approved ? 'approved' : 'pending',
							country_code: validData.geographic_scope?.country_code || 'US',
							reputation_applied: false,
							// Multi-agent consensus results (Phase 1)
							agent_votes: consensusResult?.votes || [],
							consensus_score: consensusResult?.final_confidence || null
						}
					});

					// Step 2: Create TemplateScope if geographic_scope was extracted
					if (validData.geographic_scope) {
						const scope = validData.geographic_scope;

						// Log scope creation for monitoring
						console.log(
							'[template-scope-creation]',
							JSON.stringify({
								timestamp: new Date().toISOString(),
								template_id: template.id,
								scope_level: scope.scope_level,
								display_text: scope.display_text,
								country_code: scope.country_code,
								confidence: scope.confidence,
								extraction_method: scope.extraction_method || 'regex'
							})
						);

						await tx.templateScope.create({
							data: {
								template_id: template.id,
								country_code: scope.country_code,
								region_code: scope.region_code || null,
								locality_code: scope.locality_code || null,
								district_code: scope.district_code || null,
								display_text: scope.display_text,
								scope_level: scope.scope_level,
								confidence: scope.confidence,
								extraction_method: scope.extraction_method || 'regex',
								// Optional fields - set to null if not provided
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
								quality_score: 0,
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

				const response: ApiResponse = {
					success: true,
					data: { template: newTemplate }
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
			// Guest user - return the template data with a temporary ID for client-side storage
			// HACKATHON FIX: Use AI-generated slug if provided
			const guestTemplate = {
				...validData,
				id: `guest-${Date.now()}`,
				slug: validData.slug?.trim()
					? validData.slug.trim()
					: validData.title
							.toLowerCase()
							.replace(/[^a-z0-9\s-]/g, '')
							.replace(/\s+/g, '-')
							.substring(0, 100), // Increased from 50 to 100
				topics: validData.topics || [],
				created_at: new Date().toISOString(),
				userId: null
			};

			const response: ApiResponse = {
				success: true,
				data: { template: guestTemplate }
			};

			return json(response);
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
