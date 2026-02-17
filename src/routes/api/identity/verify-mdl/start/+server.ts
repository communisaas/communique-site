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

		// Export keys for storage and transmission
		const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
		const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
		const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)));

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
		// org-iso-mdoc: ISO 18013-5 DeviceRequest
		const mdocRequest = {
			protocol: 'org-iso-mdoc',
			data: {
				// Minimal DeviceRequest structure
				// In production: full CBOR-encoded DeviceRequest per ISO 18013-5
				doctype: 'org.iso.18013.5.1.mDL',
				nameSpaces: {
					'org.iso.18013.5.1': {
						resident_postal_code: { intent_to_retain: false },
						resident_city: { intent_to_retain: false },
						resident_state: { intent_to_retain: false }
					}
				},
				readerAuth: {
					publicKey: publicKeyB64,
					nonce
				}
			}
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

