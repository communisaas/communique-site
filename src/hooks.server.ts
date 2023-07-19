import { redirect, type Handle } from '@sveltejs/kit';
import prepAuth from '$lib/data/auth';

import { sequence } from '@sveltejs/kit/hooks';

async function protect({ event, resolve }) {
	if (event.url.pathname.startsWith('/compose')) {
		const session = await event.locals.getSession();
		if (!session) {
			throw redirect(302, '/sign/in?callbackUrl=/compose');
		}
	}

	return resolve(event);
}

export const handle = sequence(prepAuth, protect) satisfies Handle;
