import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { extractRecipientEmails } from '$lib/types/templateConfig';

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
			recipientEmails: extractRecipientEmails(template.recipient_config)
		}));

		return json(formattedTemplates);

	} catch (error) {
		return json({ error: 'Failed to fetch templates' }, { status: 500 });
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
		return json({ error: 'Failed to create template' }, { status: 500 });
	}
} 