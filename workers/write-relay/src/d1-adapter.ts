/**
 * D1 Storage Adapter for Write Relay
 *
 * Implements the RelayStorageAdapter interface against Cloudflare D1 (SQLite).
 * Owns registration leaves, idempotency cache, and engagement identities.
 */

// --------------------------------------------------------------------------
// Types (mirror substrate's RelayStorageAdapter interface)
// --------------------------------------------------------------------------

export interface IdempotencyResult {
	key: string;
	result: string; // JSON-serialized response
	expiresAt: string; // ISO datetime
}

export interface EngagementIdentity {
	identityCommitment: string;
	signerAddress: string;
	leafIndex: number;
	tier: number;
	actionCount: number;
	diversityScore: number;
	tenureMonths: number;
}

export interface EngagementBreakdown {
	tier: number;
	actionCount: number;
	diversityScore: number;
	tenureMonths: number;
	tierBoundaries: Array<{ tier: number; label: string; minScore: number }>;
}

// Tier boundaries — same as substrate's tier-calculator.ts
const TIER_BOUNDARIES = [
	{ tier: 0, label: 'Observer', minScore: 0 },
	{ tier: 1, label: 'Participant', minScore: 10 },
	{ tier: 2, label: 'Contributor', minScore: 50 },
	{ tier: 3, label: 'Steward', minScore: 200 },
	{ tier: 4, label: 'Guardian', minScore: 500 },
];

// --------------------------------------------------------------------------
// D1 Adapter
// --------------------------------------------------------------------------

export class D1Adapter {
	constructor(private db: D1Database) {}

	// -- Registration (Tree 1) --

	async findLeaf(leaf: string): Promise<{ leafIndex: number; replacedBy: number | null } | null> {
		const row = await this.db
			.prepare('SELECT leaf_index, replaced_by FROM registration_leaves WHERE leaf = ? AND replaced_by IS NULL')
			.bind(leaf)
			.first<{ leaf_index: number; replaced_by: number | null }>();
		if (!row) return null;
		return { leafIndex: row.leaf_index, replacedBy: row.replaced_by };
	}

	async getTreeSize(): Promise<number> {
		const row = await this.db
			.prepare("SELECT value FROM tree_metadata WHERE key = 'tree_size'")
			.first<{ value: string }>();
		return row ? parseInt(row.value, 10) : 0;
	}

	async getTreeCapacity(): Promise<number> {
		const row = await this.db
			.prepare("SELECT value FROM tree_metadata WHERE key = 'tree_capacity'")
			.first<{ value: string }>();
		return row ? parseInt(row.value, 10) : 1048576;
	}

	async insertLeaf(leaf: string, index: number, attestationHash?: string): Promise<void> {
		await this.db.batch([
			this.db
				.prepare('INSERT INTO registration_leaves (leaf_index, leaf, attestation_hash) VALUES (?, ?, ?)')
				.bind(index, leaf, attestationHash ?? null),
			this.db
				.prepare("UPDATE tree_metadata SET value = ? WHERE key = 'tree_size'")
				.bind(String(index + 1)),
			this.db
				.prepare('INSERT INTO insertion_log (operation, leaf_index, leaf) VALUES (?, ?, ?)')
				.bind('insert', index, leaf),
		]);
	}

	async replaceLeaf(newLeaf: string, oldIndex: number, newIndex: number): Promise<void> {
		await this.db.batch([
			this.db
				.prepare('UPDATE registration_leaves SET replaced_by = ? WHERE leaf_index = ?')
				.bind(newIndex, oldIndex),
			this.db
				.prepare('INSERT INTO registration_leaves (leaf_index, leaf) VALUES (?, ?)')
				.bind(newIndex, newLeaf),
			this.db
				.prepare("UPDATE tree_metadata SET value = ? WHERE key = 'tree_size'")
				.bind(String(newIndex + 1)),
			this.db
				.prepare('INSERT INTO insertion_log (operation, leaf_index, leaf) VALUES (?, ?, ?)')
				.bind('replace', newIndex, newLeaf),
		]);
	}

	async getLeafAt(index: number): Promise<string | null> {
		const row = await this.db
			.prepare('SELECT leaf FROM registration_leaves WHERE leaf_index = ?')
			.bind(index)
			.first<{ leaf: string }>();
		return row?.leaf ?? null;
	}

	// -- Idempotency --

	async getIdempotencyResult(key: string): Promise<string | null> {
		const now = new Date().toISOString();
		const row = await this.db
			.prepare('SELECT result FROM idempotency_cache WHERE key = ? AND expires_at > ?')
			.bind(key, now)
			.first<{ result: string }>();
		return row?.result ?? null;
	}

	async setIdempotencyResult(key: string, result: string, ttlMs: number): Promise<void> {
		const expiresAt = new Date(Date.now() + ttlMs).toISOString();
		await this.db
			.prepare('INSERT OR REPLACE INTO idempotency_cache (key, result, expires_at) VALUES (?, ?, ?)')
			.bind(key, result, expiresAt)
			.run();
	}

	async cleanExpiredIdempotency(): Promise<number> {
		const now = new Date().toISOString();
		const result = await this.db
			.prepare('DELETE FROM idempotency_cache WHERE expires_at <= ?')
			.bind(now)
			.run();
		return result.meta.changes ?? 0;
	}

	// -- Engagement (Tree 3) --

	async isIdentityRegistered(identityCommitment: string): Promise<boolean> {
		const row = await this.db
			.prepare('SELECT 1 FROM engagement_identities WHERE identity_commitment = ?')
			.bind(identityCommitment)
			.first();
		return row !== null;
	}

	async isSignerRegistered(signerAddress: string): Promise<boolean> {
		const row = await this.db
			.prepare('SELECT 1 FROM engagement_identities WHERE signer_address = ?')
			.bind(signerAddress)
			.first();
		return row !== null;
	}

	async registerEngagementIdentity(
		identityCommitment: string,
		signerAddress: string,
		leafIndex: number,
	): Promise<void> {
		await this.db
			.prepare(
				'INSERT INTO engagement_identities (identity_commitment, signer_address, leaf_index) VALUES (?, ?, ?)',
			)
			.bind(identityCommitment, signerAddress, leafIndex)
			.run();
	}

	async getEngagementMetrics(identityCommitment: string): Promise<EngagementIdentity | null> {
		const row = await this.db
			.prepare(
				'SELECT identity_commitment, signer_address, leaf_index, tier, action_count, diversity_score, tenure_months FROM engagement_identities WHERE identity_commitment = ?',
			)
			.bind(identityCommitment)
			.first<{
				identity_commitment: string;
				signer_address: string;
				leaf_index: number;
				tier: number;
				action_count: number;
				diversity_score: number;
				tenure_months: number;
			}>();
		if (!row) return null;
		return {
			identityCommitment: row.identity_commitment,
			signerAddress: row.signer_address,
			leafIndex: row.leaf_index,
			tier: row.tier,
			actionCount: row.action_count,
			diversityScore: row.diversity_score,
			tenureMonths: row.tenure_months,
		};
	}

	async getEngagementMetricsBySigner(signerAddress: string): Promise<EngagementIdentity | null> {
		const row = await this.db
			.prepare(
				'SELECT identity_commitment, signer_address, leaf_index, tier, action_count, diversity_score, tenure_months FROM engagement_identities WHERE signer_address = ?',
			)
			.bind(signerAddress)
			.first<{
				identity_commitment: string;
				signer_address: string;
				leaf_index: number;
				tier: number;
				action_count: number;
				diversity_score: number;
				tenure_months: number;
			}>();
		if (!row) return null;
		return {
			identityCommitment: row.identity_commitment,
			signerAddress: row.signer_address,
			leafIndex: row.leaf_index,
			tier: row.tier,
			actionCount: row.action_count,
			diversityScore: row.diversity_score,
			tenureMonths: row.tenure_months,
		};
	}

	async getEngagementBreakdown(identityCommitment: string): Promise<EngagementBreakdown | null> {
		const metrics = await this.getEngagementMetrics(identityCommitment);
		if (!metrics) return null;
		return {
			tier: metrics.tier,
			actionCount: metrics.actionCount,
			diversityScore: metrics.diversityScore,
			tenureMonths: metrics.tenureMonths,
			tierBoundaries: TIER_BOUNDARIES,
		};
	}

	// -- Community Field --

	async findContribution(
		epochDate: string,
		epochNullifier: string,
	): Promise<{ id: number } | null> {
		const row = await this.db
			.prepare('SELECT id FROM cf_contributions WHERE epoch_date = ? AND epoch_nullifier = ?')
			.bind(epochDate, epochNullifier)
			.first<{ id: number }>();
		return row ?? null;
	}

	async insertContribution(
		epochDate: string,
		epochNullifier: string,
		cellTreeRoot: string,
		proofHash: string,
	): Promise<void> {
		await this.db
			.prepare(
				'INSERT INTO cf_contributions (epoch_date, epoch_nullifier, cell_tree_root, proof_hash) VALUES (?, ?, ?, ?)',
			)
			.bind(epochDate, epochNullifier, cellTreeRoot, proofHash)
			.run();
	}

	async getEpochContributions(
		epochDate: string,
	): Promise<{ count: number; cellRoots: string[] }> {
		const rows = await this.db
			.prepare('SELECT cell_tree_root FROM cf_contributions WHERE epoch_date = ?')
			.bind(epochDate)
			.all<{ cell_tree_root: string }>();
		return {
			count: rows.results.length,
			cellRoots: rows.results.map((r) => r.cell_tree_root),
		};
	}
}
