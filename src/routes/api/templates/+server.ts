import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { templates as staticTemplates } from '$lib/data/templates';

export async function GET() {
	try {
		// Attempt to fetch from database
		const dbTemplates = await db.template.findMany({
			where: {
				is_public: true
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		// If we have database templates, format and return them
		if (dbTemplates && dbTemplates.length > 0) {
			const formattedTemplates = dbTemplates.map(template => ({
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

export async function POST({ request }) {
	const body = await request.json();

	const newTemplate = await db.template.create({
		data: {
			title: body.title,
			description: body.description,
			category: body.category,
			type: body.type,
			deliveryMethod: body.deliveryMethod,
			preview: body.preview,
			message_body: body.preview, // Using preview as the message body for now
			subject: `New Campaign: ${body.title}`, // Placeholder subject
			metrics: body.metrics || {},
			delivery_config: {}, // Placeholder
			recipient_config: body.recipientEmails ? { emails: body.recipientEmails } : {},
			is_public: false, // New templates are drafts by default
			status: 'draft'
		}
	});

	return json(newTemplate, { status: 201 });
} 