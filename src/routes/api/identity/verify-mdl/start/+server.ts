import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { devSessionStore } from '../_dev-session-store';

/**
 * mDL Verification Start Endpoint
 *
 * Generates an ephemeral ECDH key pair and builds dual-protocol
 * request configurations for the Digital Credentials API.
 *
 * The private key is stored in Workers KV with 5-min TTL.
 * The public key + request configs are returned to the client.
 */
export const POST: RequestHandler = async ({ locals, platform }) => {
	// Authentication check
	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	try {
		// Generate ephemeral ECDH key pair for session encryption
		const keyPair = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true, // extractable (need to store private key in KV)
			['deriveKey', 'deriveBits']
		);

		// Generate unique nonce for this verification session
		const nonceBytes = new Uint8Array(32);
		crypto.getRandomValues(nonceBytes);
		const nonce = Array.from(nonceBytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		// Export private key for KV storage (used by verify endpoint for HPKE decryption)
		const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

		// Store private key in Workers KV with 5-min TTL
		const kvKey = `mdl-session:${nonce}`;
		const sessionData = JSON.stringify({
			privateKeyJwk,
			userId: session.userId,
			createdAt: Date.now()
		});

		const kv = platform?.env?.DC_SESSION_KV;
		if (kv) {
			await kv.put(kvKey, sessionData, { expirationTtl: 300 }); // 5 minutes
		} else {
			// Dev fallback: use in-memory store
			// In production, KV is required
			console.warn('[mDL Start] DC_SESSION_KV not available -- using dev fallback');
			devSessionStore.set(kvKey, { data: sessionData, expires: Date.now() + 300_000 });
		}

		// Build dual-protocol request configurations

		// org-iso-mdoc: CBOR-encoded DeviceRequest per ISO 18013-5 §8.3.2.1.2
		const cborModule = await import('cbor-web');
		const cbor = cborModule.default ?? cborModule;
		const { encode, Tagged } = cbor;

		// ItemsRequest: what we're asking the wallet to disclose
		const itemsRequest = new Map<string, unknown>([
			['docType', 'org.iso.18013.5.1.mDL'],
			[
				'nameSpaces',
				new Map([
					[
						'org.iso.18013.5.1',
						new Map<string, boolean>([
							['resident_postal_code', false], // false = intentToRetain: false
							['resident_city', false],
							['resident_state', false]
						])
					]
				])
			]
		]);

		// Wrap ItemsRequest in CBOR tag 24 (bstr-wrapped CBOR) per ISO 18013-5
		const itemsRequestBytes = encode(itemsRequest);
		const taggedItemsRequest = new Tagged(24, new Uint8Array(itemsRequestBytes));

		// DocRequest (readerAuth omitted -- optional per spec, requires registered reader cert)
		const docRequest = new Map<string, unknown>([['itemsRequest', taggedItemsRequest]]);

		// DeviceRequest envelope
		const deviceRequest = new Map<string, unknown>([
			['version', '1.0'],
			['docRequests', [docRequest]]
		]);

		// CBOR-encode, then base64 for JSON transport (client decodes before passing to wallet)
		const deviceRequestBytes = encode(deviceRequest);
		const deviceRequestB64 = btoa(
			String.fromCharCode(...new Uint8Array(deviceRequestBytes))
		);

		const mdocRequest = {
			protocol: 'org-iso-mdoc',
			data: deviceRequestB64
		};

		// openid4vp: DCQL query (Chrome alternative)
		const oid4vpRequest = {
			protocol: 'openid4vp',
			data: {
				// DCQL (Digital Credentials Query Language) format
				client_id: process.env.PUBLIC_APP_URL ?? 'https://communique.cc',
				nonce,
				dcql_query: {
					credentials: [
						{
							format: 'mso_mdoc',
							doctype: 'org.iso.18013.5.1.mDL',
							claims: {
								'org.iso.18013.5.1': [
									{ name: 'resident_postal_code', intent_to_retain: false },
									{ name: 'resident_city', intent_to_retain: false },
									{ name: 'resident_state', intent_to_retain: false }
								]
							}
						}
					]
				}
			}
		};

		return json({
			requests: [mdocRequest, oid4vpRequest],
			nonce,
			expiresAt: Date.now() + 300_000 // 5 min TTL matches KV
		});
	} catch (err) {
		console.error('[mDL Start] Error:', err);
		throw error(500, 'Failed to initialize mDL verification');
	}
};

