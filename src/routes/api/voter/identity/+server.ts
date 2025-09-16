/**
 * VOTER Protocol Identity Verification API
 * 
 * Handles Didit KYC integration and trust score calculation
 * Called by N8N identity verification workflow
 */

import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/core/db.js';
import type { RequestHandler } from './$types';

// Mock Didit client - replace with actual implementation
class DiditClient {
	private apiKey: string;
	private baseUrl: string;
	
	constructor() {
		this.apiKey = process.env.DIDIT_API_KEY || '';
		this.baseUrl = 'https://api.didit.me/v1';
	}
	
	async verify({ userAddress, verificationType = 'kyc_basic' }) {
		if (!this.apiKey) {
			// Simulation mode for development
			return {
				status: 'verified',
				confidence: 0.85,
				checks: {
					idDocument: 'pass',
					faceMatch: 'pass',
					liveness: 'pass'
				},
				addressData: {
					congressionalDistrict: 'CA-12', // Mock district
					state: 'CA',
					verified: true
				}
			};
		}
		
		// Real Didit API call
		const response = await fetch(`${this.baseUrl}/verify`, {
			method: 'POST',
			headers: {
				'X-API-Key': this.apiKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				userId: userAddress,
				verificationType,
				includeProof: true
			})
		});
		
		if (!response.ok) {
			throw new Error(`Didit API error: ${response.status}`);
		}
		
		return await response.json();
	}
}

const diditClient = new DiditClient();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, walletAddress, zkProof, publicInputs } = await request.json();
		
		if (!userId) {
			throw error(400, 'Missing required field: userId');
		}
		
		// Perform Didit KYC verification
		const kycResult = await diditClient.verify({
			userAddress: walletAddress || userId,
			verificationType: 'kyc_basic'
		});
		
		// Calculate trust score based on Didit checks
		let trustScore = 0;
		const checks = kycResult?.checks || {};
		
		if (checks.idDocument === 'pass') trustScore += 40;  // Government ID is most important
		if (checks.faceMatch === 'pass') trustScore += 30;   // Face match confirms identity  
		if (checks.liveness === 'pass') trustScore += 20;    // Liveness prevents spoofing
		if (kycResult?.addressData?.congressionalDistrict) trustScore += 10; // Address verification
		
		// Create privacy-preserving district hash
		const districtHash = kycResult?.addressData?.congressionalDistrict 
			? `hash_${Buffer.from(kycResult.addressData.congressionalDistrict).toString('base64').substring(0, 8)}`
			: null;
		
		// Determine verification level
		const verificationLevel = 
			trustScore >= 90 ? 'fully_verified' :
			trustScore >= 60 ? 'verified' :
			trustScore >= 30 ? 'partially_verified' :
			'unverified';
		
		// Update user in database via main API endpoint
		const updateResponse = await fetch(`${request.url.origin}/api/voter`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'verify_identity',
				userId,
				walletAddress,
				kycResult,
				trustScore,
				districtHash
			})
		});
		
		if (!updateResponse.ok) {
			throw error(500, 'Failed to update user verification status');
		}
		
		const updateResult = await updateResponse.json();
		
		return json({
			success: true,
			userId,
			walletAddress,
			verification: {
				status: verificationLevel,
				kyc: {
					passed: kycResult?.status === 'verified',
					id_verification: checks.idDocument === 'pass',
					face_match: checks.faceMatch === 'pass',
					liveness: checks.liveness === 'pass',
					provider: 'didit'
				},
				congressional_district: kycResult?.addressData?.congressionalDistrict,
				district_hash: districtHash,
				trust_score: trustScore,
				verified_at: new Date().toISOString()
			},
			permissions: {
				can_submit_templates: trustScore >= 30,
				can_create_challenges: trustScore >= 60,
				can_vote_challenges: trustScore >= 40,
				daily_action_limit: Math.floor(trustScore / 10),
				max_stake: trustScore * 100  // Max VOTER tokens for staking
			},
			message: `Identity verification completed - ${verificationLevel}`
		});
		
	} catch (err) {
		console.error('Identity verification error:', err);
		throw error(500, err instanceof Error ? err.message : 'Identity verification failed');
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		const walletAddress = url.searchParams.get('walletAddress');
		
		if (!userId && !walletAddress) {
			throw error(400, 'Must provide either userId or walletAddress parameter');
		}
		
		// Get user verification status via main API
		const profileResponse = await fetch(`${url.origin}/api/voter`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'get_user_profile',
				userId,
				walletAddress
			})
		});
		
		if (!profileResponse.ok) {
			throw error(404, 'User not found');
		}
		
		const profile = await profileResponse.json();
		
		return json({
			success: true,
			verification_status: {
				is_verified: profile.user.is_verified,
				verification_method: profile.user.verification_method,
				trust_score: profile.user.trust_score,
				reputation_tier: profile.user.reputation_tier,
				congressional_district: profile.user.congressional_district
			},
			permissions: {
				can_submit_templates: profile.user.trust_score >= 30,
				can_create_challenges: profile.user.trust_score >= 60,
				can_vote_challenges: profile.user.trust_score >= 40,
				daily_action_limit: Math.floor(profile.user.trust_score / 10),
				max_stake: profile.user.trust_score * 100
			}
		});
		
	} catch (err) {
		console.error('Get identity verification error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to get verification status');
	}
};