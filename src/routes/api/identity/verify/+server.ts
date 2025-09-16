import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SelfBackendVerifier, InMemoryConfigStore } from '@selfxyz/core';
import { db } from '$lib/core/db';
import { SELF_XYZ_SCOPE, SELF_XYZ_ENDPOINT } from '$lib/core/server/selfxyz-config';
// Import shared verification sessions from init endpoint
// In production, this would be Redis/DB shared state
import { verificationSessions } from '$lib/core/server/verification-sessions';

// Initialize configuration store for Self.xyz
const configStore = new InMemoryConfigStore(
	async (userIdentifier: string, userDefinedData: string) => {
		// Generate a consistent action ID based on user identifier and data
		return `${userIdentifier}-${Buffer.from(userDefinedData).toString('hex').slice(0, 16)}`;
	}
);

// Allowed attestation IDs (1 = passport, 2 = EU ID card)
const allowedIds = new Map<1 | 2, boolean>([
	[1, true], // passport allowed
	[2, true] // EU ID card allowed
]);

// Initialize the Self.xyz backend verifier
const selfVerifier = new SelfBackendVerifier(
	SELF_XYZ_SCOPE,
	SELF_XYZ_ENDPOINT,
	false, // mockPassport = false for production
	allowedIds,
	configStore,
	'uuid' // userIdentifierType
);

export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	try {
		const body = await request.json();
		const { attestationId, proof, pubSignals, userContextData } = body;

		console.log('Self.xyz verification request:', {
			attestationId,
			userContextData: userContextData ? JSON.parse(userContextData) : null,
			clientIP: getClientAddress(),
			hasLoggedInUser: !!locals.user
		});

		// Store configuration for this verification (required by SDK)
		const contextData = userContextData ? JSON.parse(userContextData) : {};
		const { userId, templateSlug } = contextData;

		// Store verification config in the config store
		const configId = await configStore.getActionId(userId, userContextData);
		await configStore.setConfig(configId, {
			minimumAge: 18,
			excludedCountries: [], // No country restrictions for now
			ofac: true
		});

		// Verify the proof using Self.xyz backend verifier
		const verificationResult = await selfVerifier.verify(
			attestationId,
			proof,
			pubSignals,
			userContextData
		);

		// Check if verification was successful
		const isValid =
			verificationResult.isValidDetails.isValid &&
			verificationResult.isValidDetails.isMinimumAgeValid &&
			verificationResult.isValidDetails.isOfacValid;

		if (!isValid) {
			console.error('Self.xyz verification failed:', {
				isValid: verificationResult.isValidDetails.isValid,
				isMinimumAgeValid: verificationResult.isValidDetails.isMinimumAgeValid,
				isOfacValid: verificationResult.isValidDetails.isOfacValid
			});
			return json(
				{
					status: 'error',
					result: false,
					message: 'Identity verification failed - invalid proof or requirements not met'
				},
				{ status: 400 }
			);
		}

		// Extract credential data from the disclosed output
		const discloseOutput = verificationResult.discloseOutput;

		// Update verification session status
		const session = verificationSessions.get(userId);
		if (session) {
			session.status = 'verified';
			session.credentialSubject = discloseOutput;
		}

		// Extract user information for database storage
		const nationality = discloseOutput.nationality;
		const issuingState = discloseOutput.issuingState;
		const name = discloseOutput.name;
		const ageVerified = parseInt(discloseOutput.minimumAge) >= 18;
		const ofacPassed = discloseOutput.ofac.every((check) => check === true);

		// Create verification metadata
		const verificationData = {
			attestationId,
			nationality,
			issuingState,
			name,
			ageVerified,
			ofacPassed,
			nullifier: proof?.nullifier || null,
			sessionUserId: userId,
			verifiedAt: new Date().toISOString(),
			templateSlug
		};

		// If user is logged in, update their verification status in the database
		if (locals.user) {
			try {
				await db.user.update({
					where: { id: locals.user.id },
					data: {
						is_verified: true,
						verification_method: 'self_xyz',
						verification_data: verificationData,
						verified_at: new Date()
					}
				});

				console.log('Updated user verification in database:', {
					userId: locals.user.id,
					email: locals.user.email,
					nationality,
					ageVerified,
					ofacPassed
				});
			} catch (dbError) {
				console.error('Failed to update user verification in database:', dbError);
				// Continue processing - verification still succeeded
			}
		}

		console.log('Self.xyz verification successful:', {
			userId,
			nationality,
			name: typeof name === 'string' ? name.substring(0, 20) + '...' : name,
			ageVerified,
			ofacPassed,
			storedInDatabase: !!locals.user
		});

		return json({
			status: 'success',
			result: true,
			credentialSubject: discloseOutput,
			verificationData,
			userUpdated: !!locals.user,
			message: 'Identity verification completed successfully'
		});
	} catch (error) {
		console.error('Self.xyz verification error:', error);

		// Log detailed error information for debugging
		if (error instanceof Error) {
			console.error('Error details:', {
				name: error.name,
				message: error.message,
				stack: error.stack?.split('\n').slice(0, 5)
			});
		}

		return json(
			{
				status: 'error',
				result: false,
				message: 'Internal verification error'
			},
			{ status: 500 }
		);
	}
};
