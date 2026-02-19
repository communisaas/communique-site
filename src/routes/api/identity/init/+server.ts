/**
 * self.xyz NFC Verification Initialization Endpoint
 *
 * Generates QR code for NFC passport verification using @selfxyz/qrcode SDK.
 *
 * SDK Documentation: https://docs.self.xyz/use-self/quickstart
 *
 * Flow:
 * 1. Client calls this endpoint with userId and templateSlug
 * 2. Server generates QR code using official SDK
 * 3. Returns QR code data for display
 * 4. User scans QR with Self mobile app
 * 5. Self app reads NFC passport chip (30 seconds)
 * 6. Self app generates zero-knowledge proof
 * 7. Self app sends proof to /api/identity/verify endpoint
 *
 * Features:
 * - NFC passport verification (174 countries supported)
 * - Zero-knowledge proofs (selective disclosure)
 * - Age verification (18+)
 * - OFAC compliance checking
 * - 30-second verification time
 */

import { SelfAppBuilder } from '@selfxyz/qrcode';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, url }) => {
	// Authentication check
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Use authenticated user's ID
	const userId = locals.user.id;

	try {
		const { templateSlug } = await request.json();

		// Validate self.xyz configuration
		const appName = process.env.SELF_APP_NAME || 'Communiqué';
		const scope = process.env.SELF_SCOPE || 'communique-congressional';

		// Construct verification callback endpoint URL
		const protocol = url.protocol === 'http:' && url.hostname === 'localhost' ? 'http:' : 'https:';
		const endpoint = `${protocol}//${url.host}/api/identity/verify`;

		console.log('[self.xyz] Initializing NFC verification:', {
			appName,
			scope,
			userId,
			endpoint
		});

		// Build self.xyz app configuration using official SDK
		const app = new SelfAppBuilder({
			version: 2,
			appName,
			scope,
			userId,
			userIdType: 'uuid',
			endpoint,
			// Self SDK EndpointType enum not exported — cast required
			endpointType: (url.hostname === 'localhost' ? 'staging_https' : 'mainnet_https') as any, // eslint-disable-line @typescript-eslint/no-explicit-any
			userDefinedData: JSON.stringify({
				templateSlug: templateSlug || '',
				timestamp: Date.now()
			}),
			disclosures: {
				nationality: true,
				minimumAge: 18,
				ofac: true,
				// Request address data for congressional district lookup
				name: false, // Don't need full name
				date_of_birth: true // Need for age verification
			}
		}).build();

		// Get QR code data (universal link format)
		// User scans this with Self mobile app
		const qrCodeData = (app as unknown as { getUniversalLink(): string }).getUniversalLink();

		console.log('[self.xyz] QR code generated:', {
			userId,
			qrCodeLength: qrCodeData.length
		});

		return json({
			success: true,
			qrCodeData,
			// Frontend will display QR code and poll for completion
			// Self app will send verification proof directly to /api/identity/verify
			expiresIn: 300 // QR code expires in 5 minutes
		});
	} catch (error) {
		console.error('[self.xyz] Initialization error:', error);

		// Log detailed error for debugging
		if (error instanceof Error) {
			console.error('[self.xyz] Error details:', {
				name: error.name,
				message: error.message,
				stack: error.stack?.split('\n').slice(0, 3)
			});
		}

		return json(
			{
				success: false,
				error: 'Failed to initialize Self.xyz verification'
			},
			{ status: 500 }
		);
	}
};
