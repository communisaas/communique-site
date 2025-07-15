import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { templates as staticTemplates } from '$lib/data/templates';

export async function GET() {
	try {
		// Attempt to fetch from database
		const dbTemplates = await db.Template.findMany({
			where: {
				is_public: true
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		// If we have database templates, format and return them
		if (dbTemplates && dbTemplates.length > 0) {
			const formattedTemplates = dbTemplates.map((template) => ({
				id: template.id,
				title: template.title,
				description: template.description,
				category: template.category,
				type: template.type,
				deliveryMethod: template.deliveryMethod,
				subject: template.subject,
				message_body: template.message_body,
				preview: template.preview,
				metrics: template.metrics as any,
				delivery_config: template.delivery_config,
				recipient_config: template.recipient_config,
				is_public: template.is_public,
				recipientEmails: (template.recipient_config as any)?.emails as string[] | undefined
			}));

			return json(formattedTemplates);
		}

		// Fallback to static templates if database is empty
		console.log('Database empty, returning static templates');
		const staticTemplatesWithIds = staticTemplates.map((template, index) => ({
			...template,
			id: `fallback-${index + 1}` // Different prefix to distinguish from client-side static data
		}));
		
		return json(staticTemplatesWithIds);

	} catch (error) {
		console.error('Database error, falling back to static templates:', error);
		
		// Fallback to static data if database is unavailable
		const staticTemplatesWithIds = staticTemplates.map((template, index) => ({
			...template,
			id: `fallback-${index + 1}`
		}));
		
		return json(staticTemplatesWithIds);
	}
}

export async function POST({ request, locals }) {
	try {
		const templateData = await request.json();
		
		// Check if user is authenticated (fix the auth method)
		const user = locals.user;
		
		if (user) {
			// Authenticated user - save to database
			const newTemplate = await db.template.create({
				data: {
					...templateData,
					is_public: false, // Default to not public
					status: 'draft', // Default to draft
					userId: user.id // Associate with the current user
				}
			});
			return json(newTemplate);
		} else {
			// Guest user - return the template data with a temporary ID for client-side storage
			// This allows the frontend to handle the progressive auth flow
			const guestTemplate = {
				...templateData,
				id: `guest-${Date.now()}`, // Temporary ID
				is_public: false,
				status: 'draft',
				createdAt: new Date().toISOString(),
				userId: null
			};
			return json(guestTemplate);
		}
	} catch (error) {
		console.error('Error creating template:', error);
		return json({ error: 'Failed to create template' }, { status: 500 });
	}
} 