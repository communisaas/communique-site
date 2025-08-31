import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	SelfBackendVerifier,
	AllIds
} from '@selfxyz/core';
import type { AttestationId, IConfigStorage } from '@selfxyz/core';
import { db } from '$lib/core/db';

// Configuration storage implementation for Self.xyz
class CommuniqueConfigStorage implements IConfigStorage {
	async getConfig(configId: string) {
		// Return verification requirements for Communiqué
		return {
			olderThan: 18,					// Minimum age 18
			excludedCountries: [],			// No excluded countries for now
			ofac: true						// Enable OFAC compliance checking
		};
	}
	
	async setConfig(configId: string, config: any) {
		// We use static configuration, so this is a no-op
		// In a real implementation, you might store this in a database
		return true;
	}
	
	async getActionId(userIdentifier: string, userDefinedData: string) {
		return 'communique_verification'; // Static config ID for our app
	}
}

// Initialize the Self.xyz backend verifier
const configStorage = new CommuniqueConfigStorage();

const selfBackendVerifier = new SelfBackendVerifier(
	'communique-sybil-resistance',			// Scope matching frontend
	`${process.env.ORIGIN || 'http://localhost:5173'}/api/user/verify-identity`,
	process.env.NODE_ENV !== 'production',	// Use mock passports in development
	AllIds,									// Accept all supported document types
	configStorage,							// Configuration storage implementation
	'uuid'									// We use UUIDs for user identifiers
);

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { attestationId, proof, pubSignals, userContextData } = body;

		// Validate required fields
		if (!attestationId || !proof || !pubSignals || !userContextData) {
			return json({ 
				status: 'error',
				result: false,
				message: 'Missing required verification fields' 
			}, { status: 400 });
		}

		// Verify the Self.xyz proof
		const result = await selfBackendVerifier.verify(
			attestationId,
			proof,
			pubSignals,
			userContextData
		);
		
		if (result.isValidDetails.isValid) {
			// Extract the session user ID from userContextData to link with current user
			const sessionUserId = result.userData.userIdentifier;
			
			// If user is logged in, update their verification status
			if (locals.user) {
				await db.user.update({
					where: { id: locals.user.id },
					data: {
						is_verified: true,
						verification_method: 'self_xyz',
						verification_data: {
							attestationId: result.attestationId,
							nationality: result.discloseOutput.nationality,
							ageVerified: result.isValidDetails.isMinimumAgeValid,
							ofacPassed: result.isValidDetails.isOfacValid,
							nullifier: result.discloseOutput.nullifier,
							sessionUserId: sessionUserId,
							verifiedAt: new Date().toISOString()
						},
						verified_at: new Date()
					}
				});
			}
			
			// Return successful verification response
			return json({
				status: 'success',
				result: true,
				verification: {
					verified: true,
					method: 'self_xyz',
					nationality: result.discloseOutput.nationality,
					ageVerified: result.isValidDetails.isMinimumAgeValid,
					ofacPassed: result.isValidDetails.isOfacValid,
					documentType: result.attestationId === 1 ? 'passport' : 'eu_id_card'
				}
			});
		} else {
			// Return failed verification response
			return json({
				status: 'error',
				result: false,
				message: 'Identity verification failed',
				details: {
					isValid: result.isValidDetails.isValid,
					ageValid: result.isValidDetails.isMinimumAgeValid,
					ofacValid: result.isValidDetails.isOfacValid
				}
			}, { status: 400 });
		}
	} catch (error: any) {
		if (error.name === 'ConfigMismatchError') {
			console.error('Self.xyz configuration mismatch:', error.issues);
			return json({
				status: 'error',
				result: false,
				message: 'Verification configuration mismatch',
				issues: error.issues
			}, { status: 400 });
		}
		
		console.error('Self.xyz verification error:', error);
		return json({
			status: 'error',
			result: false,
			message: error instanceof Error ? error.message : 'Unknown verification error'
		}, { status: 500 });
	}
};

// Handle preflight OPTIONS requests for CORS
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		},
	});
};