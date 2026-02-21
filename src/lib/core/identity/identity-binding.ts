/**
 * Identity Commitment Binding Service
 *
 * Prevents Sybil attacks by binding verified identity commitments to users.
 * When a user verifies their identity, their commitment is stored.
 * Future OAuth logins producing the same commitment are linked to existing account.
 *
 * ISSUE-001: Cross-Provider Identity Deduplication
 * Problem: User can create 5 accounts via 5 different OAuth providers.
 * Solution: Bind the identity_commitment from verification to the User model.
 * When a verified user logs in with a new OAuth provider, link to existing account.
 *
 * Flow:
 * 1. User signs up via OAuth (Google, Twitter, etc.)
 * 2. User completes identity verification (self.xyz or Didit.me)
 * 3. bindIdentityCommitment() is called with the cryptographic commitment
 * 4. If commitment already exists for another user, accounts are MERGED
 * 5. Future logins with any OAuth provider recognize the same identity
 */

import { prisma } from '$lib/core/db';
import { createHash } from 'crypto';
import { BN254_MODULUS } from '@voter-protocol/noir-prover';

// =============================================================================
// TYPES
// =============================================================================

export interface IdentityBindingResult {
	success: boolean;
	linkedToExisting: boolean;
	userId: string;
	previousUserId?: string;
	mergeDetails?: {
		accountsMoved: number;
		sourceEmail: string;
		targetEmail: string;
	};
}

export interface MergeAccountsResult {
	accountsMoved: number;
	sourceDeleted: boolean;
}

// =============================================================================
// IDENTITY COMMITMENT GENERATION
// =============================================================================

/**
 * Compute identity commitment from verification proof data.
 *
 * Produces a deterministic value per verified person regardless of OAuth provider.
 * The output is guaranteed to be a valid BN254 field element (< modulus) so it
 * can be used directly as a private input to the ZK circuit for nullifier computation.
 *
 * Pipeline: SHA-256(SHA-256(domain:passport:nationality:birthYear:documentType)) mod BN254
 *
 * NOTE: Different from identity_hash (which is unbounded SHA-256 for Sybil detection).
 */
export function computeIdentityCommitment(
	passportNumber: string,
	nationality: string,
	birthYear: number,
	documentType: string
): string {
	// Domain separation prefix prevents cross-protocol hash collisions
	const DOMAIN_PREFIX = 'communique-identity-v1';

	// BR6-002: Platform salt prevents offline passport enumeration attacks.
	// Without salt, an attacker with passport databases could precompute
	// all commitments and link them to on-chain nullifiers.
	const COMMITMENT_SALT = process.env.IDENTITY_COMMITMENT_SALT;
	if (!COMMITMENT_SALT) {
		throw new Error(
			'IDENTITY_COMMITMENT_SALT environment variable not configured. ' +
				'Generate with: openssl rand -hex 32'
		);
	}

	// Normalize inputs for consistent hashing
	const normalized = [
		DOMAIN_PREFIX,
		COMMITMENT_SALT,
		passportNumber.toUpperCase().trim(),
		nationality.toUpperCase().trim(),
		birthYear.toString(),
		documentType.toLowerCase().trim()
	].join(':');

	// Double-hash with domain separation for preimage resistance
	const inner = createHash('sha256').update(normalized).digest();
	const rawHex = createHash('sha256').update(inner).digest('hex');

	// Reduce mod BN254 — SHA-256 is 256 bits but BN254 field is ~254 bits.
	// ~25% of SHA-256 outputs exceed the modulus; reduction ensures the commitment
	// is always a valid field element for ZK circuit consumption.
	const value = BigInt('0x' + rawHex);
	const reduced = value % BN254_MODULUS;
	return reduced.toString(16).padStart(64, '0');
}

/**
 * Generate fingerprint for audit-safe logging (first 16 chars)
 */
export function getCommitmentFingerprint(commitment: string): string {
	return commitment.substring(0, 16);
}

// =============================================================================
// IDENTITY BINDING
// =============================================================================

/**
 * Bind an identity commitment to a user
 *
 * If the commitment already exists for another user, merge accounts:
 * - Move all OAuth accounts from current user to existing user
 * - Delete the duplicate user record
 * - Return the existing user's ID
 *
 * This prevents Sybil attacks where someone creates multiple accounts
 * via different OAuth providers and then tries to get verified on each.
 *
 * @param currentUserId - The user who just completed verification
 * @param identityCommitment - The cryptographic commitment from verification
 * @returns Binding result with merge details if applicable
 */
export async function bindIdentityCommitment(
	currentUserId: string,
	identityCommitment: string
): Promise<IdentityBindingResult> {
	// Check if this commitment is already bound to another user
	const existingUser = await prisma.user.findUnique({
		where: { identity_commitment: identityCommitment },
		select: {
			id: true,
			email: true,
			identity_commitment_at: true
		}
	});

	if (existingUser && existingUser.id !== currentUserId) {
		// Commitment belongs to different user - merge accounts
		console.debug(
			`[IdentityBinding] Detected duplicate identity. Merging user ${currentUserId} into ${existingUser.id}`
		);

		// Get current user info for logging
		const currentUser = await prisma.user.findUnique({
			where: { id: currentUserId },
			select: { email: true }
		});

		const mergeResult = await mergeAccounts(currentUserId, existingUser.id);

		return {
			success: true,
			linkedToExisting: true,
			userId: existingUser.id,
			previousUserId: currentUserId,
			mergeDetails: {
				accountsMoved: mergeResult.accountsMoved,
				sourceEmail: currentUser?.email || 'unknown',
				targetEmail: existingUser.email
			}
		};
	}

	// Check if current user already has a different commitment bound
	const currentUserData = await prisma.user.findUnique({
		where: { id: currentUserId },
		select: { identity_commitment: true }
	});

	if (currentUserData?.identity_commitment && currentUserData.identity_commitment !== identityCommitment) {
		// User is trying to bind a different identity - security violation
		console.error(
			`[IdentityBinding] SECURITY: User ${currentUserId} attempted to bind different identity commitment`
		);
		throw new Error('Cannot bind different identity to already verified user');
	}

	// Bind commitment to current user
	await prisma.user.update({
		where: { id: currentUserId },
		data: {
			identity_commitment: identityCommitment,
			identity_commitment_at: new Date()
		}
	});

	console.debug(`[IdentityBinding] Bound identity commitment to user ${currentUserId}`);

	return {
		success: true,
		linkedToExisting: false,
		userId: currentUserId
	};
}

/**
 * Merge accounts when same identity is detected
 *
 * Moves all OAuth accounts from sourceUserId to targetUserId,
 * then deletes the source user. This consolidates all login
 * methods under a single verified identity.
 *
 * Uses a transaction to ensure atomic operation.
 *
 * @param sourceUserId - User to merge FROM (will be deleted)
 * @param targetUserId - User to merge INTO (will be kept)
 */
async function mergeAccounts(sourceUserId: string, targetUserId: string): Promise<MergeAccountsResult> {
	const result = await prisma.$transaction(async (tx) => {
		// Count accounts being moved for logging
		const accountCount = await tx.account.count({
			where: { user_id: sourceUserId }
		});

		// Move all OAuth accounts to target user
		await tx.account.updateMany({
			where: { user_id: sourceUserId },
			data: { user_id: targetUserId }
		});

		// Move verification sessions (if any pending)
		await tx.verificationSession.updateMany({
			where: { user_id: sourceUserId },
			data: { user_id: targetUserId }
		});

		// Move verification audits for compliance trail
		await tx.verificationAudit.updateMany({
			where: { user_id: sourceUserId },
			data: { user_id: targetUserId }
		});

		// Move templates created by source user
		await tx.template.updateMany({
			where: { userId: sourceUserId },
			data: { userId: targetUserId }
		});

		// Move template campaigns
		await tx.template_campaign.updateMany({
			where: { user_id: sourceUserId },
			data: { user_id: targetUserId }
		});

		// Move user representatives
		// Note: May cause unique constraint violations if both users have same rep
		// BR6-006: Only catch P2002 (unique constraint), re-throw unexpected errors
		try {
			await tx.user_representatives.updateMany({
				where: { user_id: sourceUserId },
				data: { user_id: targetUserId }
			});
		} catch (e: unknown) {
			const isPrismaUniqueViolation =
				e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002';
			if (isPrismaUniqueViolation) {
				// Both users have same rep — delete source user's duplicates
				await tx.user_representatives.deleteMany({
					where: { user_id: sourceUserId }
				});
			} else {
				throw e;
			}
		}

		// Delete the duplicate user
		// Cascades will handle any remaining relations
		await tx.user.delete({
			where: { id: sourceUserId }
		});

		return { accountsMoved: accountCount, sourceDeleted: true };
	});

	console.debug(
		`[IdentityBinding] Merged user ${sourceUserId} into ${targetUserId}: ${result.accountsMoved} accounts moved`
	);

	return result;
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Check if a user has a bound identity commitment
 */
export async function hasIdentityCommitment(userId: string): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { identity_commitment: true }
	});
	return !!user?.identity_commitment;
}

/**
 * Find user by identity commitment
 * Returns null if no user has this commitment bound
 */
export async function findUserByCommitment(commitment: string): Promise<string | null> {
	const user = await prisma.user.findUnique({
		where: { identity_commitment: commitment },
		select: { id: true }
	});
	return user?.id ?? null;
}

/**
 * Get identity commitment for a user
 * Returns null if user hasn't completed identity verification
 */
export async function getIdentityCommitment(userId: string): Promise<string | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { identity_commitment: true }
	});
	return user?.identity_commitment ?? null;
}

/**
 * Check if an identity commitment is already in use
 * Useful for pre-flight check before verification
 */
export async function isCommitmentInUse(commitment: string, excludeUserId?: string): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { identity_commitment: commitment },
		select: { id: true }
	});

	if (!user) return false;
	if (excludeUserId && user.id === excludeUserId) return false;
	return true;
}
