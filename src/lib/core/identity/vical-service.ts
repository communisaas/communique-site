/**
 * VICAL Fetch Service — Runtime IACA Root Extraction
 *
 * Fetches the AAMVA Verified Issuer Certificate Authority List (VICAL) at
 * runtime and caches it in Workers KV. Provides dynamic trust store expansion
 * for states whose IACA roots are only available through the VICAL.
 *
 * AAMVA ToS prohibits redistribution of embedded certificates, so we fetch
 * and extract at runtime rather than bundling them statically.
 *
 * Architecture:
 *   - Workers KV cache (7-day TTL) for raw VICAL bytes across cold starts
 *   - In-memory parsed roots cache (1-hour) for warm worker reuse
 *   - Graceful degradation: VICAL fetch failure falls back to static roots only
 */

import type { IACACertificate } from './iaca-roots';
import { IACA_ROOTS, getIACARootsForVerification } from './iaca-roots';

/** Workers KV binding (minimal type — avoids @cloudflare/workers-types dependency) */
type KVNamespace = {
	get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string | ArrayBuffer | ArrayBufferView,
		options?: { expirationTtl?: number }
	): Promise<void>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VICAL_LISTING_URL = 'https://vical.dts.aamva.org/currentVical';
const VICAL_BASE_URL = 'https://vical.dts.aamva.org/vical/vc/';
const KV_CACHE_KEY = 'vical:current';
const KV_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ---------------------------------------------------------------------------
// Module-level cache (survives across requests on a warm worker instance)
// ---------------------------------------------------------------------------

let cachedRoots: IACACertificate[] | null = null;
let cacheTimestamp = 0;
const MEMORY_CACHE_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// ASN.1 / X.509 DER parsing helpers (Workers-compatible, no openssl)
// Ported from scripts/parse-vical.ts
// ---------------------------------------------------------------------------

function parseDERLength(data: Uint8Array, offset: number): { length: number; offset: number } | null {
	if (offset >= data.length) return null;
	const first = data[offset];
	if (first < 0x80) return { length: first, offset: offset + 1 };
	const numBytes = first & 0x7f;
	if (numBytes === 0 || numBytes > 4) return null;
	if (offset + 1 + numBytes > data.length) return null;
	let length = 0;
	for (let i = 0; i < numBytes; i++) {
		length = (length << 8) | data[offset + 1 + i];
	}
	return { length, offset: offset + 1 + numBytes };
}

function findBytes(haystack: Uint8Array, needle: Uint8Array, fromIndex = 0): number {
	const limit = haystack.length - needle.length;
	outer: for (let i = fromIndex; i <= limit; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) continue outer;
		}
		return i;
	}
	return -1;
}

/** OID 1.2.840.10045.2.1 — id-ecPublicKey */
const EC_PUBLIC_KEY_OID = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
/** OID 1.2.840.10045.3.1.7 — prime256v1 (P-256) */
const P256_CURVE_OID = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
/** OID 1.3.132.0.34 — secp384r1 (P-384) */
const P384_CURVE_OID = new Uint8Array([0x2b, 0x81, 0x04, 0x00, 0x22]);

function detectEcCurve(certDER: Uint8Array): 'P-256' | 'P-384' | null {
	const ecIdx = findBytes(certDER, EC_PUBLIC_KEY_OID);
	if (ecIdx === -1) return null;
	if (findBytes(certDER, P256_CURVE_OID, ecIdx) !== -1) return 'P-256';
	if (findBytes(certDER, P384_CURVE_OID, ecIdx) !== -1) return 'P-384';
	return null;
}

function parseDERTime(data: Uint8Array, offset: number): { date: Date; nextOffset: number } {
	const tag = data[offset];
	if (tag !== 0x17 && tag !== 0x18) throw new Error(`Expected time tag, got 0x${tag.toString(16)}`);
	const len = parseDERLength(data, offset + 1);
	if (!len) throw new Error('Invalid time length');
	const timeStr = new TextDecoder().decode(data.slice(len.offset, len.offset + len.length));
	let date: Date;
	if (tag === 0x17) {
		// UTCTime: YYMMDDHHMMSSZ
		const yy = parseInt(timeStr.slice(0, 2), 10);
		const year = yy < 50 ? 2000 + yy : 1900 + yy;
		date = new Date(
			`${year}-${timeStr.slice(2, 4)}-${timeStr.slice(4, 6)}T` +
			`${timeStr.slice(6, 8)}:${timeStr.slice(8, 10)}:${timeStr.slice(10, 12)}Z`
		);
	} else {
		// GeneralizedTime: YYYYMMDDHHMMSSZ
		date = new Date(
			`${timeStr.slice(0, 4)}-${timeStr.slice(4, 6)}-${timeStr.slice(6, 8)}T` +
			`${timeStr.slice(8, 10)}:${timeStr.slice(10, 12)}:${timeStr.slice(12, 14)}Z`
		);
	}
	return { date, nextOffset: len.offset + len.length };
}

function extractValidity(certDER: Uint8Array): { notBefore: Date; notAfter: Date } {
	if (certDER[0] !== 0x30) throw new Error('Not a SEQUENCE');
	const outerLen = parseDERLength(certDER, 1);
	if (!outerLen) throw new Error('Invalid outer length');
	let pos = outerLen.offset;
	// TBSCertificate SEQUENCE
	if (certDER[pos] !== 0x30) throw new Error('Invalid TBS');
	const tbsLen = parseDERLength(certDER, pos + 1);
	if (!tbsLen) throw new Error('Invalid TBS length');
	pos = tbsLen.offset;
	// Skip version [0] EXPLICIT (optional)
	if (certDER[pos] === 0xa0) {
		const vLen = parseDERLength(certDER, pos + 1);
		if (!vLen) throw new Error('Invalid version');
		pos = vLen.offset + vLen.length;
	}
	// Skip serial INTEGER
	if (certDER[pos] !== 0x02) throw new Error('Expected serial');
	const serialLen = parseDERLength(certDER, pos + 1);
	if (!serialLen) throw new Error('Invalid serial');
	pos = serialLen.offset + serialLen.length;
	// Skip signature algorithm SEQUENCE
	if (certDER[pos] !== 0x30) throw new Error('Expected sigAlg');
	const sigAlgLen = parseDERLength(certDER, pos + 1);
	if (!sigAlgLen) throw new Error('Invalid sigAlg');
	pos = sigAlgLen.offset + sigAlgLen.length;
	// Skip issuer SEQUENCE
	if (certDER[pos] !== 0x30) throw new Error('Expected issuer');
	const issuerLen = parseDERLength(certDER, pos + 1);
	if (!issuerLen) throw new Error('Invalid issuer');
	pos = issuerLen.offset + issuerLen.length;
	// Validity SEQUENCE
	if (certDER[pos] !== 0x30) throw new Error('Expected validity');
	const validityLen = parseDERLength(certDER, pos + 1);
	if (!validityLen) throw new Error('Invalid validity');
	let vPos = validityLen.offset;
	const nb = parseDERTime(certDER, vPos);
	vPos = nb.nextOffset;
	const na = parseDERTime(certDER, vPos);
	return { notBefore: nb.date, notAfter: na.date };
}

function extractSubjectCN(certDER: Uint8Array): string | null {
	// OID 2.5.4.3 = id-at-commonName
	const cnOid = new Uint8Array([0x55, 0x04, 0x03]);
	// Last occurrence = subject CN (issuer CN comes first in DER order)
	let lastCnPos = -1;
	let searchFrom = 0;
	while (true) {
		const found = findBytes(certDER, cnOid, searchFrom);
		if (found === -1) break;
		lastCnPos = found;
		searchFrom = found + 1;
	}
	if (lastCnPos === -1) return null;
	const valueStart = lastCnPos + cnOid.length;
	const tag = certDER[valueStart];
	// UTF8String (0x0c), PrintableString (0x13), or IA5String (0x16)
	if (tag !== 0x0c && tag !== 0x13 && tag !== 0x16) return null;
	const len = parseDERLength(certDER, valueStart + 1);
	if (!len) return null;
	return new TextDecoder().decode(certDER.slice(len.offset, len.offset + len.length));
}

function extractStateFromSubject(certDER: Uint8Array): string | null {
	// OID 2.5.4.8 = id-at-stateOrProvinceName
	const stOid = new Uint8Array([0x55, 0x04, 0x08]);
	let lastStPos = -1;
	let searchFrom = 0;
	while (true) {
		const found = findBytes(certDER, stOid, searchFrom);
		if (found === -1) break;
		lastStPos = found;
		searchFrom = found + 1;
	}
	if (lastStPos === -1) return null;
	const valueStart = lastStPos + stOid.length;
	const tag = certDER[valueStart];
	if (tag !== 0x0c && tag !== 0x13 && tag !== 0x16) return null;
	const len = parseDERLength(certDER, valueStart + 1);
	if (!len) return null;
	const stValue = new TextDecoder().decode(certDER.slice(len.offset, len.offset + len.length));
	// ST value is often "US-XX" format
	const match = stValue.match(/US-(\w{2})/);
	if (match) return match[1];
	if (stValue.length === 2) return stValue;
	return stValue;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

// ---------------------------------------------------------------------------
// VICAL fetch + KV cache
// ---------------------------------------------------------------------------

/**
 * Fetch the AAMVA VICAL and cache raw bytes in Workers KV.
 *
 * 1. Check KV cache (returns immediately if within 7-day TTL)
 * 2. Scrape AAMVA listing page to discover latest VICAL URL
 * 3. Download VICAL CBOR bytes
 * 4. Store in KV for subsequent requests
 *
 * @param kv  Workers KV binding (platform.env.VICAL_KV). Optional — works without caching.
 * @returns   Raw VICAL bytes, or null on failure
 */
export async function fetchAndCacheVICAL(kv?: KVNamespace): Promise<Uint8Array | null> {
	// Try KV cache first
	if (kv) {
		try {
			const cached = await kv.get(KV_CACHE_KEY, 'arrayBuffer');
			if (cached) return new Uint8Array(cached);
		} catch (e) {
			console.warn('[VICAL] KV read error:', e);
		}
	}

	try {
		// Step 1: Discover latest VICAL URL from listing page
		const listResponse = await fetch(VICAL_LISTING_URL);
		if (!listResponse.ok) {
			console.error(`[VICAL] Listing page fetch failed: ${listResponse.status}`);
			return null;
		}
		const html = await listResponse.text();
		const linkMatch = html.match(/href="\/vical\/vc\/(vc-[^"]+)"/);
		if (!linkMatch) {
			console.error('[VICAL] Could not find VICAL download link on AAMVA page');
			return null;
		}

		// Step 2: Download VICAL CBOR bytes
		const vicalUrl = `${VICAL_BASE_URL}${linkMatch[1]}`;
		const vicalResponse = await fetch(vicalUrl);
		if (!vicalResponse.ok) {
			console.error(`[VICAL] Download failed: ${vicalResponse.status}`);
			return null;
		}
		const vicalBytes = new Uint8Array(await vicalResponse.arrayBuffer());

		// Step 3: Cache in KV for subsequent requests
		if (kv) {
			try {
				await kv.put(KV_CACHE_KEY, vicalBytes, { expirationTtl: KV_TTL_SECONDS });
			} catch (e) {
				console.warn('[VICAL] KV write error:', e);
			}
		}

		return vicalBytes;
	} catch (e) {
		console.error('[VICAL] Fetch error:', e);
		return null;
	}
}

// ---------------------------------------------------------------------------
// VICAL CBOR extraction
// ---------------------------------------------------------------------------

/**
 * Extract IACA root certificates from VICAL CBOR bytes.
 *
 * Decodes the COSE_Sign1 outer structure, then the CBOR payload containing
 * certificateInfos. For each entry: extracts the X.509 DER certificate,
 * detects the EC curve, extracts state/issuer/validity metadata.
 *
 * Filters to mDL docTypes only (contains '18013').
 *
 * @param vicalBytes  Raw VICAL bytes (COSE_Sign1 CBOR)
 * @returns           Array of IACACertificate extracted from the VICAL
 */
export async function extractVICALRoots(vicalBytes: Uint8Array): Promise<IACACertificate[]> {
	const cborModule = await import('cbor-web');
	const cbor = cborModule.default ?? cborModule;
	const decode: (input: Uint8Array | ArrayBuffer) => unknown = cbor.decode;

	// Decode outer COSE_Sign1 = [protectedHeaders, unprotectedHeaders, payload, signature]
	const coseSign1 = decode(vicalBytes);
	if (!Array.isArray(coseSign1) || coseSign1.length !== 4) {
		throw new Error(`Expected COSE_Sign1 (4-element array), got ${typeof coseSign1}`);
	}

	const [, , payloadRaw] = coseSign1;

	// Decode payload CBOR
	let payloadBytes: Uint8Array;
	if (payloadRaw instanceof Uint8Array) {
		payloadBytes = payloadRaw;
	} else if (payloadRaw instanceof ArrayBuffer) {
		payloadBytes = new Uint8Array(payloadRaw);
	} else {
		throw new Error(`Unexpected payload type: ${typeof payloadRaw}`);
	}

	const vicalData = decode(payloadBytes);

	// Extract certificateInfos array
	let certInfos: unknown[];
	if (vicalData instanceof Map) {
		certInfos = vicalData.get('certificateInfos') as unknown[];
	} else {
		certInfos = (vicalData as Record<string, unknown>).certificateInfos as unknown[];
	}

	if (!certInfos || !Array.isArray(certInfos)) {
		throw new Error('No certificateInfos in VICAL payload');
	}

	const roots: IACACertificate[] = [];

	for (const entry of certInfos) {
		let certificate: Uint8Array | undefined;
		let docType: unknown;
		let vicalState: string | undefined;
		let vicalIssuer: string | undefined;
		let vicalNotAfter: Date | undefined;

		if (entry instanceof Map) {
			certificate = entry.get('certificate') as Uint8Array | undefined;
			docType = entry.get('docType');
			vicalState = entry.get('stateOrProvinceName') as string | undefined;
			vicalIssuer = entry.get('issuingAuthority') as string | undefined;
			const na = entry.get('notAfter');
			if (na instanceof Date) vicalNotAfter = na;
			else if (typeof na === 'string') vicalNotAfter = new Date(na);
		} else if (typeof entry === 'object' && entry !== null) {
			const e = entry as Record<string, unknown>;
			certificate = e.certificate as Uint8Array | undefined;
			docType = e.docType;
			vicalState = e.stateOrProvinceName as string | undefined;
			vicalIssuer = e.issuingAuthority as string | undefined;
			const na = e.notAfter;
			if (na instanceof Date) vicalNotAfter = na;
			else if (typeof na === 'string') vicalNotAfter = new Date(na);
		}

		if (!certificate || !(certificate instanceof Uint8Array)) continue;

		// Filter to mDL docTypes only
		const docTypeStr = Array.isArray(docType) ? docType[0] : docType;
		if (docTypeStr && typeof docTypeStr === 'string' && !docTypeStr.includes('18013')) {
			continue;
		}

		// Detect EC curve (skip non-EC or unsupported curves)
		const curve = detectEcCurve(certificate);
		if (!curve) continue;

		// Extract state — prefer VICAL metadata, fall back to DER parsing
		let state = vicalState ?? extractStateFromSubject(certificate) ?? 'UNKNOWN';
		if (state.startsWith('US-')) state = state.slice(3);

		// Extract issuer name
		let issuerName: string;
		if (vicalIssuer) {
			const cnMatch = vicalIssuer.match(/cn=([^,]+)/i);
			issuerName = cnMatch ? cnMatch[1] : vicalIssuer;
		} else {
			issuerName = extractSubjectCN(certificate) ?? 'Unknown IACA Root';
		}

		// Extract expiry
		let expiresAt: string;
		if (vicalNotAfter) {
			expiresAt = vicalNotAfter.toISOString();
		} else {
			try {
				const validity = extractValidity(certificate);
				expiresAt = validity.notAfter.toISOString();
			} catch {
				continue; // Skip certs with unparseable validity
			}
		}

		roots.push({
			state: state.toUpperCase(),
			issuer: issuerName,
			certificateB64: uint8ArrayToBase64(certificate),
			derBytes: certificate,
			expiresAt,
		});
	}

	return roots;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Unified IACA root lookup — static trust store first, VICAL fallback.
 *
 * @param issuerName  State abbreviation (e.g., 'NY', 'WV', 'KY')
 * @param kv          Workers KV binding for VICAL cache (platform.env.VICAL_KV)
 * @returns           First matching IACACertificate, or null
 */
export async function getIACARoot(
	issuerName: string,
	kv?: KVNamespace
): Promise<IACACertificate | null> {
	const state = issuerName.toUpperCase();

	// Fast path: static roots
	const staticRoots = IACA_ROOTS[state];
	if (staticRoots?.length) return staticRoots[0];

	// Slow path: lazy-load VICAL on first miss
	const vicalRoots = await loadVICALRoots(kv);
	return vicalRoots.find((r) => r.state === state) ?? null;
}

/**
 * Get merged static + VICAL IACA roots for verification.
 *
 * Static roots take precedence — VICAL roots are only included for states
 * not already in the static trust store (IACA_ROOTS).
 *
 * Call this from getIACARootsForVerification() in iaca-roots.ts after
 * integration review.
 *
 * @param kv  Workers KV binding for VICAL cache (platform.env.VICAL_KV)
 * @returns   Combined array of all IACA root certificates
 */
export async function getExpandedIACARoots(
	kv?: KVNamespace
): Promise<IACACertificate[]> {
	const staticRoots = getIACARootsForVerification();
	const vicalRoots = await loadVICALRoots(kv);

	// Only include VICAL roots for states not already in static trust store
	const vicalOnly = vicalRoots.filter((r) => !(r.state in IACA_ROOTS));
	return [...staticRoots, ...vicalOnly];
}

// ---------------------------------------------------------------------------
// Internal: load + cache VICAL roots (memory-cached for warm instances)
// ---------------------------------------------------------------------------

async function loadVICALRoots(kv?: KVNamespace): Promise<IACACertificate[]> {
	// Return memory-cached result if fresh
	if (cachedRoots && Date.now() - cacheTimestamp < MEMORY_CACHE_MS) {
		return cachedRoots;
	}

	const vicalBytes = await fetchAndCacheVICAL(kv);
	if (!vicalBytes) {
		// Graceful degradation: no VICAL available
		cachedRoots = [];
		cacheTimestamp = Date.now();
		return cachedRoots;
	}

	try {
		cachedRoots = await extractVICALRoots(vicalBytes);
		cacheTimestamp = Date.now();
	} catch (e) {
		console.error('[VICAL] Parse error:', e);
		cachedRoots = [];
		cacheTimestamp = Date.now();
	}

	return cachedRoots;
}
