import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

export function load() {
	if (!dev) throw error(404);
}
