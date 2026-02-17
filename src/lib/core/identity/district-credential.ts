/**
 * District Credential Issuance & Verification
 *
 * W3C Verifiable Credential 2.0 implementation for district residency attestation.
 * Tier 2 in the Graduated Trust Architecture.
 *
 * Signing:
 *   HMAC-SHA256 using IDENTITY_HASH_SALT as the key (pragmatic choice for CF Workers).
 *   Full Ed25519 VC signing deferred to Cycle 4 when TEE infrastructure is ready.
 *
 * All crypto uses the Web Crypto API (no Node.js `crypto`, no Buffer).
 */

import { TIER_CREDENTIAL_TTL } from '$lib/core/identity/credential-policy';

// ============================================================================
// Types
// ============================================================================

export interface DistrictMembership {
	congressional: string; // e.g., "CA-12"
	stateSenate?: string;
	stateAssembly?: string;
}

export interface DistrictResidencyCredential {
	'@context': ['https://www.w3.org/ns/credentials/v2'];
	type: ['VerifiableCredential', 'DistrictResidencyCredential'];
	issuer: string; // 'did:web:communique.io'
	issuanceDate: string; // ISO 8601
	expirationDate: string; // ISO 8601 (90 days from issuance)
	credentialSubject: {
		id: string; // user's did:key or fallback user ID
		districtMembership: DistrictMembership;
	};
	proof: {
		type: 'Ed25519Signature2020';
		created: string;
		verificationMethod: string;
		proofPurpose: 'assertionMethod';
		proofValue: string; // base64url-encoded HMAC signature
	};
}

export interface IssueDistrictCredentialParams {
	userId: string;
	didKey: string | null;
	congressional: string;
	stateSenate?: string;
	stateAssembly?: string;
	verificationMethod: 'civic_api' | 'postal';
}

// ============================================================================
// Constants
// ============================================================================

const ISSUER_DID = 'did:web:communique.io';
const VERIFICATION_METHOD = `${ISSUER_DID}#district-attestation-key`;

// ============================================================================
// Internal Helpers (Web Crypto only, CF Workers compatible)
// ============================================================================

const encoder = new TextEncoder();

/**
 * Import HMAC key from the platform salt string.
 */
async function getHmacKey(): Promise<CryptoKey> {
	const salt = process.env.IDENTITY_HASH_SALT;
	if (!salt) {
		throw new Error(
			'IDENTITY_HASH_SALT environment variable not configured. ' +
				'Generate with: openssl rand -hex 32'
		);
	}

	return crypto.subtle.importKey(
		'raw',
		encoder.encode(salt),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

/**
 * Encode a Uint8Array as base64url (no padding), CF Workers compatible.
 */
function base64urlEncode(bytes: Uint8Array): string {
	// Use a manual approach that works on CF Workers (no btoa dependency issues)
	const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let result = '';
	const len = bytes.length;
	for (let i = 0; i < len; i += 3) {
		const b0 = bytes[i];
		const b1 = i + 1 < len ? bytes[i + 1] : 0;
		const b2 = i + 2 < len ? bytes[i + 2] : 0;
		result += CHARS[(b0 >> 2) & 0x3f];
		result += CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f];
		if (i + 1 < len) result += CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f];
		if (i + 2 < len) result += CHARS[b2 & 0x3f];
	}
	// Convert to base64url: replace + with -, / with _, strip =
	return result.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Decode base64url string to Uint8Array, CF Workers compatible.
 */
function base64urlDecode(str: string): Uint8Array {
	// Convert base64url back to standard base64
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	// Add padding
	while (base64.length % 4 !== 0) {
		base64 += '=';
	}

	const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	const lookup = new Uint8Array(128);
	for (let i = 0; i < CHARS.length; i++) {
		lookup[CHARS.charCodeAt(i)] = i;
	}

	const len = base64.length;
	const padCount = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
	const byteLen = (len * 3) / 4 - padCount;
	const bytes = new Uint8Array(byteLen);

	let j = 0;
	for (let i = 0; i < len; i += 4) {
		const a = lookup[base64.charCodeAt(i)];
		const b = lookup[base64.charCodeAt(i + 1)];
		const c = lookup[base64.charCodeAt(i + 2)];
		const d = lookup[base64.charCodeAt(i + 3)];

		bytes[j++] = (a << 2) | (b >> 4);
		if (j < byteLen) bytes[j++] = ((b & 0x0f) << 4) | (c >> 2);
		if (j < byteLen) bytes[j++] = ((c & 0x03) << 6) | d;
	}

	return bytes;
}

/**
 * Build the credential body (everything EXCEPT the proof field).
 * This is the data that gets signed/verified.
 */
function buildCredentialBody(
	params: IssueDistrictCredentialParams,
	issuanceDate: string,
	expirationDate: string
): Omit<DistrictResidencyCredential, 'proof'> {
	const membership: DistrictMembership = {
		congressional: params.congressional
	};
	if (params.stateSenate) membership.stateSenate = params.stateSenate;
	if (params.stateAssembly) membership.stateAssembly = params.stateAssembly;

	return {
		'@context': ['https://www.w3.org/ns/credentials/v2'],
		type: ['VerifiableCredential', 'DistrictResidencyCredential'],
		issuer: ISSUER_DID,
		issuanceDate,
		expirationDate,
		credentialSubject: {
			id: params.didKey ?? `urn:communique:user:${params.userId}`,
			districtMembership: membership
		}
	};
}

/**
 * Deep-sort object keys for canonical JSON (recursive).
 */
function deepSortKeys(obj: unknown): unknown {
	if (obj === null || typeof obj !== 'object') return obj;
	if (Array.isArray(obj)) return obj.map(deepSortKeys);
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
		sorted[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
	}
	return sorted;
}

/**
 * Produce deterministic JSON of any object (recursive key sort).
 */
function deterministicJSON(obj: unknown): string {
	return JSON.stringify(deepSortKeys(obj));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Issue a W3C VC 2.0 DistrictResidencyCredential.
 *
 * Signs the credential body with HMAC-SHA256 using the platform salt.
 * Expiration is TIER_CREDENTIAL_TTL[2] (90 days) from now.
 */
export async function issueDistrictCredential(
	params: IssueDistrictCredentialParams
): Promise<DistrictResidencyCredential> {
	const now = new Date();
	const ttl = TIER_CREDENTIAL_TTL[2]; // 90 days in ms
	const expiry = new Date(now.getTime() + ttl);

	const issuanceDate = now.toISOString();
	const expirationDate = expiry.toISOString();

	const body = buildCredentialBody(params, issuanceDate, expirationDate);

	// Sign the canonical body
	const key = await getHmacKey();
	const bodyBytes = encoder.encode(deterministicJSON(body));
	const signature = await crypto.subtle.sign('HMAC', key, bodyBytes);
	const proofValue = base64urlEncode(new Uint8Array(signature));

	const credential: DistrictResidencyCredential = {
		...body,
		proof: {
			type: 'Ed25519Signature2020',
			created: issuanceDate,
			verificationMethod: VERIFICATION_METHOD,
			proofPurpose: 'assertionMethod',
			proofValue
		}
	};

	return credential;
}

/**
 * Verify a DistrictResidencyCredential by recomputing the HMAC.
 *
 * Returns true if the credential body was signed with the current platform salt
 * and has not been tampered with.
 */
export async function verifyDistrictCredential(
	credential: DistrictResidencyCredential
): Promise<boolean> {
	try {
		// Reconstruct the body (everything except `proof`)
		const { proof: _proof, ...body } = credential;

		const key = await getHmacKey();
		const bodyBytes = encoder.encode(deterministicJSON(body));
		const signatureBytes = base64urlDecode(credential.proof.proofValue);

		return crypto.subtle.verify(
			'HMAC',
			key,
			signatureBytes as unknown as BufferSource,
			bodyBytes
		);
	} catch {
		return false;
	}
}

/**
 * Compute SHA-256 hash of a credential for integrity tracking.
 *
 * The hash covers the ENTIRE credential (including proof) so that any
 * modification — even to metadata — is detectable.
 *
 * Returns a lowercase hex string.
 */
export async function hashCredential(
	credential: DistrictResidencyCredential
): Promise<string> {
	const bytes = encoder.encode(deterministicJSON(credential));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const arr = new Uint8Array(digest);
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Compute SHA-256 hash of a district string for privacy-preserving storage.
 *
 * Used for the User.district_hash field — stores a hash of the congressional
 * district so that the plaintext district is not persisted on the user record.
 *
 * Returns a lowercase hex string.
 */
export async function hashDistrict(district: string): Promise<string> {
	const bytes = encoder.encode(district);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const arr = new Uint8Array(digest);
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
