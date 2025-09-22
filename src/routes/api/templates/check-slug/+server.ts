import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import {
	isSlugReserved,
	getReservedSlugError,
	suggestAlternativeSlug,
	suggestAvailableAlternatives
} from '$lib/core/server/reserved-slugs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const slug = url.searchParams.get('slug');
	const title = url.searchParams.get('title') || '';
	const deliveryMethod = url.searchParams.get('deliveryMethod') || 'email';

	if (!slug) {
		return json({ error: 'Slug parameter is required' }, { status: 400 });
	}

	// Validate slug format
	if (!/^[a-z0-9-]+$/.test(slug)) {
		return json(
			{
				available: false,
				error: 'Invalid slug format. Use only lowercase letters, numbers, and hyphens.',
				suggestions: title ? suggestAlternativeSlug(slug, title, deliveryMethod) : []
			},
			{ status: 400 }
		);
	}

	// Check if slug is reserved
	if (isSlugReserved(slug)) {
		return json(
			{
				available: false,
				error: getReservedSlugError(slug),
				suggestions: title ? suggestAlternativeSlug(slug, title, deliveryMethod) : []
			},
			{ status: 400 }
		);
	}

	try {
		const existing = await db.template.findUnique({
			where: { slug },
			select: { id: true }
		});

		if (existing) {
			// Helper function to check if a slug is available in the database
			const checkSlugAvailability = async (slugToCheck: string): Promise<boolean> => {
				const existingSlug = await db.template.findUnique({
					where: { slug: slugToCheck },
					select: { id: true }
				});
				return !existingSlug;
			};

			// Get validated suggestions that are guaranteed to be available
			const suggestions = title
				? await suggestAvailableAlternatives(slug, title, deliveryMethod, checkSlugAvailability)
				: [];

			return json({
				available: false,
				error: `Slug "${slug}" is already taken.`,
				suggestions
			});
		}

		return json({
			available: true,
			slug
		});
	} catch (err) {
		return json({ error: 'Failed to check slug availability' }, { status: 500 });
	}
};
