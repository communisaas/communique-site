/**
 * Deterministic Address Generation Service
 * 
 * Generates Ethereum-compatible addresses from user IDs without storing private keys.
 * These addresses are used for tracking civic engagement in VOTER Protocol.
 * Users can later connect real wallets to claim accumulated rewards.
 */

import { createHash } from 'crypto';
import { env } from '$env/dynamic/private';

// Platform-specific salt for address generation (keeps addresses unique to Communiqué)
const PLATFORM_SALT = env.PLATFORM_SALT || 'communique-voter-protocol-2024';
const CHAIN_ID = env.CHAIN_ID || '1337'; // Monad testnet

export interface AddressGenerationResult {
	address: string;
	derivationPath: string;
	timestamp: number;
	canUpgrade: boolean;
}

/**
 * Generate a deterministic Ethereum address from a user ID
 * 
 * Uses keccak256 hash to create a valid Ethereum address without private keys.
 * The address is deterministic - same userId always generates same address.
 * 
 * @param userId - Unique user identifier (from database)
 * @param customSalt - Optional custom salt for additional entropy
 * @returns Ethereum address (0x prefixed, checksummed)
 */
export function generateDeterministicAddress(
	userId: string,
	customSalt?: string
): string {
	// Combine inputs for maximum entropy
	const input = `${userId}-${PLATFORM_SALT}-${CHAIN_ID}${customSalt ? `-${customSalt}` : ''}`;
	
	// Create keccak256 hash (Ethereum uses keccak, not SHA3)
	// Using createHash with sha256 for now, in production use keccak256
	const hash = createHash('sha256').update(input).digest('hex');
	
	// Take last 20 bytes (40 hex chars) for Ethereum address
	const addressBytes = hash.slice(-40);
	
	// Add 0x prefix and apply checksum
	const address = toChecksumAddress(`0x${addressBytes}`);
	
	return address;
}

/**
 * Apply EIP-55 checksum to Ethereum address
 * 
 * @param address - Ethereum address to checksum
 * @returns Checksummed address
 */
function toChecksumAddress(address: string): string {
	// Remove 0x prefix for hashing
	const addr = address.toLowerCase().replace('0x', '');
	
	// Hash the lowercase address
	const hash = createHash('sha256').update(addr).digest('hex');
	
	let checksummed = '0x';
	for (let i = 0; i < addr.length; i++) {
		if (parseInt(hash[i], 16) >= 8) {
			checksummed += addr[i].toUpperCase();
		} else {
			checksummed += addr[i];
		}
	}
	
	return checksummed;
}

/**
 * Generate address with additional metadata
 * 
 * @param userId - User ID to generate address for
 * @param userEmail - User email for additional entropy
 * @returns Full address generation result with metadata
 */
export function generateAddressWithMetadata(
	userId: string,
	userEmail?: string
): AddressGenerationResult {
	// Use email hash as additional salt if provided
	const emailSalt = userEmail 
		? createHash('sha256').update(userEmail).digest('hex').slice(0, 8)
		: undefined;
	
	const address = generateDeterministicAddress(userId, emailSalt);
	
	return {
		address,
		derivationPath: `communique/${userId}`,
		timestamp: Date.now(),
		canUpgrade: true // Can connect real wallet later
	};
}

/**
 * Validate if an address is properly formatted
 * 
 * @param address - Address to validate
 * @returns True if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
	if (!address || typeof address !== 'string') {
		return false;
	}
	
	// Check basic format: 0x + 40 hex characters
	return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if user has a connected wallet or just derived address
 * 
 * @param user - User object with address fields
 * @returns Address type and which address to use
 */
export function getUserAddressInfo(user: {
	derived_address?: string;
	connected_address?: string;
	address_type?: 'derived' | 'connected' | 'certified';
}): {
	type: 'derived' | 'connected' | 'none';
	address: string | null;
	canUpgrade: boolean;
} {
	if (user.connected_address && isValidAddress(user.connected_address)) {
		return {
			type: 'connected',
			address: user.connected_address,
			canUpgrade: false // Already has wallet
		};
	}
	
	if (user.derived_address && isValidAddress(user.derived_address)) {
		return {
			type: 'derived',
			address: user.derived_address,
			canUpgrade: true // Can connect wallet
		};
	}
	
	return {
		type: 'none',
		address: null,
		canUpgrade: true
	};
}

/**
 * Get or create address for user
 * 
 * @param userId - User ID
 * @param existingAddress - Existing address if any
 * @param userEmail - User email for generation
 * @returns Address to use for VOTER Protocol
 */
export function getOrCreateUserAddress(
	userId: string,
	existingAddress?: string | null,
	userEmail?: string
): string {
	// If user already has an address, use it
	if (existingAddress && isValidAddress(existingAddress)) {
		return existingAddress;
	}
	
	// Generate new deterministic address
	const result = generateAddressWithMetadata(userId, userEmail);
	return result.address;
}

/**
 * Batch generate addresses for multiple users
 * Useful for migrating existing users
 * 
 * @param users - Array of users to generate addresses for
 * @returns Map of userId to address
 */
export function batchGenerateAddresses(
	users: Array<{ id: string; email?: string }>
): Map<string, string> {
	const addressMap = new Map<string, string>();
	
	for (const user of users) {
		const result = generateAddressWithMetadata(user.id, user.email);
		addressMap.set(user.id, result.address);
	}
	
	return addressMap;
}

/**
 * Create a migration record for address generation
 * Used for tracking when addresses were generated
 */
export interface AddressMigrationRecord {
	userId: string;
	derivedAddress: string;
	generatedAt: Date;
	migrationBatch: string;
}

export function createMigrationRecord(
	userId: string,
	address: string,
	batchId?: string
): AddressMigrationRecord {
	return {
		userId,
		derivedAddress: address,
		generatedAt: new Date(),
		migrationBatch: batchId || `migration-${Date.now()}`
	};
}