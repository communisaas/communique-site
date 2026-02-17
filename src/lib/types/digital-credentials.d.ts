/**
 * W3C Digital Credentials API Type Declarations
 *
 * Browser API for requesting identity credentials (mDL, EUDIW) from device wallets.
 * Shipped in Chrome 141+ and Safari 26+ (Sept 2025).
 *
 * @see https://w3c-fedid.github.io/digital-credentials/
 */

interface DigitalCredentialRequestOptions {
	requests: Array<{
		protocol: string;
		data: unknown;
	}>;
}

interface DigitalCredentialResponse {
	protocol: string;
	data: unknown;
}

interface CredentialRequestOptions {
	digital?: DigitalCredentialRequestOptions;
}

/**
 * DigitalCredential class — available when browser supports Digital Credentials API.
 * Feature detection: `typeof DigitalCredential !== 'undefined'`
 */
declare class DigitalCredential extends Credential {
	readonly protocol: string;
	readonly data: unknown;

	/**
	 * Check if the user agent supports a specific protocol.
	 * @param protocol - e.g., 'org-iso-mdoc' or 'openid4vp'
	 */
	static userAgentAllowsProtocol?(protocol: string): boolean;
}
