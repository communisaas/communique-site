/**
 * Community Field Contribution Orchestrator
 *
 * Ties together all Phase 2 modules into a single pipeline:
 *   1. Compute H3 cells from bubble (h3-cells.ts)
 *   2. Build cell set Merkle tree (merkle-builder.ts)
 *   3. Fetch engagement data from Shadow Atlas
 *   4. Compute epoch domain (action-domain-builder.ts)
 *   5. Generate BubbleMembershipProof (community-field-client.ts)
 *   6. Submit contribution to Shadow Atlas proxy
 *
 * Called from BubbleView when the user's bubble is ready and they
 * haven't contributed for the current epoch.
 */

import { bubbleToH3Cells, h3ToField, MAX_CELLS } from '$lib/core/bubble/h3-cells';
import { buildPoseidonMerkleTree } from '$lib/core/crypto/merkle-builder';
import { buildCommunityFieldEpochDomain } from '$lib/core/zkp/action-domain-builder';
import {
	generateCommunityFieldProof,
	type CommunityFieldProofOutput
} from '$lib/core/zkp/community-field-client';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ContributionStage =
	| 'computing-cells'
	| 'building-tree'
	| 'fetching-engagement'
	| 'computing-epoch'
	| 'generating-proof'
	| 'submitting'
	| 'complete'
	| 'error';

export interface ContributionResult {
	cellSetRoot: string;
	epochNullifier: string;
	epochDate: string;
	cellCount: number;
}

export interface ContributionContext {
	/** Bubble center (lat/lng). */
	center: { lat: number; lng: number };
	/** Bubble radius in meters. */
	radiusMeters: number;
	/** Identity commitment (0x-prefixed hex). */
	identityCommitment: string;
	/** Jurisdiction-specific base action domain (0x-prefixed hex). */
	baseDomain: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGAGEMENT DATA FETCH
// ═══════════════════════════════════════════════════════════════════════════

interface EngagementData {
	engagementPath: string[];
	engagementIndex: number;
	engagementRoot: string;
	engagementTier: number;
	actionCount: string;
	diversityScore: string;
}

async function fetchEngagementData(identityCommitment: string): Promise<EngagementData> {
	// Fetch engagement path + leaf data from Shadow Atlas via our proxy
	const response = await fetch('/api/shadow-atlas/engagement', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identityCommitment })
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({ error: 'Failed to fetch engagement data' }));
		throw new Error(err.error || `Engagement fetch failed: ${response.status}`);
	}

	const data = await response.json();

	return {
		engagementPath: data.path,
		engagementIndex: data.leafIndex,
		engagementRoot: data.root,
		engagementTier: data.tier,
		actionCount: data.actionCount,
		diversityScore: data.diversityScore
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRIBUTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute the full community field contribution pipeline.
 *
 * Steps:
 *   1. Compute H3 cells from bubble geometry (client-side, ~1ms)
 *   2. Build Poseidon Merkle tree over cell IDs (client-side, ~50ms)
 *   3. Fetch engagement data from Shadow Atlas (network, ~200ms)
 *   4. Compute epoch domain for today (client-side, ~1ms)
 *   5. Generate BubbleMembershipProof (~5-8s desktop, ~15-30s mobile)
 *   6. Submit proof to Shadow Atlas via proxy (network, ~500ms)
 *
 * @param ctx - Bubble center/radius, identity commitment, base domain
 * @param onStage - Optional callback for UI progress tracking
 * @returns Contribution result with cellSetRoot, epochNullifier, epochDate
 */
export async function contributeToCommunityField(
	ctx: ContributionContext,
	onStage?: (stage: ContributionStage) => void
): Promise<ContributionResult> {
	// Step 1: Compute H3 cells from bubble
	onStage?.('computing-cells');
	const cellIndices = bubbleToH3Cells(ctx.center, ctx.radiusMeters);
	if (cellIndices.length === 0) {
		throw new Error('Bubble does not intersect any H3 cells');
	}

	// Convert to field elements
	const cellFields = cellIndices.map((idx) => '0x' + h3ToField(idx).toString(16).padStart(64, '0'));

	// Step 2: Build cell set Merkle tree
	onStage?.('building-tree');
	const tree = await buildPoseidonMerkleTree(cellFields, 4); // depth-4 for MAX_CELLS=16

	// Step 3: Fetch engagement data
	onStage?.('fetching-engagement');
	const engagement = await fetchEngagementData(ctx.identityCommitment);

	// Step 4: Compute epoch domain
	onStage?.('computing-epoch');
	const today = new Date();
	const epochDate = today.toISOString().slice(0, 10); // "2026-03-02"
	const epochDomain = buildCommunityFieldEpochDomain(ctx.baseDomain, today);

	// Zero-pad cell IDs for circuit (expects exactly MAX_CELLS)
	const paddedCellFields = [...cellFields];
	const ZERO_FIELD = '0x' + '0'.padStart(64, '0');
	while (paddedCellFields.length < MAX_CELLS) {
		paddedCellFields.push(ZERO_FIELD);
	}

	// Step 5: Generate BubbleMembershipProof
	onStage?.('generating-proof');
	let proofOutput: CommunityFieldProofOutput;
	try {
		proofOutput = await generateCommunityFieldProof({
			identityCommitment: ctx.identityCommitment,
			engagementTier: engagement.engagementTier,
			actionCount: engagement.actionCount,
			diversityScore: engagement.diversityScore,
			engagementPath: engagement.engagementPath,
			engagementIndex: engagement.engagementIndex,
			cellIds: paddedCellFields,
			cellCount: cellIndices.length,
			engagementRoot: engagement.engagementRoot,
			epochDomain
		});
	} catch (error) {
		onStage?.('error');
		throw error;
	}

	// Step 6: Submit to Shadow Atlas via proxy
	onStage?.('submitting');
	const proofHex =
		'0x' +
		Array.from(proofOutput.proof)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

	const submitResponse = await fetch('/api/shadow-atlas/community-field', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			proof: proofHex,
			publicInputs: proofOutput.publicInputs,
			epochDate
		})
	});

	if (!submitResponse.ok) {
		const err = await submitResponse.json().catch(() => ({ error: 'Submission failed' }));
		onStage?.('error');
		throw new Error(err.error || `Contribution submission failed: ${submitResponse.status}`);
	}

	onStage?.('complete');

	return {
		cellSetRoot: proofOutput.cellSetRoot,
		epochNullifier: proofOutput.epochNullifier,
		epochDate,
		cellCount: cellIndices.length
	};
}
