import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import type { RequestHandler } from './$types';

/** Create a new organization. The authenticated user becomes the owner. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	const { name, slug, description } = body as { name?: string; slug?: string; description?: string };

	if (!name || !slug) {
		throw error(400, 'name and slug are required');
	}

	if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 2 || slug.length > 48) {
		throw error(400, 'slug must be 2-48 lowercase alphanumeric characters or hyphens');
	}

	const existing = await db.organization.findUnique({ where: { slug } });
	if (existing) {
		throw error(409, 'An organization with this slug already exists');
	}

	const org = await db.organization.create({
		data: {
			name,
			slug,
			description: description || null,
			memberships: {
				create: {
					userId: locals.user.id,
					role: 'owner'
				}
			}
		}
	});

	return json({ id: org.id, slug: org.slug }, { status: 201 });
};
