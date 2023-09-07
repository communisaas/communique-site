import { goto } from '$app/navigation';
import { handleMailto, setActiveEmail } from '$lib/data/email';
import type { Page } from '@sveltejs/kit';
import type { DispatchOptions } from 'svelte/internal';

export async function routeModal(
	urlHashes: string[],
	page: Page<Record<string, string>>,
	sessionStore: UserState,
	eventDispatcher: <EventKey extends string>(
		type: EventKey,
		detail?: unknown,
		options?: DispatchOptions | undefined
	) => boolean
) {
	sessionStore.show.login = false; // reset login modal
	if (urlHashes.length === 1 && urlHashes[0]) {
		const slug = urlHashes[0];

		if (slug === 'signin') {
			if (!page.data.session) {
				sessionStore.show.login = true;
			} else {
				goto(`/`, { noScroll: true });
			}
		} else if (slug === 'terms-of-use') {
			sessionStore.show.termsOfUse = true;
		} else if (slug == 'privacy-policy') {
			sessionStore.show.privacyPolicy = true;
		} else if (
			sessionStore &&
			'email' in sessionStore &&
			'content' in sessionStore.email &&
			sessionStore.email.content.shortid === slug
		) {
			sessionStore.show.share = true;
			handleMailto(eventDispatcher);
		} else {
			// Otherwise, resolve the slug
			await setActiveEmail(slug);
			sessionStore.show.share = true;
			handleMailto(eventDispatcher);
		}
	} else {
		// hash has parameters, so iterate through them
		urlHashes.forEach(async (hash) => {
			const hashParams = new URLSearchParams(hash);

			if (hashParams.has('signin')) {
				if (!page.data.session) {
					sessionStore.show.login = true;
				} else {
					goto(`/`, { noScroll: true });
				}
			}

			if (hashParams.has('callbackUrl')) {
				sessionStore.loginCallbackURL = decodeURIComponent(
					hashParams.get('callbackUrl') ?? ''
				) as `/${string}`;
			}
		});
	}
	return sessionStore;
}
