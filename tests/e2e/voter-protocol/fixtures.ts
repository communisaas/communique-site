/**
 * Test Fixtures for Voter Protocol Integration E2E Tests
 *
 * Provides mock data, test vectors, and factory functions for:
 * - Didit.me identity verification webhooks
 * - Shadow Atlas district lookups and Merkle proofs
 * - ZK proof inputs (valid and invalid)
 * - Congressional submission payloads
 *
 * SECURITY NOTE: All proof vectors are for TESTING ONLY.
 * Never use these in production - they are deterministic and publicly known.
 */

// ============================================================================
// BN254 Field Modulus (for validation)
// ============================================================================

export const BN254_MODULUS = BigInt(
	'21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

// ============================================================================
// Didit.me Mock Data
// ============================================================================

export interface MockDiditWebhookPayload {
	type: string;
	data: {
		status: 'Approved' | 'Rejected' | 'Pending' | 'Expired';
		session_id: string;
		metadata: {
			user_id: string;
			template_slug: string;
			initiated_at: string;
		};
		decision: {
			id_verification: {
				date_of_birth: string;
				document_number: string;
				issuing_state: string;
				document_type: 'passport' | 'drivers_license' | 'id_card';
			};
		};
	};
	vendor_data: string;
}

/**
 * Generate a valid Didit.me webhook payload
 */
export function createMockDiditWebhook(
	overrides: Partial<{
		userId: string;
		sessionId: string;
		status: 'Approved' | 'Rejected' | 'Pending' | 'Expired';
		documentType: 'passport' | 'drivers_license' | 'id_card';
		birthYear: number;
		nationality: string;
		documentNumber: string;
	}> = {}
): MockDiditWebhookPayload {
	const userId = overrides.userId ?? 'test-user-123';
	const sessionId = overrides.sessionId ?? `session-${Date.now()}`;
	const status = overrides.status ?? 'Approved';
	const documentType = overrides.documentType ?? 'passport';
	const birthYear = overrides.birthYear ?? 1990;
	const nationality = overrides.nationality ?? 'USA';
	const documentNumber = overrides.documentNumber ?? 'P123456789';

	return {
		type: 'status.updated',
		data: {
			status,
			session_id: sessionId,
			metadata: {
				user_id: userId,
				template_slug: 'voter-verification',
				initiated_at: new Date().toISOString()
			},
			decision: {
				id_verification: {
					date_of_birth: `${birthYear}-06-15`,
					document_number: documentNumber,
					issuing_state: nationality,
					document_type: documentType
				}
			}
		},
		vendor_data: userId
	};
}

/**
 * Invalid webhook payloads for error testing
 */
export const INVALID_DIDIT_WEBHOOKS = {
	missingUserId: {
		type: 'status.updated',
		data: {
			status: 'Approved',
			decision: {
				id_verification: {
					date_of_birth: '1990-06-15',
					document_number: 'P123456789',
					issuing_state: 'USA',
					document_type: 'passport'
				}
			}
		}
	},
	rejectedStatus: createMockDiditWebhook({ status: 'Rejected' }),
	expiredStatus: createMockDiditWebhook({ status: 'Expired' }),
	underageUser: createMockDiditWebhook({ birthYear: 2015 }) // Would be 11 years old
};

// ============================================================================
// Shadow Atlas Mock Data
// ============================================================================

export interface MockShadowAtlasResponse {
	success: boolean;
	data: {
		district: {
			id: string;
			name: string;
			jurisdiction: string;
			districtType: string;
		};
		merkleProof: {
			root: string;
			leaf: string;
			siblings: string[];
			pathIndices: number[];
			depth: number;
		};
	};
}

/**
 * Generate a mock Shadow Atlas lookup response
 * Uses zero-path siblings for deterministic testing
 */
export function createMockShadowAtlasResponse(
	overrides: Partial<{
		districtId: string;
		districtName: string;
		jurisdiction: string;
		merkleRoot: string;
		leaf: string;
		leafIndex: number;
		depth: number;
	}> = {}
): MockShadowAtlasResponse {
	const depth = overrides.depth ?? 20;
	const ZERO_PAD = '0x' + '00'.repeat(32);

	return {
		success: true,
		data: {
			district: {
				id: overrides.districtId ?? 'usa-ca-sf-d5',
				name: overrides.districtName ?? 'San Francisco District 5',
				jurisdiction: overrides.jurisdiction ?? 'city-council',
				districtType: 'council'
			},
			merkleProof: {
				root:
					overrides.merkleRoot ??
					'0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809',
				leaf:
					overrides.leaf ?? '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
				siblings: Array(depth).fill(ZERO_PAD),
				pathIndices: Array(depth).fill(0),
				depth
			}
		}
	};
}

/**
 * Invalid Shadow Atlas responses for error testing
 */
export const INVALID_SHADOW_ATLAS_RESPONSES = {
	notFound: {
		success: false,
		error: {
			code: 'DISTRICT_NOT_FOUND',
			message: 'No district found for the given coordinates'
		}
	},
	invalidCoordinates: {
		success: false,
		error: {
			code: 'INVALID_COORDINATES',
			message: 'Latitude must be between -90 and 90'
		}
	},
	wrongDepth: {
		success: true,
		data: {
			district: {
				id: 'usa-ca-sf-d5',
				name: 'San Francisco District 5',
				jurisdiction: 'city-council',
				districtType: 'council'
			},
			merkleProof: {
				root: '0x1234',
				leaf: '0x5678',
				siblings: Array(12).fill('0x00'), // Wrong depth!
				pathIndices: Array(12).fill(0),
				depth: 12
			}
		}
	}
};

// ============================================================================
// ZK Proof Test Vectors
// ============================================================================

/**
 * Valid proof inputs that will satisfy circuit constraints
 * These match the format expected by @voter-protocol/noir-prover
 */
export const VALID_PROOF_INPUTS = {
	minimal: {
		// Public inputs
		merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
		actionDomain: '0x0000000000000000000000000000000000000000000000000000000000000001',

		// Private inputs
		userSecret: '0x0000000000000000000000000000000000000000000000000000000000001234',
		districtId: '0x0000000000000000000000000000000000000000000000000000000000000042',
		authorityLevel: 1 as const,
		registrationSalt: '0x0000000000000000000000000000000000000000000000000000000000000099',

		// Merkle proof
		merklePath: Array(20).fill(
			'0x0000000000000000000000000000000000000000000000000000000000000000'
		),
		leafIndex: 0
	},

	realistic: {
		merkleRoot: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809',
		actionDomain: '0x' + Buffer.from('sf-council-2024-vote').toString('hex').padStart(64, '0'),
		userSecret: '0x' + 'deadbeef'.repeat(8),
		districtId:
			'0x' + Buffer.from('usa-ca-sf-d5').toString('hex').padStart(64, '0'),
		authorityLevel: 3 as const,
		registrationSalt: '0x' + 'cafebabe'.repeat(8),
		merklePath: Array(20).fill(
			'0x0000000000000000000000000000000000000000000000000000000000000000'
		),
		leafIndex: 42
	}
};

/**
 * Invalid proof inputs for error testing
 */
export const INVALID_PROOF_INPUTS = {
	// Field element exceeds BN254 modulus
	overflowFieldElement: {
		...VALID_PROOF_INPUTS.minimal,
		merkleRoot: '0x' + 'ff'.repeat(32) // > BN254 modulus
	},

	// Wrong merkle path length
	wrongPathLength: {
		...VALID_PROOF_INPUTS.minimal,
		merklePath: Array(12).fill('0x' + '00'.repeat(32)) // Should be 20
	},

	// Authority level out of range
	invalidAuthorityLevel: {
		...VALID_PROOF_INPUTS.minimal,
		authorityLevel: 10 // Must be 1-5
	},

	// Negative leaf index
	negativeLeafIndex: {
		...VALID_PROOF_INPUTS.minimal,
		leafIndex: -1
	},

	// Leaf index out of range for depth-20
	leafIndexOverflow: {
		...VALID_PROOF_INPUTS.minimal,
		leafIndex: 2 ** 20 + 1 // Max is 2^20 - 1
	}
};

// ============================================================================
// Congressional Submission Test Data
// ============================================================================

export interface MockCongressionalSubmission {
	proof: string;
	publicInputs: {
		merkleRoot: string;
		nullifier: string;
		authorityLevel: number;
		actionDomain: string;
		districtId: string;
	};
	message: {
		subject: string;
		body: string;
		templateId: string;
	};
	recipient: {
		bioguideId: string;
		name: string;
		chamber: 'house' | 'senate';
		state: string;
		district?: string;
	};
}

/**
 * Create a mock congressional submission payload
 */
export function createMockSubmission(
	overrides: Partial<MockCongressionalSubmission> = {}
): MockCongressionalSubmission {
	return {
		proof:
			overrides.proof ??
			'0x' +
				'abcdef0123456789'.repeat(64), // Mock proof bytes
		publicInputs: overrides.publicInputs ?? {
			merkleRoot: VALID_PROOF_INPUTS.minimal.merkleRoot,
			nullifier: '0x' + 'cafe'.repeat(16), // Computed by circuit
			authorityLevel: 3,
			actionDomain: VALID_PROOF_INPUTS.minimal.actionDomain,
			districtId: VALID_PROOF_INPUTS.minimal.districtId
		},
		message: overrides.message ?? {
			subject: 'Support Climate Action Legislation',
			body: 'Dear Representative, I am writing as your constituent to urge you to support climate action legislation...',
			templateId: 'climate-action-2024'
		},
		recipient: overrides.recipient ?? {
			bioguideId: 'P000197',
			name: 'Nancy Pelosi',
			chamber: 'house',
			state: 'CA',
			district: '11'
		}
	};
}

// ============================================================================
// Session & Auth Fixtures
// ============================================================================

export interface MockUserSession {
	userId: string;
	email: string;
	name: string;
	isVerified: boolean;
	verificationMethod?: 'didit.me' | 'self.xyz';
	authorityLevel?: number;
	districtId?: string;
}

export const TEST_USERS = {
	verified: {
		userId: 'user-verified-123',
		email: 'verified@test.com',
		name: 'Verified User',
		isVerified: true,
		verificationMethod: 'didit.me' as const,
		authorityLevel: 4,
		districtId: 'usa-ca-sf-d5'
	},
	unverified: {
		userId: 'user-unverified-456',
		email: 'unverified@test.com',
		name: 'Unverified User',
		isVerified: false
	},
	recentlyVerified: {
		userId: 'user-recent-789',
		email: 'recent@test.com',
		name: 'Recently Verified',
		isVerified: true,
		verificationMethod: 'self.xyz' as const,
		authorityLevel: 3,
		districtId: 'usa-wa-seattle-d1'
	}
};

// ============================================================================
// Test Coordinates
// ============================================================================

export const TEST_COORDINATES = {
	sfCityHall: { lat: 37.7793, lng: -122.4193 },
	seattleCityHall: { lat: 47.6038, lng: -122.3301 },
	austinCapitol: { lat: 30.2747, lng: -97.7404 },
	dcWhiteHouse: { lat: 38.8977, lng: -77.0365 },
	// Edge cases
	exactlyOnDistrictLine: { lat: 37.7749, lng: -122.4194 }, // Hypothetical boundary
	internationalDateLine: { lat: 0.0, lng: 180.0 },
	nullIsland: { lat: 0.0, lng: 0.0 }
};

// ============================================================================
// Nullifier Test Vectors
// ============================================================================

/**
 * Pre-computed nullifiers for double-voting tests
 * These are deterministic based on userSecret + actionDomain
 */
export const NULLIFIER_TEST_VECTORS = {
	firstVote: {
		userSecret: VALID_PROOF_INPUTS.minimal.userSecret,
		actionDomain: VALID_PROOF_INPUTS.minimal.actionDomain,
		// This would be computed by the circuit, but for mocking we provide it
		expectedNullifier: '0x' + 'abcd'.repeat(16)
	},
	secondAttempt: {
		// Same user, same action = same nullifier = should be rejected
		userSecret: VALID_PROOF_INPUTS.minimal.userSecret,
		actionDomain: VALID_PROOF_INPUTS.minimal.actionDomain,
		expectedNullifier: '0x' + 'abcd'.repeat(16)
	},
	differentAction: {
		// Same user, different action = different nullifier = allowed
		userSecret: VALID_PROOF_INPUTS.minimal.userSecret,
		actionDomain: '0x' + Buffer.from('different-vote-2024').toString('hex').padStart(64, '0'),
		expectedNullifier: '0x' + 'dcba'.repeat(16)
	}
};

// ============================================================================
// HMAC Signature Helpers
// ============================================================================

import { createHmac } from 'crypto';

/**
 * Generate a valid HMAC signature for Didit webhook testing
 */
export function generateWebhookSignature(
	payload: string,
	secret: string,
	timestamp?: string
): { signature: string; timestamp: string } {
	const ts = timestamp ?? Math.floor(Date.now() / 1000).toString();
	const signedPayload = `${ts}.${payload}`;
	const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');

	return { signature, timestamp: ts };
}

/**
 * Create webhook headers for testing
 */
export function createWebhookHeaders(
	payload: string,
	secret: string
): { 'x-didit-signature': string; 'x-didit-timestamp': string; 'content-type': string } {
	const { signature, timestamp } = generateWebhookSignature(payload, secret);
	return {
		'x-didit-signature': signature,
		'x-didit-timestamp': timestamp,
		'content-type': 'application/json'
	};
}
