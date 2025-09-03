import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SELF_XYZ_CONFIG, createUserConfig } from '$lib/core/server/selfxyz-config';
import { verificationSessions, cleanupOldSessions } from '$lib/core/server/verification-sessions';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, templateSlug, requireAddress, disclosures } = await request.json();

		if (!userId || !templateSlug) {
			return json(
				{ success: false, error: 'Missing required fields' },
				{ status: 400 }
			);
		}

		// Generate Self.xyz app configuration with user context
		const appConfig = createUserConfig(userId, templateSlug, requireAddress);
		
		// Merge any additional disclosures
		if (disclosures) {
			appConfig.disclosures = {
				...appConfig.disclosures,
				...disclosures
			};
		}

		// Create QR code data directly (Self.xyz app format)
		// This matches the format that SelfAppBuilder.build() would generate
		const builtConfig = {
			...appConfig,
			sessionId: userId,
			version: appConfig.version || 2,
			userIdType: 'uuid'
		};
		
		// Create QR code data string (the app will read this)
		const qrCodeData = JSON.stringify(builtConfig);

		// Store session for polling
		verificationSessions.set(userId, {
			userId,
			templateSlug,
			disclosures: appConfig.disclosures,
			qrCodeData,
			status: 'pending',
			createdAt: new Date()
		});

		// Clean up old sessions (>1 hour)
		cleanupOldSessions();

		console.log('Self.xyz verification session initialized:', {
			userId,
			templateSlug,
			disclosures: Object.keys(appConfig.disclosures),
			sessionCount: verificationSessions.size
		});

		return json({
			success: true,
			qrCodeData,
			sessionId: userId,
			config: appConfig
		});

	} catch (error) {
		console.error('Self.xyz init error:', error);
		
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

// Export the verification sessions for use in other endpoints
// verificationSessions is internal to this module