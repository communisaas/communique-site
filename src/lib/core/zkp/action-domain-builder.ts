/**
 * Action Domain Builder - Deterministic action domain computation
 *
 * Constructs action domains for ZK proof nullifier binding. The action domain
 * uniquely identifies a (protocol, country, jurisdiction, recipient, template, session)
 * tuple so that each user can only submit one proof per action domain.
 *
 * HASHING SCHEME:
 * keccak256(abi.encodePacked(protocol, country, jurisdictionType, recipientSubdivision, templateId, sessionId))
 * → reduced mod BN254_MODULUS for circuit compatibility
 *
 * WHY KECCAK256 (not Poseidon2):
 * Action domains are managed on-chain via DistrictGate.allowedActionDomains mapping.
 * Governance admins whitelist domains using Solidity tooling (keccak256 is native).
 * Poseidon2 is used circuit-internal; keccak256 is the EVM-standard for domain hashing.
 *
 * WHY RECIPIENT SUBDIVISION:
 * Without recipient granularity, a single nullifier covers an entire jurisdiction type.
 * A user proving for "US + federal" could only message ONE federal representative total.
 * With recipientSubdivision, they can message their senator (US-CA) AND representative
 * (US-CA-12) independently — correct civics, correct cryptography.
 *
 * SECURITY INVARIANTS:
 * 1. Output is always a valid BN254 field element (< modulus)
 * 2. Deterministic: same params always produce the same domain
 * 3. Collision-resistant: keccak256 preimage resistance
 * 4. Protocol-versioned: schema changes require version bump
 *
 * @see COORDINATION-INTEGRITY-SPEC.md § Action Domain Schema
 * @see DistrictGate.sol § allowedActionDomains mapping
 */

import { solidityPackedKeccak256 } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BN254_MODULUS =
	21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const PROTOCOL_VERSION = 'communique.v1';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Jurisdiction types supported by the action domain schema.
 *
 * - federal: National legislature (US Congress, UK Parliament)
 * - state: Subnational legislature (US state legislature, German Landtag)
 * - local: Municipal/county government (city council, county board)
 * - international: International bodies (EU Parliament, UN committees)
 */
export type JurisdictionType = 'federal' | 'state' | 'local' | 'international';

/**
 * Parameters for constructing an action domain.
 *
 * Each unique combination of these fields produces a distinct action domain,
 * which in turn produces a distinct nullifier per user. This means a user
 * can submit proofs for multiple templates, sessions, and recipients
 * without nullifier collisions.
 */
export interface ActionDomainParams {
	/** ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE") */
	country: string;

	/** Type of jurisdiction being addressed */
	jurisdictionType: JurisdictionType;

	/**
	 * Recipient subdivision for nullifier granularity.
	 * - Federal/national scope: "national"
	 * - State scope: ISO 3166-2 code (e.g., "US-CA", "DE-BY")
	 * - Local scope: "{state}-{locality}" (e.g., "US-CA-san-francisco")
	 * - International: organization code (e.g., "EU", "UN")
	 */
	recipientSubdivision: string;

	/** Template identifier from the template registry */
	templateId: string;

	/** Legislative session or campaign identifier */
	sessionId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

const VALID_JURISDICTION_TYPES: ReadonlySet<string> = new Set([
	'federal',
	'state',
	'local',
	'international'
]);

/**
 * Validate action domain parameters.
 * @throws Error if any parameter is missing or invalid
 */
function validateParams(params: ActionDomainParams): void {
	if (!params.country || typeof params.country !== 'string') {
		throw new Error('country is required (ISO 3166-1 alpha-2)');
	}
	if (params.country.length !== 2) {
		throw new Error(`country must be 2-character ISO code, got "${params.country}"`);
	}
	if (!VALID_JURISDICTION_TYPES.has(params.jurisdictionType)) {
		throw new Error(
			`jurisdictionType must be one of: ${[...VALID_JURISDICTION_TYPES].join(', ')}; got "${params.jurisdictionType}"`
		);
	}
	if (!params.recipientSubdivision || typeof params.recipientSubdivision !== 'string') {
		throw new Error('recipientSubdivision is required');
	}
	if (!params.templateId || typeof params.templateId !== 'string') {
		throw new Error('templateId is required');
	}
	if (!params.sessionId || typeof params.sessionId !== 'string') {
		throw new Error('sessionId is required');
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a deterministic action domain from structured parameters.
 *
 * Computes keccak256(abi.encodePacked(fields)) and reduces modulo BN254
 * to produce a valid field element for the ZK circuit.
 *
 * @param params - Action domain parameters
 * @returns Hex string field element (0x-prefixed, 64 chars)
 * @throws Error if parameters are invalid
 *
 * @example
 * ```typescript
 * const domain = buildActionDomain({
 *   country: 'US',
 *   jurisdictionType: 'federal',
 *   recipientSubdivision: 'US-CA',
 *   templateId: 'climate-action-2026',
 *   sessionId: '119th-congress'
 * });
 * // domain: "0x1a2b3c..." (64-char hex field element)
 * ```
 */
export function buildActionDomain(params: ActionDomainParams): string {
	validateParams(params);

	// keccak256(abi.encodePacked(protocol, country, jurisdictionType, recipientSubdivision, templateId, sessionId))
	const hash = solidityPackedKeccak256(
		['string', 'string', 'string', 'string', 'string', 'string'],
		[
			PROTOCOL_VERSION,
			params.country,
			params.jurisdictionType,
			params.recipientSubdivision,
			params.templateId,
			params.sessionId
		]
	);

	// Reduce to BN254 field element for circuit compatibility
	const fieldElement = BigInt(hash) % BN254_MODULUS;
	return '0x' + fieldElement.toString(16).padStart(64, '0');
}

/**
 * Validate that a hex string is a valid BN254 field element.
 * Useful for validating action domains received from external sources.
 *
 * @param hex - Hex string (0x-prefixed or raw)
 * @returns true if valid field element
 */
export function isValidActionDomain(hex: string): boolean {
	try {
		const normalized = hex.startsWith('0x') ? hex : '0x' + hex;
		const value = BigInt(normalized);
		return value >= 0n && value < BN254_MODULUS;
	} catch {
		return false;
	}
}
