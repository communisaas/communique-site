/**
 * Mail Server API: Template Resolution
 * Internal endpoint for mail server to fetch template data
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url, request }) => {
	// Authenticate the mail server
	const authHeader = request.headers.get('authorization');
	if (!authHeader || authHeader !== `Bearer ${env.COMMUNIQUE_API_KEY}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const slug = url.searchParams.get('slug');
	const templateId = url.searchParams.get('id');

	if (!slug && !templateId) {
		return json({ error: 'Slug or ID parameter required' }, { status: 400 });
	}

	try {
		const whereConditions = [];
		if (slug) {
			whereConditions.push({ slug, is_public: true });
		}
		if (templateId) {
			whereConditions.push({ id: templateId });
		}

		// Filter out any undefined conditions and ensure we have at least one condition
		const validConditions = whereConditions.filter((condition) => condition !== undefined);
		if (validConditions.length === 0) {
			return json({ error: 'Missing slug or templateId parameter' }, { status: 400 });
		}

		const template = await db.template.findFirst({
			where: {
				OR: validConditions
			},
			select: {
				id: true,
				slug: true,
				title: true,
				description: true,
				category: true,
				type: true,
				deliveryMethod: true,
				subject: true,
				message_body: true,
				delivery_config: true,
				recipient_config: true,
				userId: true
			}
		});

		if (!template) {
			return json({ template: null });
		}

		return json({ template });
	} catch (error) {
		console.error('Error occurred');
		return json({ error: 'Failed to fetch template' }, { status: 500 });
	}
};
