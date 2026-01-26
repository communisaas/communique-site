import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { runSafeStorageTest } from '$lib/core/server/sentiment-storage';

export async function GET() {
	if (!dev) {
		return json({ error: 'Development endpoint not available' }, { status: 404 });
	}
	const result = await runSafeStorageTest();

	if (result.success) {
		return json(result);
	} else {
		return json(result, { status: 500 });
	}
}
