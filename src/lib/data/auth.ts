import { SvelteKitAuth, type SvelteKitAuthConfig } from '@auth/sveltekit';
import Discord from '@auth/core/providers/discord';
import Facebook from '@auth/core/providers/facebook';
import Instagram from '@auth/core/providers/instagram';
import Linkedin from '@auth/core/providers/linkedin';
import Reddit from '@auth/core/providers/reddit';
import Twitter from '@auth/core/providers/twitter';

import type { Provider } from '@auth/core/providers';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, AUTH_SECRET } from '$env/static/private';

export const providers: Provider[] = [
	Facebook({}) as Provider,
	Instagram({}) as Provider,
	Linkedin({}) as Provider,
	Twitter({}) as Provider,
	Reddit({}) as Provider,
	Discord({
		clientId: process.env.DISCORD_CLIENT_ID || DISCORD_CLIENT_ID,
		clientSecret: process.env.DISCORD_CLIENT_SECRET || DISCORD_CLIENT_SECRET
	}) as Provider
];

export const baseProviderLogoURL = new URL('https://authjs.dev/img/providers');

const config: SvelteKitAuthConfig = {
	providers: providers,
	pages: {
		signIn: '/sign/in'
		// signOut: '/auth/signout',
		// error: '/auth/error', // Error code passed in query string as ?error=
		// verifyRequest: '/auth/verify-request', // (used for check email message)
		// newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out if not of interest)
	},
	debug: true,
	secret: process.env.AUTH_SECRET || AUTH_SECRET,
	trustHost: true,
	session: {
		maxAge: 1800 // 30 mins
	}
};

export default SvelteKitAuth(config);
