/**
 * AAMVA VICAL Parser — Extract IACA Root Certificates
 *
 * Downloads and parses the AAMVA Verified Issuer Certificate Authority List (VICAL).
 * The VICAL is a COSE_Sign1 artifact (CBOR-encoded) containing all participating
 * states' IACA root certificates for mDL verification.
 *
 * Usage: npx tsx scripts/parse-vical.ts [--url <vical-url>] [--file <local-path>]
 *
 * Output: Prints IACA_ROOTS entries ready to paste into iaca-roots.ts
 *
 * VICAL structure (ISO 18013-5 Annex B):
 *   COSE_Sign1 = [protectedHeaders, unprotectedHeaders, payload, signature]
 *   payload (CBOR) = {
 *     version: int,
 *     vicalProvider: tstr,
 *     date: tdate,
 *     vicalIssueID: int,
 *     certificateInfos: [CertificateInfo, ...]
 *   }
 *   CertificateInfo = {
 *     certificate: bstr (X.509 DER),
 *     ...issuer metadata
 *   }
 */

// cbor-web uses dynamic import in production (Workers-compatible)
const { decode } = await import('cbor-web');

// ---------------------------------------------------------------------------
// ASN.1 / X.509 DER parsing helpers (self-contained, no openssl dependency)
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
/** OID 1.3.132.0.35 — secp521r1 (P-521) */
const P521_CURVE_OID = new Uint8Array([0x2b, 0x81, 0x04, 0x00, 0x23]);

/** Detect EC curve used in an X.509 certificate */
function detectEcCurve(certDER: Uint8Array): 'P-256' | 'P-384' | 'P-521' | null {
	const ecIdx = findBytes(certDER, EC_PUBLIC_KEY_OID);
	if (ecIdx === -1) return null;
	if (findBytes(certDER, P256_CURVE_OID, ecIdx) !== -1) return 'P-256';
	if (findBytes(certDER, P384_CURVE_OID, ecIdx) !== -1) return 'P-384';
	if (findBytes(certDER, P521_CURVE_OID, ecIdx) !== -1) return 'P-521';
	return null;
}

/** Parse DER time value (UTCTime 0x17 or GeneralizedTime 0x18) */
function parseDERTime(data: Uint8Array, offset: number): { date: Date; nextOffset: number } {
	const tag = data[offset];
	if (tag !== 0x17 && tag !== 0x18) throw new Error(`Expected time tag, got 0x${tag.toString(16)}`);
	const len = parseDERLength(data, offset + 1);
	if (!len) throw new Error('Invalid time length');
	const timeStr = new TextDecoder().decode(data.slice(len.offset, len.offset + len.length));
	let date: Date;
	if (tag === 0x17) {
		const yy = parseInt(timeStr.slice(0, 2), 10);
		const year = yy < 50 ? 2000 + yy : 1900 + yy;
		date = new Date(`${year}-${timeStr.slice(2, 4)}-${timeStr.slice(4, 6)}T${timeStr.slice(6, 8)}:${timeStr.slice(8, 10)}:${timeStr.slice(10, 12)}Z`);
	} else {
		date = new Date(`${timeStr.slice(0, 4)}-${timeStr.slice(4, 6)}-${timeStr.slice(6, 8)}T${timeStr.slice(8, 10)}:${timeStr.slice(10, 12)}:${timeStr.slice(12, 14)}Z`);
	}
	return { date, nextOffset: len.offset + len.length };
}

/** Extract validity period from an X.509 DER certificate */
function extractValidity(certDER: Uint8Array): { notBefore: Date; notAfter: Date } {
	if (certDER[0] !== 0x30) throw new Error('Not a SEQUENCE');
	const outerLen = parseDERLength(certDER, 1);
	if (!outerLen) throw new Error('Invalid outer length');
	let pos = outerLen.offset;
	if (certDER[pos] !== 0x30) throw new Error('Invalid TBS');
	const tbsLen = parseDERLength(certDER, pos + 1);
	if (!tbsLen) throw new Error('Invalid TBS length');
	pos = tbsLen.offset;
	// Skip version [0] EXPLICIT
	if (certDER[pos] === 0xa0) {
		const vLen = parseDERLength(certDER, pos + 1);
		if (!vLen) throw new Error('Invalid version');
		pos = vLen.offset + vLen.length;
	}
	// Skip serial (INTEGER)
	if (certDER[pos] !== 0x02) throw new Error('Expected serial');
	const serialLen = parseDERLength(certDER, pos + 1);
	if (!serialLen) throw new Error('Invalid serial');
	pos = serialLen.offset + serialLen.length;
	// Skip sigAlg (SEQUENCE)
	if (certDER[pos] !== 0x30) throw new Error('Expected sigAlg');
	const sigAlgLen = parseDERLength(certDER, pos + 1);
	if (!sigAlgLen) throw new Error('Invalid sigAlg');
	pos = sigAlgLen.offset + sigAlgLen.length;
	// Skip issuer (SEQUENCE)
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

/** Extract subject CN from an X.509 DER certificate (best-effort) */
function extractSubjectCN(certDER: Uint8Array): string | null {
	// OID 2.5.4.3 = id-at-commonName = 55 04 03
	const cnOid = new Uint8Array([0x55, 0x04, 0x03]);
	// We need the LAST occurrence (subject comes after issuer, both have CN)
	let lastCnPos = -1;
	let searchFrom = 0;
	while (true) {
		const found = findBytes(certDER, cnOid, searchFrom);
		if (found === -1) break;
		lastCnPos = found;
		searchFrom = found + 1;
	}
	if (lastCnPos === -1) return null;
	// After OID, expect a UTF8String (0x0c), PrintableString (0x13), or IA5String (0x16)
	const valueStart = lastCnPos + cnOid.length;
	const tag = certDER[valueStart];
	if (tag !== 0x0c && tag !== 0x13 && tag !== 0x16) return null;
	const len = parseDERLength(certDER, valueStart + 1);
	if (!len) return null;
	return new TextDecoder().decode(certDER.slice(len.offset, len.offset + len.length));
}

/** Extract state abbreviation from subject (look for ST= or state pattern in CN) */
function extractStateFromSubject(certDER: Uint8Array): string | null {
	// OID 2.5.4.8 = id-at-stateOrProvinceName = 55 04 08
	const stOid = new Uint8Array([0x55, 0x04, 0x08]);
	// Find all ST fields — subject is the last one (issuer comes first for non-self-signed,
	// but for self-signed roots issuer=subject so any occurrence works)
	let lastStPos = -1;
	let searchFrom = 0;
	while (true) {
		const found = findBytes(certDER, stOid, searchFrom);
		if (found === -1) break;
		lastStPos = found;
		searchFrom = found + 1;
	}
	if (lastStPos !== -1) {
		const valueStart = lastStPos + stOid.length;
		const tag = certDER[valueStart];
		if (tag === 0x0c || tag === 0x13 || tag === 0x16) {
			const len = parseDERLength(certDER, valueStart + 1);
			if (len) {
				const stValue = new TextDecoder().decode(certDER.slice(len.offset, len.offset + len.length));
				// ST value is often "US-XX" format
				const match = stValue.match(/US-(\w{2})/);
				if (match) return match[1];
				// Or might be state name or abbreviation
				if (stValue.length === 2) return stValue;
				return stValue;
			}
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// VICAL CBOR parsing
// ---------------------------------------------------------------------------

/**
 * Parse the VICAL COSE_Sign1 structure and extract IACA certificates.
 */
async function parseVICAL(vicalBytes: Uint8Array): Promise<void> {
	console.log(`\nVICAL size: ${vicalBytes.length} bytes`);

	// Decode the outer COSE_Sign1 array
	const coseSign1 = decode(vicalBytes);

	if (!Array.isArray(coseSign1) || coseSign1.length !== 4) {
		throw new Error(`Expected COSE_Sign1 (4-element array), got ${typeof coseSign1}`);
	}

	const [protectedHeadersRaw, unprotectedHeaders, payloadRaw, _signature] = coseSign1;

	// Decode protected headers
	const protectedHeaders = decode(
		protectedHeadersRaw instanceof Uint8Array
			? protectedHeadersRaw
			: new Uint8Array(protectedHeadersRaw)
	);
	console.log('Protected headers:', protectedHeaders);

	// Check x5chain in unprotected headers (VICAL signing certificate chain)
	if (unprotectedHeaders instanceof Map) {
		const x5chain = unprotectedHeaders.get(33);
		if (Array.isArray(x5chain)) {
			console.log(`VICAL signer x5chain: ${x5chain.length} certificate(s)`);
		}
	}

	// Decode payload — this is the actual VICAL data
	let payloadBytes: Uint8Array;
	if (payloadRaw instanceof Uint8Array) {
		payloadBytes = payloadRaw;
	} else if (payloadRaw instanceof ArrayBuffer) {
		payloadBytes = new Uint8Array(payloadRaw);
	} else {
		throw new Error(`Unexpected payload type: ${typeof payloadRaw}`);
	}

	const vicalData = decode(payloadBytes);
	console.log('\n--- VICAL Metadata ---');

	// The VICAL payload can be a Map or object
	let version: unknown, provider: unknown, date: unknown, issueID: unknown, certInfos: unknown[];

	if (vicalData instanceof Map) {
		version = vicalData.get('version');
		provider = vicalData.get('vicalProvider');
		date = vicalData.get('date');
		issueID = vicalData.get('vicalIssueID');
		certInfos = vicalData.get('certificateInfos') as unknown[];
	} else {
		const d = vicalData as Record<string, unknown>;
		version = d.version;
		provider = d.vicalProvider;
		date = d.date;
		issueID = d.vicalIssueID;
		certInfos = d.certificateInfos as unknown[];
	}

	console.log('Version:', version);
	console.log('Provider:', provider);
	console.log('Date:', date);
	console.log('Issue ID:', issueID);
	console.log('Certificate entries:', certInfos?.length ?? 0);

	if (!certInfos || !Array.isArray(certInfos)) {
		throw new Error('No certificateInfos found in VICAL payload');
	}

	// ---------------------------------------------------------------------------
	// Extract certificates
	// ---------------------------------------------------------------------------

	interface ExtractedCert {
		state: string;
		issuer: string;
		certB64: string;
		expiresAt: string;
		curve: string;
		certSize: number;
	}

	const extracted: ExtractedCert[] = [];
	const skipped: { reason: string; info: string }[] = [];

	for (const entry of certInfos) {
		let certificate: Uint8Array | undefined;
		let docType: unknown;
		let vicalState: string | undefined;
		let vicalIssuer: string | undefined;
		let vicalNotAfter: Date | undefined;

		if (entry instanceof Map) {
			certificate = entry.get('certificate') as Uint8Array;
			docType = entry.get('docType');
			vicalState = entry.get('stateOrProvinceName') as string;
			vicalIssuer = entry.get('issuingAuthority') as string;
			const na = entry.get('notAfter');
			if (na instanceof Date) vicalNotAfter = na;
			else if (typeof na === 'string') vicalNotAfter = new Date(na);
		} else if (typeof entry === 'object' && entry !== null) {
			const e = entry as Record<string, unknown>;
			certificate = e.certificate as Uint8Array;
			docType = e.docType;
			vicalState = e.stateOrProvinceName as string;
			vicalIssuer = e.issuingAuthority as string;
			const na = e.notAfter;
			if (na instanceof Date) vicalNotAfter = na;
			else if (typeof na === 'string') vicalNotAfter = new Date(na);
		}

		if (!certificate || !(certificate instanceof Uint8Array)) {
			skipped.push({ reason: 'no certificate bytes', info: String(docType) });
			continue;
		}

		// Only process mDL certificates
		// docType can be a string or an array of strings in VICAL CBOR
		const docTypeStr = Array.isArray(docType) ? docType[0] : docType;
		if (docTypeStr && typeof docTypeStr === 'string' && !docTypeStr.includes('18013')) {
			skipped.push({ reason: `non-mDL docType: ${docTypeStr}`, info: '' });
			continue;
		}

		// Detect curve
		const curve = detectEcCurve(certificate);
		if (!curve) {
			skipped.push({ reason: 'no EC key detected', info: extractSubjectCN(certificate) ?? 'unknown' });
			continue;
		}

		// Extract metadata — prefer VICAL metadata, fall back to DER parsing
		let state = vicalState ?? extractStateFromSubject(certificate) ?? 'UNKNOWN';
		// Clean up state abbreviation from "US-XX" format
		if (state.startsWith('US-')) state = state.slice(3);

		// Extract CN from issuing authority or DER subject
		let issuerName: string;
		if (vicalIssuer) {
			// Extract CN from DN string like "cn=Fast Enterprises Root,o=Maryland MVA,..."
			const cnMatch = vicalIssuer.match(/cn=([^,]+)/i);
			issuerName = cnMatch ? cnMatch[1] : vicalIssuer;
		} else {
			issuerName = extractSubjectCN(certificate) ?? 'Unknown IACA Root';
		}

		let expiresAt: string;
		if (vicalNotAfter) {
			expiresAt = vicalNotAfter.toISOString();
		} else {
			try {
				const validity = extractValidity(certificate);
				expiresAt = validity.notAfter.toISOString();
			} catch (err) {
				skipped.push({ reason: `validity parse error: ${err}`, info: issuerName });
				continue;
			}
		}

		// Base64 encode the DER certificate
		const certB64 = uint8ArrayToBase64(certificate);

		extracted.push({
			state,
			issuer: issuerName,
			certB64,
			expiresAt,
			curve,
			certSize: certificate.length,
		});
	}

	// ---------------------------------------------------------------------------
	// Report
	// ---------------------------------------------------------------------------

	console.log('\n--- Extraction Results ---');
	console.log(`Extracted: ${extracted.length} certificates`);
	console.log(`Skipped: ${skipped.length} entries`);

	if (skipped.length > 0) {
		console.log('\nSkipped entries:');
		for (const s of skipped) {
			console.log(`  - ${s.reason} ${s.info ? `(${s.info})` : ''}`);
		}
	}

	// Separate P-256 (supported) from others
	const p256Certs = extracted.filter(c => c.curve === 'P-256');
	const otherCerts = extracted.filter(c => c.curve !== 'P-256');

	console.log(`\nP-256 certificates: ${p256Certs.length}`);
	if (otherCerts.length > 0) {
		console.log(`Non-P-256 certificates (skipping):`);
		for (const c of otherCerts) {
			console.log(`  - ${c.state} (${c.issuer}): ${c.curve}`);
		}
	}

	// Print list of states
	console.log('\nStates with P-256 IACA roots:');
	for (const c of p256Certs.sort((a, b) => a.state.localeCompare(b.state))) {
		console.log(`  ${c.state}: ${c.issuer} (expires ${c.expiresAt.slice(0, 10)}, ${c.certSize} bytes DER)`);
	}

	// ---------------------------------------------------------------------------
	// Generate IACA_ROOTS code
	// ---------------------------------------------------------------------------

	console.log('\n\n// =========================================================================');
	console.log('// GENERATED IACA_ROOTS entries — paste into iaca-roots.ts');
	console.log('// Source: AAMVA VICAL (https://vical.dts.aamva.org/currentVical)');
	console.log(`// Generated: ${new Date().toISOString()}`);
	console.log('// =========================================================================\n');

	for (const cert of p256Certs.sort((a, b) => a.state.localeCompare(b.state))) {
		// Split base64 into ~76-char chunks for readability, joined with string concatenation
		const chunks = splitBase64(cert.certB64, 64);

		console.log(`\t/**`);
		console.log(`\t * ${cert.state} — ${cert.issuer}`);
		console.log(`\t * Source: AAMVA VICAL`);
		console.log(`\t * Key: ECDSA P-256`);
		console.log(`\t * Expires: ${cert.expiresAt.slice(0, 10)}`);
		console.log(`\t */`);
		console.log(`\t${cert.state}: {`);
		console.log(`\t\tstate: '${cert.state}',`);
		console.log(`\t\tissuer: '${cert.issuer.replace(/'/g, "\\'")}',`);
		console.log(`\t\tcertificateB64:`);
		for (let i = 0; i < chunks.length; i++) {
			const prefix = i === 0 ? '\t\t\t' : '\t\t\t';
			const suffix = i === chunks.length - 1 ? ',' : ' +';
			console.log(`${prefix}'${chunks[i]}'${suffix}`);
		}
		console.log(`\t\texpiresAt: '${cert.expiresAt}'`);
		console.log(`\t},\n`);
	}
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function splitBase64(b64: string, chunkSize: number): string[] {
	const chunks: string[] = [];
	for (let i = 0; i < b64.length; i += chunkSize) {
		chunks.push(b64.slice(i, i + chunkSize));
	}
	return chunks;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const args = process.argv.slice(2);
	let vicalBytes: Uint8Array;

	const fileIdx = args.indexOf('--file');
	if (fileIdx !== -1 && args[fileIdx + 1]) {
		const fs = await import('fs');
		vicalBytes = new Uint8Array(fs.readFileSync(args[fileIdx + 1]));
	} else {
		// Default: use the latest VICAL from AAMVA
		// First fetch the current VICAL page to get the latest version URL
		const urlIdx = args.indexOf('--url');
		let url: string;
		if (urlIdx !== -1 && args[urlIdx + 1]) {
			url = args[urlIdx + 1];
		} else {
			// Fetch the current VICAL listing page
			console.log('Fetching VICAL listing from AAMVA...');
			const listPage = await fetch('https://vical.dts.aamva.org/currentVical');
			const html = await listPage.text();
			const match = html.match(/href="\/vical\/vc\/(vc-[^"]+)"/);
			if (!match) {
				throw new Error('Could not find VICAL download link on AAMVA page');
			}
			url = `https://vical.dts.aamva.org/vical/vc/${match[1]}`;
			console.log(`Latest VICAL: ${match[1]}`);
		}

		console.log(`Downloading VICAL from ${url}...`);
		const response = await fetch(url);
		if (!response.ok) throw new Error(`VICAL download failed: ${response.status}`);
		vicalBytes = new Uint8Array(await response.arrayBuffer());
	}

	await parseVICAL(vicalBytes);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
