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