import { json } from '@sveltejs/kit';
import { runSafeStorageTest } from '$lib/core/server/sentiment-storage';

export async function GET() {
	const result = await runSafeStorageTest();

	if (result.success) {
		return json(result);
	} else {
		return json(result, { status: 500 });
	}
}
