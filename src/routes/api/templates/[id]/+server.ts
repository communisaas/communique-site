import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { updateTemplateDistrictMetrics } from '$lib/server/district-metrics';
import { extractRecipientEmails } from '$lib/types/templateConfig';
import type { RequestHandler } from './$types';
import type { TemplateUpdateData } from '$lib/types/api';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const templateId = params.id;

		const template = await db.template.findUnique({
			where: { id: templateId }
		});

		if (!template) {
			return error(404, 'Template not found');
		}

		// Update district metrics for congressional templates
		if (template.deliveryMethod === 'both') {
			await updateTemplateDistrictMetrics(templateId);
			
			// Refetch template to get updated metrics
			const updatedTemplate = await db.template.findUnique({
				where: { id: templateId }
			});
			
			if (updatedTemplate) {
				template.metrics = updatedTemplate.metrics;
			}
		}

		const formattedTemplate = {
			id: template.id,
			title: template.title,
			description: template.description,
			category: template.category,
			type: template.type,
			deliveryMethod: template.deliveryMethod,
			subject: template.subject,
			preview: template.preview,
			message_body: template.message_body,
			metrics: template.metrics,
			delivery_config: template.delivery_config,
			recipient_config: template.recipient_config,
			is_public: template.is_public,
			recipientEmails: extractRecipientEmails(template.recipient_config)
		};

		return json(formattedTemplate);
	} catch (err) {
		return error(500, 'Failed to fetch template');
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const session = await locals.auth.validate();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const templateId = params.id;
		const updateData = await request.json();

		// Ensure the user owns this template before updating
		const template = await db.template.findFirst({
			where: { id: templateId, userId: session.user.id }
		});

		if (!template) {
			return error(404, 'Template not found or you do not have permission to edit it');
		}

		// Prepare the data for the update
		const dataToUpdate: TemplateUpdateData & { is_public?: boolean } = { ...updateData };

		// If the status is being changed to 'published', also set 'is_public' to true
		if (updateData.status && updateData.status === 'published') {
			dataToUpdate.is_public = true;
		}

		const updatedTemplate = await db.template.update({
			where: { id: templateId },
			data: dataToUpdate
		});

		return json(updatedTemplate);
	} catch (err) {
		return error(500, 'Failed to update template');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const session = await locals.auth.validate();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const templateId = params.id;

		// Ensure the user owns this template before deleting
		const template = await db.template.findFirst({
			where: { id: templateId, userId: session.user.id }
		});

		if (!template) {
			return error(404, 'Template not found or you do not have permission to delete it');
		}

		await db.template.delete({
			where: { id: templateId }
		});

		return json({ success: true, id: templateId });
	} catch (err) {
		return error(500, 'Failed to delete template');
	}
}; 