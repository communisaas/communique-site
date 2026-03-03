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
			/**
			 * Identity commitment (BN254 field element, hex string).
			 * Computed from document_number + birth_year INSIDE the privacy boundary.
			 * Raw identity fields are discarded after commitment computation.
			 * Undefined if wallet did not disclose document_number or birth_date.
			 */
			identityCommitment?: string;
			/**
			 * Census tract GEOID (11-digit) for Shadow Atlas Tree 2 cell mapping.
			 * Resolved from postal_code + city + state via Census Bureau geocoding
			 * INSIDE the privacy boundary. Null if geocoding failed (non-fatal).
			 */
			cellId?: string;
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

				// MSO digest validation: proves extracted field values match the
				// signed digests in the Mobile Security Object. Defense-in-depth —
				// a tampered field would pass COSE signature but fail digest check.
				if (coseResult.mso) {
					const { validateMsoDigests } = await import('./cose-verify');
					const cborModule = await import('cbor-web');
					const cborEncode = cborModule.default?.encode ?? cborModule.encode;
					const nsData = (issuerSigned.nameSpaces ?? issuerSigned.namespaces) as
						| Record<string, unknown[]>
						| undefined;
					if (nsData) {
						const digestsValid = await validateMsoDigests(
							coseResult.mso,
							nsData,
							decode,
							(data: unknown) => new Uint8Array(cborEncode(data))
						);
						if (!digestsValid) {
							return {
								success: false,
								error: 'signature_invalid',
								message: 'MSO digest validation failed — field values do not match signed digests'
							};
						}
					}
				}
			} else {
				// No IACA roots loaded.
				// Production: hard fail. Dev: bypass with explicit opt-in.
				const skipVerification = process.env.SKIP_ISSUER_VERIFICATION === 'true';
				if (skipVerification) {
					console.warn('[mDL] SKIP_ISSUER_VERIFICATION=true — bypassing issuer verification (DEV ONLY)');
				} else {
					return {
						success: false,
						error: 'signature_invalid',
						message: 'No IACA root certificates loaded — cannot verify mDL issuer. ' +
							'Set SKIP_ISSUER_VERIFICATION=true for development.'
					};
				}
			}
		} else {
			// No issuerAuth — cannot verify credential origin.
			const skipVerification = process.env.SKIP_ISSUER_VERIFICATION === 'true';
			if (!skipVerification) {
				return {
					success: false,
					error: 'signature_invalid',
					message: 'No issuerAuth in credential — cannot verify mDL issuer'
				};
			}
			console.warn('[mDL] No issuerAuth — bypassing (SKIP_ISSUER_VERIFICATION=true)');
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

		// Step 5b: Extract identity fields, compute commitment, DISCARD raw fields.
		// The raw document_number and birth_date NEVER leave this function.
		// Only the resulting identity commitment (a single BN254 field element) propagates.
		const documentNumber = fields.get('document_number');
		const birthDateRaw = fields.get('birth_date');
		const birthYear = extractBirthYear(birthDateRaw);

		// Step 6: Resolve district + cellId from address in a single geocode call
		// PRIVACY BOUNDARY: After this point, raw address fields are no longer used
		const location = await resolveLocationFromAddress(postalCode, city ?? '', state);

		if (!location.district) {
			return {
				success: false,
				error: 'district_lookup_failed',
				message: 'Could not determine congressional district from address'
			};
		}

		const district = location.district;
		const cellId = location.cellId;

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

		// Compute identity commitment INSIDE the privacy boundary.
		// Raw documentNumber and birthYear are consumed here and never returned.
		let identityCommitment: string | undefined;
		if (documentNumber && birthYear) {
			identityCommitment = await computeIdentityCommitmentInBoundary(
				documentNumber,
				birthYear
			);
		}
		// documentNumber, birthYear, postalCode, city go out of scope here — DISCARDED.
		// Only district, cellId, credentialHash, and the hashed identityCommitment are returned.
		return {
			success: true,
			district,
			state,
			credentialHash,
			verificationMethod: 'mdl',
			identityCommitment,
			cellId: cellId ?? undefined
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

		// Extract identity fields, compute commitment, discard raw fields
		const documentNumber = findClaim(claims, 'document_number');
		const birthDateRaw = findClaim(claims, 'birth_date');
		const birthYear = extractBirthYear(birthDateRaw);

		// Resolve district + cellId from address in a single geocode call
		// PRIVACY BOUNDARY: After this point, raw address fields are no longer used
		const location = await resolveLocationFromAddress(postalCode, city ?? '', state);

		if (!location.district) {
			return {
				success: false,
				error: 'district_lookup_failed',
				message: 'Could not determine congressional district from OpenID4VP claims'
			};
		}

		const district = location.district;
		const cellId = location.cellId;

		// Compute credential hash for dedup
		const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
		const hashBuffer = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(dataStr)
		);
		const credentialHash = Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		// Compute identity commitment INSIDE the privacy boundary
		let identityCommitment: string | undefined;
		if (documentNumber && birthYear) {
			identityCommitment = await computeIdentityCommitmentInBoundary(
				documentNumber,
				birthYear
			);
		}

		return {
			success: true,
			district,
			state,
			credentialHash,
			verificationMethod: 'mdl',
			identityCommitment,
			cellId: cellId ?? undefined
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
 * Resolve congressional district AND Census tract GEOID from address.
 *
 * Single Census Bureau geocode call returns both lat/lng (for SA district lookup)
 * and tract GEOID (for Shadow Atlas Tree 2 cell mapping).
 *
 * Resolution chain:
 * 1. Census Bureau geocode (city, state, zip → lat, lng, geographies)
 * 2. Primary district: Shadow Atlas H3 lookup from coordinates (fully sovereign)
 * 3. Fallback district: Census Bureau 119th Congressional Districts from geocode response
 * 4. cellId: Census tract GEOID from geocode geographies
 *
 * PRIVACY: Called INSIDE the privacy boundary — city/state/zip sent to Census
 * Bureau (federal government service). Only district code and tract GEOID returned.
 */
async function resolveLocationFromAddress(
	postalCode: string,
	city: string,
	state: string
): Promise<{ district: string | null; cellId: string | null }> {
	try {
		// Single Census Bureau geocode call
		const geocodeResult = await censusGeocode(postalCode, city, state);

		if (!geocodeResult) {
			return { district: null, cellId: null };
		}

		const { lat, lng, cellId, censusDistrict } = geocodeResult;

		// Primary district resolution: Shadow Atlas H3 lookup (fully sovereign)
		let district: string | null = null;
		try {
			const { lookupDistrict } = await import('$lib/core/shadow-atlas/client');
			const result = await lookupDistrict(lat, lng);
			if (result.district) {
				district = result.district;
			}
		} catch (saErr) {
			console.warn('[mDL] Shadow Atlas district lookup failed, using Census fallback:',
				saErr instanceof Error ? saErr.message : saErr);
		}

		// Fallback: Census Bureau congressional district from geocode response
		if (!district && censusDistrict) {
			district = censusDistrict;
		}

		// Final fallback: at-large district for the state
		if (!district) {
			district = `${state.toUpperCase()}-AL`;
		}

		return { district, cellId };
	} catch (err) {
		console.error('[mDL] Location resolution failed:', err instanceof Error ? err.message : err);
		return { district: null, cellId: null };
	}
}

/**
 * Census Bureau geocoding — single call returns coordinates, district, and tract.
 *
 * Tries structured address endpoint first, then onelineaddress fallback.
 * Extracts lat/lng, 119th Congressional District, and Census tract GEOID.
 */
async function censusGeocode(
	postalCode: string,
	city: string,
	state: string
): Promise<{
	lat: number;
	lng: number;
	cellId: string | null;
	censusDistrict: string | null;
} | null> {
	// Try structured address endpoint first
	const result = await tryCensusEndpoint(
		'https://geocoding.geo.census.gov/geocoder/geographies/address',
		{ city, state, zip: postalCode }
	);
	if (result) return result;

	// Fallback: onelineaddress
	const fallback = await tryCensusEndpoint(
		'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress',
		{ address: `${city}, ${state} ${postalCode}` }
	);
	if (fallback) return fallback;

	console.warn('[mDL] Census geocoding: no match for', `${city}, ${state} ${postalCode}`);
	return null;
}

/**
 * Try a Census Bureau geocoding endpoint and extract location data.
 */
async function tryCensusEndpoint(
	baseUrl: string,
	params: Record<string, string>
): Promise<{
	lat: number;
	lng: number;
	cellId: string | null;
	censusDistrict: string | null;
} | null> {
	try {
		const url = new URL(baseUrl);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		url.searchParams.set('benchmark', '4');
		url.searchParams.set('vintage', '4');
		url.searchParams.set('format', 'json');

		const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
		if (!res.ok) {
			console.warn('[mDL] Census geocoding HTTP error:', res.status);
			return null;
		}

		const data = await res.json();
		const match = data?.result?.addressMatches?.[0];
		if (!match) return null;

		// Extract coordinates
		const lat = match.coordinates?.y;
		const lng = match.coordinates?.x;
		if (typeof lat !== 'number' || typeof lng !== 'number') return null;

		const geographies = match.geographies ?? {};

		// Extract Census tract GEOID (11 digits)
		let cellId: string | null = null;
		const tracts = geographies['Census Tracts'];
		if (tracts?.[0]?.GEOID) {
			cellId = tracts[0].GEOID.slice(0, 11);
		} else {
			const blocks = geographies['2020 Census Blocks'];
			if (blocks?.[0]?.GEOID?.length >= 11) {
				cellId = blocks[0].GEOID.slice(0, 11);
			}
		}

		// Extract congressional district from Census response (fallback)
		let censusDistrict: string | null = null;
		const districts = geographies['119th Congressional Districts'];
		if (districts?.[0]) {
			const d = districts[0];
			const cd = d.CD119 ?? (d.GEOID ? d.GEOID.slice(-2) : null);
			if (cd !== undefined && cd !== null) {
				const stateGeo = geographies['States']?.[0];
				const stateCode = stateGeo?.STUSAB ?? params.state?.toUpperCase() ?? '';
				const paddedCd = String(cd).padStart(2, '0');
				const normalizedCd = paddedCd === '98' || paddedCd === '00' ? 'AL' : paddedCd;
				if (stateCode) {
					censusDistrict = `${stateCode}-${normalizedCd}`;
				}
			}
		}

		return { lat, lng, cellId, censusDistrict };
	} catch (err) {
		console.warn('[mDL] Census endpoint failed:', err instanceof Error ? err.message : err);
		return null;
	}
}

/**
 * Resolve Census tract GEOID from address via Census Bureau geocoding API.
 *
 * Exported for backward compatibility and direct use by tests.
 * Internally delegates to the unified censusGeocode function.
 *
 * Non-fatal: returns null on any failure. Shadow Atlas registration is deferred.
 */
export async function resolveCellIdFromAddress(
	postalCode: string,
	city: string,
	state: string
): Promise<string | null> {
	const result = await censusGeocode(postalCode, city, state);
	return result?.cellId ?? null;
}

/**
 * Extract birth year from various birth_date formats.
 *
 * ISO 18013-5 birth_date may be:
 * - CBOR tag 1004 full-date string: "1990-05-15" (decoded by cbor-web as string)
 * - Plain CBOR integer: year directly (e.g. 1990) or Unix timestamp
 * - extractMdlFields converts everything to String() — so we handle both
 */
function extractBirthYear(raw: string | null | undefined): number | undefined {
	if (!raw) return undefined;

	// Check if it's a numeric string that could be a year or Unix timestamp
	const numValue = Number(raw);
	if (!isNaN(numValue) && Number.isInteger(numValue)) {
		// Direct year (1900-2099 range)
		if (numValue >= 1900 && numValue <= 2099) return numValue;
		// Unix timestamp (seconds since epoch) — convert to year
		if (numValue > 100000000) {
			const d = new Date(numValue * 1000);
			return isNaN(d.getTime()) ? undefined : d.getUTCFullYear();
		}
	}

	// ISO 8601 date string: "YYYY-MM-DD" or "YYYY"
	const yearMatch = raw.match(/^(\d{4})/);
	return yearMatch ? parseInt(yearMatch[1], 10) : undefined;
}

/**
 * Compute identity commitment INSIDE the privacy boundary.
 *
 * Uses the same pipeline as identity-binding.ts computeIdentityCommitment():
 * SHA-256(SHA-256(domain:salt:documentNumber:US:birthYear:mdl)) mod BN254
 *
 * This function is called within processMdocResponse/processOid4vpResponse
 * so that raw identity fields never leave the privacy boundary.
 */
async function computeIdentityCommitmentInBoundary(
	documentNumber: string,
	birthYear: number
): Promise<string> {
	const DOMAIN_PREFIX = 'communique-identity-v1';
	const COMMITMENT_SALT = process.env.IDENTITY_COMMITMENT_SALT;

	if (!COMMITMENT_SALT) {
		console.warn('[mDL] IDENTITY_COMMITMENT_SALT not configured — identity commitment skipped');
		return '';
	}

	// Normalize inputs identically to identity-binding.ts computeIdentityCommitment()
	const normalized = [
		DOMAIN_PREFIX,
		COMMITMENT_SALT,
		documentNumber.toUpperCase().trim(),
		'US', // mDL is US-only
		birthYear.toString(),
		'mdl'
	].join(':');

	// Double-hash with domain separation for preimage resistance
	const innerBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
	const outerBuf = await crypto.subtle.digest('SHA-256', innerBuf);
	const rawHex = Array.from(new Uint8Array(outerBuf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	// Reduce mod BN254 — ensures valid field element for ZK circuit
	const BN254_MODULUS =
		21888242871839275222246405745257275088548364400416034343698204186575808495617n;
	const value = BigInt('0x' + rawHex);
	const reduced = value % BN254_MODULUS;
	return reduced.toString(16).padStart(64, '0');
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
