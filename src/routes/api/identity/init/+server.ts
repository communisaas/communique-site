import { SelfAppBuilder } from '@selfxyz/qrcode';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVerificationSession } from '$lib/core/server/verification-sessions';

/**
 * Initialize self.xyz verification session
 * Generates QR code data using official SDK
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, templateSlug, requireAddress } = await request.json();

		if (!userId || !templateSlug) {
			return json({ success: false, error: 'Missing required fields' }, { status: 400 });
		}

		// Build self.xyz app configuration using official SDK
		const app = new SelfAppBuilder({
			version: 2,
			appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || 'Communiqué',
			scope: process.env.NEXT_PUBLIC_SELF_SCOPE || 'communique-congressional',
			userId: userId,
			userIdType: 'uuid',
			endpoint:
				process.env.NEXT_PUBLIC_SELF_ENDPOINT || 'https://communi.email/api/identity/verify',
			endpointType: 'staging_https',
			userDefinedData: JSON.stringify({
				templateSlug,
				requireAddress,
				timestamp: Date.now()
			}),
			disclosures: {
				nationality: true,
				minimumAge: 18,
				ofac: true
			}
		}).build();

		// Get QR code data (universal link format)
		const qrCodeData = app.getUniversalLink();

		// Create database session
		const session = await createVerificationSession({
			userId,
			method: 'self.xyz',
			challenge: qrCodeData
		});

		return json({
			success: true,
			qrCodeData,
			sessionId: session.sessionId,
			nonce: session.nonce,
			expiresAt: session.expiresAt
		});
	} catch (error) {
		console.error('self.xyz initialization error:', error);

		// Log detailed error for debugging
		if (error instanceof Error) {
			console.error('Initialization error details:', {
				name: error.name,
				message: error.message,
				stack: error.stack?.split('\n').slice(0, 3)
			});
		}

		return json(
			{ success: false, error: 'Failed to initialize Self.xyz verification' },
			{ status: 500 }
		);
	}
};
