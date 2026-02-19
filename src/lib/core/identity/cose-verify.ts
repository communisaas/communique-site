/**
 * COSE_Sign1 Verification for ISO 18013-5 mDL Credentials
 *
 * Implements RFC 9052 Section 4.2 (COSE_Sign1) signature verification
 * using Web Crypto API ECDSA P-256 — Cloudflare Workers compatible.
 *
 * COSE_Sign1 = [protectedHeaders, unprotectedHeaders, payload, signature]
 * Sig_structure = ["Signature1", protectedHeaders, externalAad, payload]
 *
 * The issuer's X.509 certificate is extracted from unprotectedHeaders (key 33 = x5chain),
 * its ECDSA P-256 public key is parsed via minimal ASN.1/DER extraction, then imported
 * into Web Crypto for signature verification.
 *
 * Dependencies: cbor-web (CBOR encode/decode), Web Crypto API (ECDSA verification)
 * No Node.js crypto, no Buffer — runs on CF Workers.
 */

import type { IACACertificate } from './iaca-roots';

/** Type-safe BufferSource conversion — Uint8Array is a valid BufferSource at runtime;
 *  this helper avoids cross-realm type issues in test environments (vitest/jsdom). */
function toBufferSource(data: Uint8Array | ArrayBuffer): BufferSource {
	return data as BufferSource;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CoseVerificationResult =
	| { valid: true; mso: MobileSecurityObject }
	| { valid: false; reason: string };

export interface MobileSecurityObject {
	version: string;
	digestAlgorithm: string;
	/** namespace -> { digestID -> digest } */
	valueDigests: Map<string, Map<number, Uint8Array>>;
	validityInfo: {
		signed: Date;
		validFrom: Date;
		validUntil: Date;
	};
	/** Raw DER bytes of the issuer certificate */
	issuerCertificate: Uint8Array;
}

// ---------------------------------------------------------------------------
// COSE algorithm identifiers (RFC 9053)
// ---------------------------------------------------------------------------

/** ES256 = ECDSA w/ SHA-256 using P-256 */
const COSE_ALG_ES256 = -7;

/** COSE header key for algorithm */
const COSE_HEADER_ALG = 1;

/** COSE unprotected header key for x5chain (X.509 certificate chain) */
const COSE_HEADER_X5CHAIN = 33;

// ---------------------------------------------------------------------------
// ASN.1 OIDs for X.509 EC public key extraction
// ---------------------------------------------------------------------------

/** OID 1.2.840.10045.2.1 — id-ecPublicKey */
const EC_PUBLIC_KEY_OID = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);

/** OID 1.2.840.10045.3.1.7 — prime256v1 (P-256) */
const P256_CURVE_OID = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);

// ---------------------------------------------------------------------------
// Main verification function
// ---------------------------------------------------------------------------

/**
 * Verify a COSE_Sign1 structure from an mDL issuerAuth.
 *
 * @param issuerAuth  COSE_Sign1 array [protectedHeadersCBOR, unprotectedHeaders, payload, signature]
 * @param trustedRoots  Array of IACA root certificates to verify against
 * @returns Verification result with parsed MSO on success
 */
export async function verifyCoseSign1(
	issuerAuth: unknown[],
	trustedRoots: IACACertificate[]
): Promise<CoseVerificationResult> {
	const { decode, encode } = await import('cbor-web');

	// --- Validate COSE_Sign1 structure ---
	if (!Array.isArray(issuerAuth) || issuerAuth.length !== 4) {
		return { valid: false, reason: 'COSE_Sign1 must be a 4-element array' };
	}

	const [protectedHeadersRaw, unprotectedHeaders, payloadRaw, signature] = issuerAuth;

	// --- Protected headers: CBOR-encoded bstr ---
	let protectedHeadersCBOR: Uint8Array;
	if (protectedHeadersRaw instanceof Uint8Array) {
		protectedHeadersCBOR = protectedHeadersRaw;
	} else if (protectedHeadersRaw instanceof ArrayBuffer) {
		protectedHeadersCBOR = new Uint8Array(protectedHeadersRaw);
	} else {
		return { valid: false, reason: 'Protected headers must be a byte string' };
	}

	// Decode protected headers to check algorithm
	let protectedHeaders: Map<number, unknown>;
	try {
		const decoded = decode(protectedHeadersCBOR);
		if (decoded instanceof Map) {
			protectedHeaders = decoded;
		} else if (typeof decoded === 'object' && decoded !== null) {
			protectedHeaders = new Map(Object.entries(decoded).map(([k, v]) => [Number(k), v]));
		} else {
			return { valid: false, reason: 'Protected headers did not decode to a map' };
		}
	} catch {
		return { valid: false, reason: 'Failed to decode protected headers CBOR' };
	}

	const algorithm = protectedHeaders.get(COSE_HEADER_ALG);
	if (algorithm !== COSE_ALG_ES256) {
		return {
			valid: false,
			reason: `Unsupported COSE algorithm: ${algorithm} (expected ES256 = -7)`
		};
	}

	// --- Signature must be bytes ---
	let signatureBytes: Uint8Array;
	if (signature instanceof Uint8Array) {
		signatureBytes = signature;
	} else if (signature instanceof ArrayBuffer) {
		signatureBytes = new Uint8Array(signature);
	} else {
		return { valid: false, reason: 'Signature must be a byte string' };
	}

	// ES256 signature should be 64 bytes (r || s, each 32 bytes)
	if (signatureBytes.length !== 64) {
		return {
			valid: false,
			reason: `Invalid ES256 signature length: ${signatureBytes.length} (expected 64)`
		};
	}

	// --- Payload (MSO) ---
	let payloadCBOR: Uint8Array;
	if (payloadRaw instanceof Uint8Array) {
		payloadCBOR = payloadRaw;
	} else if (payloadRaw instanceof ArrayBuffer) {
		payloadCBOR = new Uint8Array(payloadRaw);
	} else if (payloadRaw === null) {
		// Detached payload — not supported for mDL
		return { valid: false, reason: 'Detached COSE_Sign1 payload not supported' };
	} else {
		return { valid: false, reason: 'Payload must be a byte string' };
	}

	// --- Extract issuer certificate from unprotected headers ---
	let issuerCertDER: Uint8Array;
	try {
		issuerCertDER = extractIssuerCert(unprotectedHeaders);
	} catch (err) {
		return {
			valid: false,
			reason: `Failed to extract issuer certificate: ${err instanceof Error ? err.message : String(err)}`
		};
	}

	// --- Trust store check: verify issuer cert chains to a trusted root ---
	const trusted = checkTrustChain(issuerCertDER, trustedRoots);
	if (!trusted) {
		return { valid: false, reason: 'Issuer certificate not found in IACA trust store' };
	}

	// --- Extract ECDSA P-256 public key from issuer certificate ---
	let publicKey: CryptoKey;
	try {
		const rawKey = extractEcPublicKeyFromDER(issuerCertDER);
		publicKey = await crypto.subtle.importKey(
			'raw',
			toBufferSource(rawKey),
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify']
		);
	} catch (err) {
		return {
			valid: false,
			reason: `Failed to extract/import public key: ${err instanceof Error ? err.message : String(err)}`
		};
	}

	// --- Build Sig_structure and verify ---
	// Sig_structure = ["Signature1", protectedHeadersCBOR, externalAad, payloadCBOR]
	const sigStructure = ['Signature1', protectedHeadersCBOR, new Uint8Array(0), payloadCBOR];

	let sigStructureEncoded: Uint8Array;
	try {
		sigStructureEncoded = new Uint8Array(encode(sigStructure));
	} catch {
		return { valid: false, reason: 'Failed to CBOR-encode Sig_structure' };
	}

	// COSE signature is raw format (r || s, 64 bytes for P-256).
	// Web Crypto API also uses raw (IEEE P1363) format for ECDSA — pass directly.
	let valid: boolean;
	try {
		valid = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			publicKey,
			toBufferSource(signatureBytes),
			toBufferSource(sigStructureEncoded)
		);
	} catch (err) {
		return {
			valid: false,
			reason: `Signature verification threw: ${err instanceof Error ? err.message : String(err)}`
		};
	}

	if (!valid) {
		return { valid: false, reason: 'ECDSA signature verification failed' };
	}

	// --- Parse MSO from payload ---
	let mso: MobileSecurityObject;
	try {
		mso = parseMobileSecurityObject(payloadCBOR, issuerCertDER, decode);
	} catch (err) {
		return {
			valid: false,
			reason: `Failed to parse MSO: ${err instanceof Error ? err.message : String(err)}`
		};
	}

	return { valid: true, mso };
}

// ---------------------------------------------------------------------------
// MSO digest validation
// ---------------------------------------------------------------------------

/**
 * Validate MSO digests against actual IssuerSignedItem elements.
 *
 * For each field in the namespace, compute SHA-256 of the CBOR-encoded
 * IssuerSignedItem and verify it matches the corresponding valueDigest entry
 * in the MSO.
 *
 * @param mso  Parsed MobileSecurityObject with valueDigests
 * @param namespaceElements  { namespace: [IssuerSignedItem CBOR bytes, ...] }
 * @param decode  CBOR decode function
 * @param encode  CBOR encode function
 * @returns true if all digests match
 */
export async function validateMsoDigests(
	mso: MobileSecurityObject,
	namespaceElements: Record<string, unknown[]>,
	decode: (data: Uint8Array) => unknown,
	encode: (data: unknown) => Uint8Array
): Promise<boolean> {
	for (const [namespace, elements] of Object.entries(namespaceElements)) {
		const nsDigests = mso.valueDigests.get(namespace);
		if (!nsDigests) {
			// Namespace not in MSO — cannot validate
			continue;
		}

		for (const element of elements) {
			let elementBytes: Uint8Array;
			let item: Record<string, unknown>;

			if (element instanceof Uint8Array) {
				elementBytes = element;
				item = decode(element) as Record<string, unknown>;
			} else if (typeof element === 'object' && element !== null) {
				// Handle CBOR Tagged values (tag 24)
				const tagged = element as { tag?: number; value?: Uint8Array };
				if (tagged.tag === 24 && tagged.value instanceof Uint8Array) {
					elementBytes = tagged.value;
					item = decode(tagged.value) as Record<string, unknown>;
				} else {
					// Already decoded object — encode it for hashing
					elementBytes = new Uint8Array(encode(element));
					item = element as Record<string, unknown>;
				}
			} else {
				continue;
			}

			const digestID =
				typeof item.digestID === 'number'
					? item.digestID
					: typeof item.digestId === 'number'
						? item.digestId
						: null;

			if (digestID === null) continue;

			const expectedDigest = nsDigests.get(digestID);
			if (!expectedDigest) {
				// Digest ID not in MSO — element was not signed
				return false;
			}

			// Compute SHA-256 of the CBOR-encoded IssuerSignedItem
			const actualDigest = new Uint8Array(
				await crypto.subtle.digest('SHA-256', toBufferSource(elementBytes))
			);

			if (!uint8ArrayEqual(actualDigest, expectedDigest)) {
				return false;
			}
		}
	}

	return true;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the issuer certificate (DER bytes) from COSE unprotected headers.
 * The certificate is at key 33 (x5chain).
 */
function extractIssuerCert(unprotectedHeaders: unknown): Uint8Array {
	if (!unprotectedHeaders || typeof unprotectedHeaders !== 'object') {
		throw new Error('No unprotected headers');
	}

	let cert: unknown;

	if (unprotectedHeaders instanceof Map) {
		cert = unprotectedHeaders.get(COSE_HEADER_X5CHAIN);
	} else {
		const headers = unprotectedHeaders as Record<string | number, unknown>;
		cert = headers[COSE_HEADER_X5CHAIN] ?? headers['33'];
	}

	if (!cert) {
		throw new Error('No x5chain (key 33) in unprotected headers');
	}

	// x5chain can be a single cert (bstr) or array of certs
	if (cert instanceof Uint8Array) {
		return cert;
	}
	if (cert instanceof ArrayBuffer) {
		return new Uint8Array(cert);
	}
	if (Array.isArray(cert) && cert.length > 0) {
		const first = cert[0];
		if (first instanceof Uint8Array) return first;
		if (first instanceof ArrayBuffer) return new Uint8Array(first);
	}

	throw new Error('x5chain value is not a byte string or array of byte strings');
}

/**
 * Check if the issuer certificate chains to one of the trusted IACA roots.
 *
 * For now, this does a simple byte comparison of the issuer certificate
 * against the DER bytes of each trusted root. In a full implementation,
 * this would walk the certificate chain and verify each link.
 *
 * When IACA roots contain intermediate CAs, this should be extended to
 * build and verify the full chain up to the root.
 */
function checkTrustChain(issuerCertDER: Uint8Array, trustedRoots: IACACertificate[]): boolean {
	for (const root of trustedRoots) {
		// Decode the root's base64 DER to compare
		let rootDER: Uint8Array;
		if (root.derBytes) {
			rootDER = root.derBytes;
		} else {
			rootDER = base64ToUint8Array(root.certificateB64);
		}

		// Direct match: issuer cert IS the root (self-signed root scenario)
		if (uint8ArrayEqual(issuerCertDER, rootDER)) {
			return true;
		}

		// TODO: Full chain validation — extract issuer DN from cert,
		// match against root subject DN, verify intermediate signatures.
		// For production: use a proper X.509 chain validator.
	}

	return false;
}

/**
 * Minimal ASN.1/DER parser to extract an EC P-256 public key from an X.509 certificate.
 *
 * Searches for the SubjectPublicKeyInfo structure containing:
 *   - OID 1.2.840.10045.2.1 (id-ecPublicKey)
 *   - OID 1.2.840.10045.3.1.7 (prime256v1 / P-256)
 *
 * Then extracts the 65-byte uncompressed point (04 || x || y) from the BIT STRING.
 */
export function extractEcPublicKeyFromDER(certDER: Uint8Array): Uint8Array {
	// Find the EC public key OID
	const ecOidIndex = findBytes(certDER, EC_PUBLIC_KEY_OID);
	if (ecOidIndex === -1) {
		throw new Error('EC public key OID not found in certificate');
	}

	// Find the P-256 curve OID after the EC OID
	const curveOidIndex = findBytes(certDER, P256_CURVE_OID, ecOidIndex);
	if (curveOidIndex === -1) {
		throw new Error('P-256 curve OID not found in certificate');
	}

	// After the curve OID, find the BIT STRING containing the public key.
	// BIT STRING tag = 0x03
	// The public key BIT STRING follows the AlgorithmIdentifier SEQUENCE.
	// Search for BIT STRING tag after the curve OID
	const searchStart = curveOidIndex + P256_CURVE_OID.length;

	for (let i = searchStart; i < certDER.length - 67; i++) {
		if (certDER[i] === 0x03) {
			// BIT STRING tag
			const len = parseDERLength(certDER, i + 1);
			if (!len) continue;

			const contentStart = len.offset;
			const contentLen = len.length;

			// BIT STRING for EC key: first byte is 0x00 (unused bits),
			// then 0x04 (uncompressed point), then 64 bytes (x || y)
			if (
				contentLen === 66 &&
				certDER[contentStart] === 0x00 &&
				certDER[contentStart + 1] === 0x04
			) {
				return certDER.slice(contentStart + 1, contentStart + 1 + 65);
			}
		}
	}

	throw new Error('Could not find uncompressed EC P-256 public key in certificate');
}

/**
 * Parse the MSO (MobileSecurityObject) from CBOR payload bytes.
 *
 * The payload may be wrapped in CBOR tag 24 (encoded CBOR data item).
 */
function parseMobileSecurityObject(
	payloadCBOR: Uint8Array,
	issuerCertDER: Uint8Array,
	decode: (data: Uint8Array) => unknown
): MobileSecurityObject {
	let msoData = decode(payloadCBOR) as unknown;

	// Unwrap tag 24 if present (CBOR bstr-wrapped data)
	if (msoData && typeof msoData === 'object' && 'tag' in (msoData as Record<string, unknown>)) {
		const tagged = msoData as { tag: number; value: unknown };
		if (tagged.tag === 24) {
			if (tagged.value instanceof Uint8Array) {
				msoData = decode(tagged.value);
			} else {
				msoData = tagged.value;
			}
		}
	}

	const mso = msoData as Record<string, unknown>;

	// Extract version
	const version = String(mso.version ?? '1.0');

	// Extract digest algorithm
	const digestAlgorithm = String(mso.digestAlgorithm ?? 'SHA-256');

	// Extract valueDigests: Map<string, Map<number, Uint8Array>>
	const valueDigests = new Map<string, Map<number, Uint8Array>>();
	const rawDigests = mso.valueDigests;

	if (rawDigests instanceof Map) {
		Array.from(rawDigests.entries()).forEach(([ns, digests]) => {
			const nsMap = new Map<number, Uint8Array>();
			if (digests instanceof Map) {
				Array.from((digests as Map<unknown, unknown>).entries()).forEach(([id, digest]) => {
					if (digest instanceof Uint8Array) {
						nsMap.set(Number(id), digest);
					}
				});
			}
			valueDigests.set(String(ns), nsMap);
		});
	} else if (typeof rawDigests === 'object' && rawDigests !== null) {
		for (const [ns, digests] of Object.entries(rawDigests as Record<string, unknown>)) {
			const nsMap = new Map<number, Uint8Array>();
			if (digests instanceof Map) {
				Array.from((digests as Map<unknown, unknown>).entries()).forEach(([id, digest]) => {
					if (digest instanceof Uint8Array) {
						nsMap.set(Number(id), digest);
					}
				});
			} else if (typeof digests === 'object' && digests !== null) {
				for (const [id, digest] of Object.entries(digests as Record<string, unknown>)) {
					if (digest instanceof Uint8Array) {
						nsMap.set(Number(id), digest);
					}
				}
			}
			valueDigests.set(ns, nsMap);
		}
	}

	// Extract validityInfo
	const rawValidity = mso.validityInfo as Record<string, unknown> | undefined;
	const validityInfo = {
		signed: parseDate(rawValidity?.signed),
		validFrom: parseDate(rawValidity?.validFrom),
		validUntil: parseDate(rawValidity?.validUntil)
	};

	return {
		version,
		digestAlgorithm,
		valueDigests,
		validityInfo,
		issuerCertificate: issuerCertDER
	};
}

// ---------------------------------------------------------------------------
// Byte-level helpers
// ---------------------------------------------------------------------------

/**
 * Find a byte sequence within a larger array, starting from an offset.
 */
function findBytes(haystack: Uint8Array, needle: Uint8Array, fromIndex = 0): number {
	const limit = haystack.length - needle.length;
	outer: for (let i = fromIndex; i <= limit; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) {
				continue outer;
			}
		}
		return i;
	}
	return -1;
}

/**
 * Parse a DER length field starting at the given offset.
 * Returns the decoded length and the offset where content begins.
 */
function parseDERLength(
	data: Uint8Array,
	offset: number
): { length: number; offset: number } | null {
	if (offset >= data.length) return null;

	const first = data[offset];
	if (first < 0x80) {
		// Short form
		return { length: first, offset: offset + 1 };
	}

	const numBytes = first & 0x7f;
	if (numBytes === 0 || numBytes > 4) return null;
	if (offset + 1 + numBytes > data.length) return null;

	let length = 0;
	for (let i = 0; i < numBytes; i++) {
		length = (length << 8) | data[offset + 1 + i];
	}

	return { length, offset: offset + 1 + numBytes };
}

/** Parse a date from various CBOR representations */
function parseDate(value: unknown): Date {
	if (value instanceof Date) return value;
	if (typeof value === 'string') return new Date(value);
	if (typeof value === 'number') return new Date(value * 1000);
	// CBOR tagged date-time (tag 0 = text, tag 1 = epoch)
	if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
		return parseDate((value as { value: unknown }).value);
	}
	return new Date(0);
}

/** Compare two Uint8Arrays for equality */
function uint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/** Decode base64 string to Uint8Array (Workers-compatible, no Buffer) */
function base64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}
