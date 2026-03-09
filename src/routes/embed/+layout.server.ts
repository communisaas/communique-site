import type { LayoutServerLoad } from './$types';

// Override root layout — embed routes are public, no user needed
export const load: LayoutServerLoad = async () => {
	return { user: null };
};
