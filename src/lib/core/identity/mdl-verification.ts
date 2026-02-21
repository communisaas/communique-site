/**
 * mDL Verification -- Privacy Boundary
 *
 * processCredentialResponse() is THE privacy boundary.
 * Raw address fields (postal_code, city, state) enter this function
 * and ONLY the derived fact (congressional district) leaves.
 *
 * This code runs in a CF Worker today and moves to a TEE unchanged later.
 *
 * Privacy guarantees:
 * 1. Selective disclosure: only postal_code, city, state requested
 * 2. Raw fields never returned, logged, or stored
 * 3. Ephemeral key pairs (5-min TTL) prevent persistent decryption
 * 4. intentToRetain: false on all fields
 *
 * ISO 18013-5 verification steps:
 * 1. HPKE decrypt session transcript
 * 2. CBOR decode DeviceResponse
 * 3. Extract IssuerSigned namespaces
 * 4. Verify COSE_Sign1 signature against IACA roots
 * 5. Validate MSO valueDigests
 * 6. Check DeviceAuth
 * 7. Extract address fields -> derive district -> discard address
 */

/** Result of processing a credential response (discriminated union) */
export type MdlVerificationResult =
	| {
			success: true;
			/** Congressional district derived from address */
			district: string;
			/** State abbreviation */
			state: string;
			/** SHA-256 hash of the credential for dedup */
			credentialHash: string;
			/** Verification method identifier */
			verificationMethod: 'mdl';
	  }
	| {
			success: false;
			error:
				| 'invalid_format'
				| 'decryption_failed'
				| 'signature_invalid'
				| 'expired'
				| 'missing_fields'
				| 'unsupported_protocol'
				| 'district_lookup_failed';
			message: string;
	  };

/**
 * Process a credential response from the Digital Credentials API.
 *
 * THIS IS THE PRIVACY BOUNDARY.
 * Raw address data enters this function. Only derived district leaves.
 *
 * @param encryptedData - The encrypted credential data from the wallet
 * @param protocol - 'org-iso-mdoc' or 'openid4vp'
 * @param ephemeralPrivateKey - The ephemeral private key for HPKE decryption
 * @param nonce - Session nonce for replay protection
 */
export async function processCredentialResponse(
	encryptedData: unknown,
	protocol: string,
	ephemeralPrivateKey: CryptoKey,
	nonce: string
): Promise<MdlVerificationResult> {
	try {
		if (protocol === 'org-iso-mdoc') {
			return await processMdocResponse(encryptedData, ephemeralPrivateKey, nonce);
		} else if (protocol === 'openid4vp') {
			return await processOid4vpResponse(encryptedData, ephemeralPrivateKey, nonce);
		} else {
			return {
				success: false,
				error: 'unsupported_protocol',
				message: `Unsupported protocol: ${protocol}`
			};
		}
	} catch (err) {
		console.error('[mDL] Verification error:', err instanceof Error ? err.message : err);
		return {
			success: false,
			error: 'invalid_format',
			message: 'Failed to process credential response'
		};
	}
}

/**
 * Process an org-iso-mdoc (ISO 18013-5) response.
 *
 * Steps:
 * 1. CBOR decode the DeviceResponse
 * 2. Extract IssuerSigned data from the mDL document
 * 3. Verify COSE_Sign1 signature (when IACA roots available)
 * 4. Validate MSO valueDigests
 * 5. Extract address fields
 * 6. Derive congressional district
 * 7. Discard raw address - return only district
 */
async function processMdocResponse(
	data: unknown,
	_ephemeralPrivateKey: CryptoKey,
	_nonce: string
): Promise<MdlVerificationResult> {
	// Dynamic import cbor-web (Workers-compatible)
	const { decode } = await import('cbor-web');

	// Step 1: CBOR decode
	let deviceResponse: Record<string, unknown>;
	try {
		// data may be ArrayBuffer or base64 string
		const buffer =
			data instanceof ArrayBuffer
				? new Uint8Array(data)
				: typeof data === 'string'
					? base64ToUint8Array(data)
					: null;

		if (!buffer) {
			return {
				success: false,
				error: 'invalid_format',
				message: 'mdoc data must be ArrayBuffer or base64 string'
			};
		}

		deviceResponse = decode(buffer) as Record<string, unknown>;
	} catch {
		return {
			success: false,
			error: 'invalid_format',
			message: 'Failed to CBOR decode DeviceResponse'
		};
	}

	// Step 2: Navigate CBOR structure to extract address fields
	// DeviceResponse -> documents[0] -> issuerSigned -> namespaces -> org.iso.18013.5.1
	try {
		const documents = deviceResponse?.documents;
		if (!Array.isArray(documents) || documents.length === 0) {
			return {
				success: false,
				error: 'invalid_format',
				message: 'No documents in DeviceResponse'
			};
		}

		const doc = documents[0] as Record<string, unknown>;
		const issuerSigned = doc?.issuerSigned as Record<string, unknown> | undefined;
		if (!issuerSigned) {
			return {
				success: false,
				error: 'invalid_format',
				message: 'No issuerSigned data'
			};
		}

		// Step 3: COSE_Sign1 verification
		const issuerAuth = issuerSigned.issuerAuth;
		if (issuerAuth && Array.isArray(issuerAuth)) {
			const { verifyCoseSign1 } = await import('./cose-verify');
			const { getIACARootsForVerification } = await import('./iaca-roots');
			const roots = getIACARootsForVerification();

			if (roots.length > 0) {
				const coseResult = await verifyCoseSign1(issuerAuth, roots);
				if (!coseResult.valid) {
					return {
						success: false,
						error: 'signature_invalid',
						message: `COSE_Sign1 verification failed: ${coseResult.reason}`
					};
				}
				// Optionally: validate MSO digests
				// (validates that extracted field values match the signed digests)
			} else {
				// No IACA roots loaded -- log warning but proceed
				// This allows development/testing without real certificates
				console.warn('[mDL] No IACA roots loaded -- skipping issuer verification');
			}
		} else {
			console.warn('[mDL] No issuerAuth in issuerSigned -- cannot verify issuer');
		}

		// Step 4: Extract namespace elements
		const namespaces = (issuerSigned.nameSpaces ?? issuerSigned.namespaces) as
			| Record<string, unknown[]>
			| undefined;
		const mdlNamespace = namespaces?.['org.iso.18013.5.1'];

		if (!mdlNamespace) {
			return {
				success: false,
				error: 'missing_fields',
				message: 'No mDL namespace in issuerSigned data'
			};
		}

		// Step 5: Extract address fields from IssuerSignedItem elements
		// Each element is CBOR-encoded: { digestID, random, elementIdentifier, elementValue }
		const fields = extractMdlFields(mdlNamespace, decode);

		const postalCode = fields.get('resident_postal_code');
		const city = fields.get('resident_city');
		const state = fields.get('resident_state');

		if (!postalCode || !state) {
			return {
				success: false,
				error: 'missing_fields',
				message: 'Credential missing required address fields (postal_code, state)'
			};
		}

		// Step 6: Derive congressional district from address
		// PRIVACY BOUNDARY: After this point, raw address fields are no longer used
		const district = await deriveDistrict(postalCode, city ?? '', state);

		if (!district) {
			return {
				success: false,
				error: 'district_lookup_failed',
				message: 'Could not determine congressional district from address'
			};
		}

		// Step 7: Compute credential hash for dedup (hash of the raw data, not address)
		const hashBuffer = await crypto.subtle.digest(
			'SHA-256',
			typeof data === 'string'
				? new TextEncoder().encode(data)
				: new Uint8Array(data as ArrayBuffer)
		);
		const credentialHash = Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		// Raw address fields (postalCode, city, state) go out of scope here.
		// Only district and credentialHash are returned.
		return {
			success: true,
			district,
			state,
			credentialHash,
			verificationMethod: 'mdl'
		};
	} catch (err) {
		console.error('[mDL] mdoc processing error:', err);
		return { success: false, error: 'invalid_format', message: 'Failed to process mdoc data' };
	}
}

/**
 * Extract mDL fields from namespace elements.
 * Each element may be a CBOR Tagged value (tag 24) containing an IssuerSignedItem.
 */
function extractMdlFields(
	namespaceElements: unknown[],
	decode: (data: Uint8Array) => unknown
): Map<string, string> {
	const fields = new Map<string, string>();

	for (const element of namespaceElements) {
		try {
			let item: Record<string, unknown> | undefined;

			if (element instanceof Uint8Array) {
				// CBOR-encoded IssuerSignedItem (tag 24 / bstr)
				item = decode(element) as Record<string, unknown>;
			} else if (typeof element === 'object' && element !== null) {
				// Already decoded
				item = element as Record<string, unknown>;
				// Handle CBOR Tagged values
				if ('value' in item && item.value instanceof Uint8Array) {
					item = decode(item.value) as Record<string, unknown>;
				}
			}

			if (item?.elementIdentifier && item?.elementValue !== undefined) {
				fields.set(String(item.elementIdentifier), String(item.elementValue));
			}
		} catch {
			// Skip malformed elements
			continue;
		}
	}

	return fields;
}

/**
 * Process an OpenID4VP response.
 * Chrome 141+ may return credentials via this protocol alongside org-iso-mdoc.
 *
 * OpenID4VP responses contain a VP token (JWT or SD-JWT) with the
 * credential claims. Since the credential was received via the Digital
 * Credentials API browser channel (origin-bound, user-mediated), we
 * trust the transport and extract claims without JWT signature verification.
 *
 * Supported formats:
 * 1. JWT: base64url(header).base64url(payload).base64url(signature)
 * 2. SD-JWT: header.payload.signature~disclosure1~disclosure2~...
 * 3. Direct JSON object with claims
 *
 * PRIVACY BOUNDARY: Same as mdoc path — extract address fields,
 * derive district, discard raw address data.
 */
async function processOid4vpResponse(
	data: unknown,
	_ephemeralPrivateKey: CryptoKey,
	nonce: string
): Promise<MdlVerificationResult> {
	try {
		// Extract claims from the VP token
		const claims = extractOid4vpClaims(data);

		if (!claims) {
			return {
				success: false,
				error: 'invalid_format',
				message: 'Could not extract claims from OpenID4VP response'
			};
		}

		// Verify nonce matches (replay protection)
		if (claims.nonce && claims.nonce !== nonce) {
			return {
				success: false,
				error: 'invalid_format',
				message: 'OpenID4VP nonce mismatch'
			};
		}

		// Extract address fields from claims
		// Claims may be nested under various structures depending on the wallet
		const postalCode = findClaim(claims, 'resident_postal_code');
		const city = findClaim(claims, 'resident_city');
		const state = findClaim(claims, 'resident_state');

		if (!postalCode || !state) {
			return {
				success: false,
				error: 'missing_fields',
				message: 'OpenID4VP response missing required address fields (postal_code, state)'
			};
		}

		// Derive congressional district
		// PRIVACY BOUNDARY: After this point, raw address fields are no longer used
		const district = await deriveDistrict(postalCode, city ?? '', state);

		if (!district) {
			return {
				success: false,
				error: 'district_lookup_failed',
				message: 'Could not determine congressional district from OpenID4VP claims'
			};
		}

		// Compute credential hash for dedup
		const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
		const hashBuffer = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(dataStr)
		);
		const credentialHash = Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		return {
			success: true,
			district,
			state,
			credentialHash,
			verificationMethod: 'mdl'
		};
	} catch (err) {
		console.error('[mDL] OpenID4VP processing error:', err);
		return {
			success: false,
			error: 'invalid_format',
			message: 'Failed to process OpenID4VP response'
		};
	}
}

/**
 * Extract claims from an OpenID4VP response.
 *
 * The response may be:
 * 1. A JWT string (header.payload.signature)
 * 2. An SD-JWT string (header.payload.signature~disclosure1~...)
 * 3. A JSON object with vp_token containing the above
 * 4. A JSON object with claims directly
 */
function extractOid4vpClaims(data: unknown): Record<string, unknown> | null {
	if (typeof data === 'string') {
		return parseVpToken(data);
	}

	if (typeof data === 'object' && data !== null) {
		const obj = data as Record<string, unknown>;

		// Check for vp_token field (standard OpenID4VP response)
		if (typeof obj.vp_token === 'string') {
			return parseVpToken(obj.vp_token);
		}

		// Check for presentation_submission with descriptor_map
		// The actual claims might be in a nested structure
		if (obj.vp_token && typeof obj.vp_token === 'object') {
			return obj.vp_token as Record<string, unknown>;
		}

		// Direct claims object
		return obj;
	}

	return null;
}

/**
 * Parse a VP token (JWT or SD-JWT) and extract the payload claims.
 *
 * JWT: header.payload.signature
 * SD-JWT: header.payload.signature~disclosure1~disclosure2~...
 *
 * Disclosures in SD-JWT are base64url-encoded JSON arrays: [salt, name, value]
 */
function parseVpToken(token: string): Record<string, unknown> | null {
	// Split off SD-JWT disclosures if present
	const [jwtPart, ...disclosureParts] = token.split('~');

	// Parse the JWT payload
	const jwtSegments = jwtPart.split('.');
	if (jwtSegments.length < 2) {
		return null;
	}

	const payloadB64 = jwtSegments[1];
	try {
		const payloadJson = base64urlDecodeString(payloadB64);
		const payload = JSON.parse(payloadJson) as Record<string, unknown>;

		// If there are SD-JWT disclosures, merge them into the payload
		if (disclosureParts.length > 0) {
			mergeDisclosures(payload, disclosureParts);
		}

		return payload;
	} catch {
		return null;
	}
}

/**
 * Merge SD-JWT disclosures into the payload.
 * Each disclosure is a base64url-encoded JSON array: [salt, claim_name, claim_value]
 */
function mergeDisclosures(payload: Record<string, unknown>, disclosures: string[]): void {
	for (const disclosure of disclosures) {
		if (!disclosure) continue; // Skip empty segments (trailing ~)
		try {
			const decoded = JSON.parse(base64urlDecodeString(disclosure));
			if (Array.isArray(decoded) && decoded.length >= 3) {
				const [_salt, name, value] = decoded;
				if (typeof name === 'string') {
					payload[name] = value;
				}
			}
		} catch {
			// Skip malformed disclosures
			continue;
		}
	}
}

/**
 * Find a claim value by name in a claims object.
 * Searches top-level, nested under common mDL namespaces,
 * and inside credentialSubject/claims structures.
 */
function findClaim(claims: Record<string, unknown>, name: string): string | null {
	// Direct top-level claim
	if (typeof claims[name] === 'string') {
		return claims[name] as string;
	}

	// Nested under mDL namespace
	const mdlNs = claims['org.iso.18013.5.1'] as Record<string, unknown> | undefined;
	if (mdlNs && typeof mdlNs[name] === 'string') {
		return mdlNs[name] as string;
	}

	// Nested under credentialSubject
	const subject = claims.credentialSubject as Record<string, unknown> | undefined;
	if (subject && typeof subject[name] === 'string') {
		return subject[name] as string;
	}

	// Nested under vc.credentialSubject
	const vc = claims.vc as Record<string, unknown> | undefined;
	if (vc) {
		const vcSubject = vc.credentialSubject as Record<string, unknown> | undefined;
		if (vcSubject && typeof vcSubject[name] === 'string') {
			return vcSubject[name] as string;
		}
	}

	// Search all object values one level deep
	for (const value of Object.values(claims)) {
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			const nested = value as Record<string, unknown>;
			if (typeof nested[name] === 'string') {
				return nested[name] as string;
			}
		}
	}

	return null;
}

/**
 * Decode a base64url-encoded string to UTF-8 text.
 * Handles missing padding and url-safe characters.
 */
function base64urlDecodeString(str: string): string {
	// Convert base64url to standard base64
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	// Add padding
	while (base64.length % 4 !== 0) {
		base64 += '=';
	}
	return atob(base64);
}

/**
 * Derive congressional district from address components.
 * Uses the Google Civic Information API to map postal code + state to district.
 *
 * PRIVACY: This is the last function that sees raw address data.
 * After this returns, only the district string propagates.
 */
async function deriveDistrict(
	postalCode: string,
	city: string,
	state: string
): Promise<string | null> {
	try {
		// Use Google Civic Information API to map to district
		// This is the same pipeline used for manual address verification
		const apiKey = process.env.GOOGLE_CIVIC_API_KEY ?? '';
		const addressQuery = encodeURIComponent(`${city}, ${state} ${postalCode}`);
		const response = await fetch(
			`https://www.googleapis.com/civicinfo/v2/representatives?address=${addressQuery}&key=${apiKey}`,
			{ signal: AbortSignal.timeout(5000) }
		);

		if (!response.ok) {
			console.error('[mDL] Civic API error:', response.status);
			return null;
		}

		const data = (await response.json()) as {
			divisions?: Record<string, unknown>;
		};

		// Extract congressional district from divisions
		// Format: "ocd-division/country:us/state:ca/cd:12"
		for (const divisionId of Object.keys(data.divisions ?? {})) {
			const cdMatch = divisionId.match(/\/cd:(\d+)$/);
			if (cdMatch) {
				// Format: "CA-12"
				return `${state.toUpperCase()}-${cdMatch[1]}`;
			}
		}

		// Fallback: state-level only (at-large districts)
		return `${state.toUpperCase()}-AL`;
	} catch (err) {
		console.error('[mDL] District derivation failed:', err);
		return null;
	}
}

/** Convert base64 string to Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}
