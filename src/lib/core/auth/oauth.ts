// OAuth Provider Types
export type OAuthProvider = 'google' | 'twitter' | 'facebook' | 'linkedin' | 'discord';

// OAuth state management
export function generateState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateCodeVerifier(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * BA-004: Validate returnTo URL to prevent open redirect attacks.
 *
 * Only allows same-origin relative paths (starting with `/`).
 * Rejects absolute URLs, protocol-relative URLs, backslash tricks,
 * and null bytes that could be used to bypass validation.
 *
 * @param url - The returnTo URL to validate
 * @returns The validated URL, or '/' if the URL is unsafe
 */
export function validateReturnTo(url: string | null | undefined): string {
	// Falsy or empty → safe default
	if (!url || url.trim().length === 0) {
		return '/';
	}

	// Reject null bytes (can confuse downstream parsers)
	if (url.includes('\0')) {
		return '/';
	}

	// Reject backslashes (browsers normalize `\` to `/` in some contexts,
	// e.g. `//evil.com` could be reached via `\/evil.com`)
	if (url.includes('\\')) {
		return '/';
	}

	// Reject absolute URLs (http://, https://, or any scheme)
	if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) {
		return '/';
	}

	// Reject protocol-relative URLs (//evil.com)
	if (url.startsWith('//')) {
		return '/';
	}

	// Must start with `/` to be a valid same-origin relative path
	if (!url.startsWith('/')) {
		return '/';
	}

	return url;
}
