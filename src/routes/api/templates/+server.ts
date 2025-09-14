import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { extractRecipientEmails } from '$lib/types/templateConfig';
import { createApiError, createValidationError, type ApiResponse } from '$lib/types/errors';

// Validation schema for template creation
interface CreateTemplateRequest {
	title: string;
	subject?: string;
	message_body: string;
	category?: string;
	type: string;
	deliveryMethod: string;
	preview: string;
	description?: string;
	status?: string;
	is_public?: boolean;
	delivery_config?: Record<string, unknown>;
	cwc_config?: Record<string, unknown>;
	recipient_config?: Record<string, unknown>;
	metrics?: Record<string, unknown>;
}

function validateTemplateData(data: unknown): { isValid: boolean; errors: any[]; validData?: CreateTemplateRequest } {
	const errors: any[] = [];
	
	if (!data || typeof data !== 'object') {
		errors.push(createValidationError('body', 'VALIDATION_REQUIRED', 'Invalid request body'));
		return { isValid: false, errors };
	}
	
	const templateData = data as Record<string, unknown>;
	
	// Required fields validation
	if (!templateData.title || typeof templateData.title !== 'string' || !templateData.title.trim()) {
		errors.push(createValidationError('title', 'VALIDATION_REQUIRED', 'Template title is required'));
	} else if (templateData.title.length > 200) {
		errors.push(createValidationError('title', 'VALIDATION_TOO_LONG', 'Title must be less than 200 characters'));
	}
	
	if (!templateData.message_body || typeof templateData.message_body !== 'string' || !templateData.message_body.trim()) {
		errors.push(createValidationError('message_body', 'VALIDATION_REQUIRED', 'Message content is required'));
	} else if (templateData.message_body.length > 10000) {
		errors.push(createValidationError('message_body', 'VALIDATION_TOO_LONG', 'Message must be less than 10,000 characters'));
	}
	
	if (!templateData.preview || typeof templateData.preview !== 'string' || !templateData.preview.trim()) {
		errors.push(createValidationError('preview', 'VALIDATION_REQUIRED', 'Preview text is required'));
	} else if (templateData.preview.length > 500) {
		errors.push(createValidationError('preview', 'VALIDATION_TOO_LONG', 'Preview must be less than 500 characters'));
	}
	
	if (!templateData.type || typeof templateData.type !== 'string') {
		errors.push(createValidationError('type', 'VALIDATION_REQUIRED', 'Template type is required'));
	}
	
	if (!templateData.delivery_method || typeof templateData.delivery_method !== 'string') {
		errors.push(createValidationError('delivery_method', 'VALIDATION_REQUIRED', 'Delivery method is required'));
	}
	
	if (errors.length > 0) {
		return { isValid: false, errors };
	}
	
	// Return valid data with defaults (map delivery_method to deliveryMethod for Prisma)
	const validData: CreateTemplateRequest = {
		title: templateData.title as string,
		message_body: templateData.message_body as string,
		preview: templateData.preview as string,
		type: templateData.type as string,
		deliveryMethod: templateData.delivery_method as string,
		subject: templateData.subject as string || `Regarding: ${templateData.title}`,
		category: templateData.category as string || 'General',
		description: templateData.description as string || templateData.preview.substring(0, 160),
		status: templateData.status as string || 'draft',
		is_public: Boolean(templateData.is_public) || false,
		delivery_config: templateData.delivery_config as Record<string, unknown> || {},
		cwc_config: templateData.cwc_config as Record<string, unknown> || {},
		recipient_config: templateData.recipient_config as Record<string, unknown> || {},
		metrics: templateData.metrics as Record<string, unknown> || { sends: 0, opens: 0, clicks: 0, views: 0 }
	};
	
	return { isValid: true, errors: [], validData };
}

export async function GET() {
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
		let scopes: any[] = [];
		try {
			scopes = await db.template_scope?.findMany({
				where: { template_id: { in: dbTemplates.map((t) => t.id) } }
			}) || [];
		} catch (scopeError) {
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
			recipient_config: template.recipient_config,
			is_public: template.is_public,
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
		console.error('Failed to fetch templates:', error);
		
		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_DATABASE', 'Failed to fetch templates')
		};

		return json(response, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	try {
		// Parse request body
		let requestData: unknown;
		try {
			requestData = await request.json();
		} catch (parseError) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'VALIDATION_INVALID_FORMAT', 'Invalid JSON in request body')
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
				// Check for duplicate slug
				if (validData.title) {
					const slug = validData.title.toLowerCase()
						.replace(/[^a-z0-9\s-]/g, '')
						.replace(/\s+/g, '-')
						.substring(0, 50);
					
					const existingTemplate = await db.template.findUnique({
						where: { slug }
					});
					
					if (existingTemplate) {
						const response: ApiResponse = {
							success: false,
							error: createValidationError('title', 'VALIDATION_DUPLICATE', 
								'A template with a similar title already exists. Please choose a different title.')
						};
						return json(response, { status: 400 });
					}

					const newTemplate = await db.template.create({
						data: {
							...validData,
							slug,
							userId: user.id
						}
					});

					const response: ApiResponse = {
						success: true,
						data: { template: newTemplate }
					};

					return json(response);
				}
			} catch (dbError) {
				console.error('Database error creating template:', dbError);
				
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
				slug: validData.title.toLowerCase()
					.replace(/[^a-z0-9\s-]/g, '')
					.replace(/\s+/g, '-')
					.substring(0, 50),
				createdAt: new Date().toISOString(),
				userId: null
			};

			const response: ApiResponse = {
				success: true,
				data: { template: guestTemplate }
			};

			return json(response);
		}
	} catch (error) {
		console.error('Unexpected error in template creation:', error);
		
		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'An unexpected error occurred')
		};

		return json(response, { status: 500 });
	}
} 