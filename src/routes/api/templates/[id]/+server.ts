import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const templateId = params.id;

		const template = await db.template.findUnique({
			where: { id: templateId }
		});

		if (!template) {
			return error(404, 'Template not found');
		}

		const formattedTemplate = {
			id: parseInt(template.id), // Convert string ID to number
			title: template.title,
			description: template.description,
			category: template.category,
			type: template.type as 'certified' | 'direct',
			deliveryMethod: template.deliveryMethod,
			preview: template.preview,
			metrics: template.metrics as any,
			recipientEmails: template.recipientEmails as string[] | undefined
		};

		return json(formattedTemplate);
	} catch (err) {
		console.error('Error fetching template:', err);
		return error(500, 'Failed to fetch template');
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const templateId = params.id;
		const updateData = await request.json();
		
		const updatedTemplate = await db.template.update({
			where: { id: templateId },
			data: {
				...(updateData.title && { title: updateData.title }),
				...(updateData.description && { description: updateData.description }),
				...(updateData.category && { category: updateData.category }),
				...(updateData.type && { type: updateData.type }),
				...(updateData.deliveryMethod && { deliveryMethod: updateData.deliveryMethod }),
				...(updateData.preview && { preview: updateData.preview }),
				...(updateData.metrics && { metrics: updateData.metrics }),
				...(updateData.recipientEmails !== undefined && { recipientEmails: updateData.recipientEmails }),
			}
		});

		const formattedTemplate = {
			id: parseInt(updatedTemplate.id), // Convert string ID to number
			title: updatedTemplate.title,
			description: updatedTemplate.description,
			category: updatedTemplate.category,
			type: updatedTemplate.type as 'certified' | 'direct',
			deliveryMethod: updatedTemplate.deliveryMethod,
			preview: updatedTemplate.preview,
			metrics: updatedTemplate.metrics as any,
			recipientEmails: updatedTemplate.recipientEmails as string[] | undefined
		};

		return json(formattedTemplate);
	} catch (err) {
		console.error('Error updating template:', err);
		return error(500, 'Failed to update template');
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const templateId = params.id;

		const deletedTemplate = await db.template.delete({
			where: { id: templateId }
		});

		return json({ success: true, id: parseInt(deletedTemplate.id) });
	} catch (err) {
		console.error('Error deleting template:', err);
		return error(500, 'Failed to delete template');
	}
}; 