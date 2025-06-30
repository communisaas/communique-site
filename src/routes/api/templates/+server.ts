import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET() {
	const templates = await db.template.findMany({
		where: {
			is_public: true
		}
	});
	return json(templates);
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