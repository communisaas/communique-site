import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const slug = url.searchParams.get('slug');
	
	if (!slug) {
		return json({ error: 'Slug parameter is required' }, { status: 400 });
	}
	
	// Validate slug format
	if (!/^[a-z0-9-]+$/.test(slug)) {
		return json({ 
			available: false, 
			error: 'Invalid slug format. Use only lowercase letters, numbers, and hyphens.' 
		}, { status: 400 });
	}
	
	try {
		const existing = await db.template.findUnique({
			where: { slug },
			select: { id: true }
		});
		
		return json({ 
			available: !existing,
			slug 
		});
	} catch (error) {
		console.error('Error checking slug availability:', error);
		return json({ error: 'Failed to check slug availability' }, { status: 500 });
	}
};