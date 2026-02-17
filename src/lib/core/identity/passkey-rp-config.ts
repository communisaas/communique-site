/**
 * Passkey Relying Party Configuration
 *
 * Shared RP config used by both passkey-registration.ts and passkey-authentication.ts.
 *
 * Derives rpID (hostname) and origin from the ORIGIN environment variable,
 * with sensible localhost fallbacks for development.
 *
 * On Cloudflare Workers, process.env is shimmed by hooks.server.ts (handlePlatformEnv)
 * before any request handler runs, so process.env.ORIGIN is available here.
 */

export interface PasskeyRPConfig {
	rpName: string;
	rpID: string;
	origin: string;
}

/**
 * Get the Relying Party configuration for WebAuthn operations.
 *
 * - rpID: the hostname portion of the origin (e.g., "communique.site" or "localhost")
 * - origin: full origin URL (e.g., "https://communique.site" or "http://localhost:5173")
 * - rpName: display name shown in the browser passkey prompt
 */
export function getPasskeyRPConfig(): PasskeyRPConfig {
	const envOrigin = process.env.ORIGIN;

	let rpID: string;
	let origin: string;

	if (envOrigin) {
		try {
			const url = new URL(envOrigin);
			rpID = url.hostname;
			origin = url.origin;
		} catch {
			// If ORIGIN is malformed, fall back to localhost
			console.warn(
				`[passkey] ORIGIN env var "${envOrigin}" is not a valid URL, falling back to localhost`
			);
			rpID = 'localhost';
			origin = 'http://localhost:5173';
		}
	} else {
		rpID = 'localhost';
		origin = 'http://localhost:5173';
	}

	return {
		rpName: 'Communique',
		rpID,
		origin
	};
}
