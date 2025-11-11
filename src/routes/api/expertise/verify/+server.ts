/**
 * Expertise Verification API (Proxy to voter-protocol ReputationAgent)
 *
 * POST /api/expertise/verify
 * Verify user credentials and create/update expertise record
 *
 * ARCHITECTURE CHANGE (2025-11-09):
 * - Communique: UI/UX, database storage (this file)
 * - voter-protocol: Verification logic, Gemini 2.5 Flash agent, state API integrations
 *
 * Workflow:
 * 1. User submits free-text credentials (Communique frontend)
 * 2. Communique proxies to voter-protocol ReputationAgent API
 * 3. ReputationAgent (Gemini 2.5 Flash) parses credentials + state API verification
 * 4. Communique stores result in Postgres UserExpertise table
 * 5. Return expertise record with verification status and multiplier
 *
 * Cost Savings: $682.50/month (Gemini 2.5 Flash FREE tier vs OpenAI GPT-4o $700/month)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { createApiError, type ApiResponse } from '$lib/types/errors';

// voter-protocol ReputationAgent API endpoint
const VOTER_PROTOCOL_API_URL =
	process.env.VOTER_PROTOCOL_API_URL || 'https://reputation.voter.workers.dev';
const VOTER_API_KEY = process.env.VOTER_API_KEY;

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		const session = locals.session;
		if (!session?.userId) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('auth', 'AUTH_REQUIRED', 'Authentication required')
			};
			return json(response, { status: 401 });
		}

		const body = await request.json();
		const {
			domain,
			organization_type,
			professional_role,
			experience_description,
			credentials_claim
		} = body;

		// Validate required fields
		if (!domain) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'VALIDATION_REQUIRED_FIELD', 'Domain is required')
			};
			return json(response, { status: 400 });
		}

		// 1. Check if expertise record already exists
		let expertise = await db.userExpertise.findUnique({
			where: {
				user_id_domain: { user_id: session.userId, domain }
			}
		});

		// 2. Call voter-protocol ReputationAgent API for verification
		let verificationResult = null;
		if (credentials_claim) {
			try {
				const verifyResponse = await fetch(`${VOTER_PROTOCOL_API_URL}/reputation/verify`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${VOTER_API_KEY}`,
						'X-User-ID': session.userId,
						'X-Domain': domain
					},
					body: JSON.stringify({
						user_id: session.userId,
						domain,
						organization_type,
						professional_role,
						experience_description,
						credentials_claim
					})
				});

				if (!verifyResponse.ok) {
					throw new Error(`voter-protocol API error: ${verifyResponse.statusText}`);
				}

				verificationResult = await verifyResponse.json();
			} catch (error) {
				console.error('voter-protocol ReputationAgent API error:', error);
				// Fallback: create unverified record if voter-protocol is unavailable
				verificationResult = {
					verification_status: 'unverified',
					credential_multiplier: 1.0,
					verified_by_agent: null,
					verification_evidence: {
						method: 'voter_protocol_unavailable',
						details: { error: error instanceof Error ? error.message : 'Unknown error' },
						verified_at: new Date()
					}
				};
			}
		}

		// 3. Create or update expertise record in Communique database
		if (!expertise) {
			// Create new expertise record
			expertise = await db.userExpertise.create({
				data: {
					user_id: session.userId,
					domain,
					organization_type,
					professional_role,
					experience_description,
					credentials_claim,
					verification_status: verificationResult?.verification_status || 'unverified',
					verification_evidence: verificationResult?.verification_evidence || null,
					verified_at: verificationResult ? new Date() : null,
					verified_by_agent: verificationResult?.verified_by_agent || null,
					credential_multiplier: verificationResult?.credential_multiplier || 1.0
				}
			});
		} else if (verificationResult) {
			// Update existing expertise record with verification results
			expertise = await db.userExpertise.update({
				where: { id: expertise.id },
				data: {
					professional_role,
					experience_description,
					credentials_claim,
					verification_status: verificationResult.verification_status,
					verification_evidence: verificationResult.verification_evidence,
					verified_at: new Date(),
					verified_by_agent: verificationResult.verified_by_agent,
					credential_multiplier: verificationResult.credential_multiplier
				}
			});
		}

		const response: ApiResponse = {
			success: true,
			data: {
				expertise: {
					id: expertise.id,
					domain: expertise.domain,
					organization_type: expertise.organization_type,
					professional_role: expertise.professional_role,
					experience_description: expertise.experience_description,
					credentials_claim: expertise.credentials_claim,
					verification_status: expertise.verification_status,
					verification_evidence: expertise.verification_evidence,
					verified_at: expertise.verified_at,
					verified_by_agent: expertise.verified_by_agent,
					credential_multiplier: expertise.credential_multiplier,
					messages_sent: expertise.messages_sent,
					templates_created: expertise.templates_created,
					issues_tracked: expertise.issues_tracked,
					peer_endorsements: expertise.peer_endorsements,
					created_at: expertise.created_at,
					updated_at: expertise.updated_at
				}
			}
		};

		return json(response);
	} catch (error) {
		console.error('Expertise verification API error:', error);

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'Failed to verify credentials')
		};

		return json(response, { status: 500 });
	}
};

/**
 * GET /api/expertise/verify?user_id={id}
 * Get all expertise records for a user (authenticated users only)
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const session = locals.session;
		if (!session?.userId) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('auth', 'AUTH_REQUIRED', 'Authentication required')
			};
			return json(response, { status: 401 });
		}

		// Users can only query their own expertise (privacy)
		const { getUserExpertise } = await import('$lib/core/reputation/credential-verifier');
		const expertise = await getUserExpertise(session.userId);

		const response: ApiResponse = {
			success: true,
			data: { expertise }
		};

		return json(response);
	} catch (error) {
		console.error('Expertise query API error:', error);

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'Failed to fetch expertise')
		};

		return json(response, { status: 500 });
	}
};
