import { FEATURES } from '$lib/config/features';
import { error } from '@sveltejs/kit';

/** Throw 404 when PUBLIC_API flag is disabled. */
export function requirePublicApi(): void {
	if (!FEATURES.PUBLIC_API) throw error(404, 'Not found');
}
