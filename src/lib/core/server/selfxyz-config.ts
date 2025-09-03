/**
 * Self.xyz Configuration
 * 
 * Centralized configuration for Self.xyz identity verification.
 * This must be identical between the QR code generation (frontend) 
 * and the backend verification to ensure proper verification.
 */

export const SELF_XYZ_SCOPE = "communique-congressional";
export const SELF_XYZ_ENDPOINT = `${process.env.ORIGIN || 'http://localhost:5173'}/api/identity/verify`;

export const SELF_XYZ_CONFIG = {
	appName: "Communiqué",
	scope: SELF_XYZ_SCOPE,
	endpoint: SELF_XYZ_ENDPOINT,
	version: 2,
	disclosures: {
		nationality: true,
		issuing_state: true,
		name: true,
		minimumAge: 18,
		ofac: true
	}
};

/**
 * Generate user-specific Self.xyz configuration for QR code
 */
export function createUserConfig(userId: string, templateSlug: string, requireAddress = true) {
	return {
		...SELF_XYZ_CONFIG,
		userId,
		userIdType: 'uuid' as const,
		userDefinedData: JSON.stringify({
			templateSlug,
			requireAddress,
			timestamp: Date.now()
		})
	};
}