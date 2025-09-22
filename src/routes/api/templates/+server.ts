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

// Validation schema for template creation - matches Prisma schema field names
interface CreateTemplateRequest {
	title: string;
	subject?: string;
	message_body: string;
	category?: string;
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
	} else if (templateData.title.length > 200) {
		errors.push(
			createValidationError(
				'title',
				'VALIDATION_TOO_LONG',
				'Title must be less than 200 characters'
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
	} else if (templateData.message_body.length > 10000) {
		errors.push(
			createValidationError(
				'message_body',
				'VALIDATION_TOO_LONG',
				'Message must be less than 10,000 characters'
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
		message_body: templateData.message_body as string,
		preview: templateData.preview as string,
		type: templateData.type as string,
		deliveryMethod: templateData.deliveryMethod as string,
		subject: (templateData.subject as string) || `Regarding: ${templateData.title}`,
		category: (templateData.category as string) || 'General',
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
		}
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

		const formattedTemplates = dbTemplates.map((template) => ({
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
			metrics: template.metrics,
			delivery_config: template.delivery_config,
			cwc_config: template.cwc_config, // Was missing from API response
			recipient_config: template.recipient_config,
			campaign_id: template.campaign_id, // Was missing from API response
			status: template.status, // Was missing from API response
			is_public: template.is_public,
			// Usage tracking fields
			send_count: template.send_count,
			last_sent_at: template.last_sent_at,
			// Geographic scope fields - were missing from API response
			applicable_countries: template.applicable_countries,
			jurisdiction_level: template.jurisdiction_level,
			specific_locations: template.specific_locations,
			// Optional scope from separate table
			scope: idToScope.get(template.id) || null,
			recipientEmails: extractRecipientEmails(
				typeof template.recipient_config === 'string'
					? JSON.parse(template.recipient_config)
					: template.recipient_config
			)
		}));

		const response: ApiResponse = {
			success: true,
			data: formattedTemplates
		};

		return json(response);
	} catch (error) {
		console.error('Error occurred');

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
		const user = locals.user;

		if (user) {
			// Authenticated user - save to database
			try {
				// Check for duplicate slug - validData.title is guaranteed to exist from validation
				const slug = validData.title
					.toLowerCase()
					.replace(/[^a-z0-9\s-]/g, '')
					.replace(/\s+/g, '-')
					.substring(0, 50);

				const existingTemplate = await db.template.findUnique({
					where: { slug }
				});

				if (existingTemplate) {
					const response: ApiResponse = {
						success: false,
						error: createValidationError(
							'title',
							'VALIDATION_DUPLICATE',
							'A template with a similar title already exists. Please choose a different title.'
						)
					};
					return json(response, { status: 400 });
				}

				const newTemplate = await db.template.create({
					data: {
						title: validData.title,
						description: validData.description || '',
						message_body: validData.message_body,
						category: validData.category || 'General',
						type: validData.type,
						deliveryMethod: validData.deliveryMethod,
						subject: validData.subject,
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
						verification_status: 'pending',
						country_code: 'US',
						reputation_applied: false
					}
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
				console.error('Database error creating template');

				const response: ApiResponse = {
					success: false,
					error: createApiError('server', 'SERVER_DATABASE', 'Failed to save template to database')
				};

				return json(response, { status: 500 });
			}
		} else {
			// Guest user - return the template data with a temporary ID for client-side storage
			const guestTemplate = {
				...validData,
				id: `guest-${Date.now()}`,
				slug: validData.title
					.toLowerCase()
					.replace(/[^a-z0-9\s-]/g, '')
					.replace(/\s+/g, '-')
					.substring(0, 50),
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
		console.error('Error occurred');

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
		console.error('Error occurred');
		// Don't throw - we don't want to fail template creation if moderation fails to trigger
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}
