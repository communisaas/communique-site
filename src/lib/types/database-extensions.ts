/**
 * Database type extensions for missing schema elements
 * 
 * These interfaces extend the Prisma schema to provide type safety
 * for properties that are referenced in code but not in the schema.
 */

// Extended User type with reputation_score alias
export interface UserWithReputation {
  id: string;
  email: string;
  name: string | null;
  trust_score: number;
  reputation_tier: string;
  // Computed/alias properties
  reputation_score: number; // Maps to trust_score
}

// Challenge type extensions
export interface ChallengeWithAddress {
  id: string;
  challenger_id: string;
  defender_id: string;
  claim_hash: string;
  stake_amount: string;
  status: string;
  // Computed properties
  challenger_address?: string; // Maps to challenger user's wallet_address
  claim?: ClaimData;
}

// Claim data structure (not in schema, but referenced in code)
export interface ClaimData {
  id?: string;
  content: string;
  creator?: UserWithReputation;
  template?: {
    id: string;
    send_count: number;
  };
}

// Challenge verification (referenced but not in schema)
export interface ChallengeVerification {
  id: string;
  challenge_id: string;
  claim_id?: string;
  factuality_score: number;
  verification_result: any;
  challenge_valid: boolean;
  required_stake: string;
  verified_at?: Date;
  created_at: Date;
  challenge?: ChallengeWithAddress;
  claim?: ClaimData;
}

// Type guard functions for safe property access
export function getUserReputation(user: any): number {
  return user?.reputation_score || user?.trust_score || 0;
}

export function getChallengerAddress(challenge: any): string | undefined {
  return challenge?.challenger_address || challenge?.challenger?.wallet_address;
}

// Factory functions for creating mock data
export function createMockClaim(overrides: Partial<ClaimData> = {}): ClaimData {
  return {
    content: 'Test claim content',
    creator: {
      id: 'user-123',
      email: 'creator@test.com',
      name: 'Test Creator',
      trust_score: 500,
      reputation_tier: 'verified',
      reputation_score: 500
    },
    template: {
      id: 'template-123',
      send_count: 100
    },
    ...overrides
  };
}

export function createMockChallenge(overrides: Partial<ChallengeWithAddress> = {}): ChallengeWithAddress {
  return {
    id: 'challenge-123',
    challenger_id: 'user-challenger',
    defender_id: 'user-defender',
    claim_hash: 'claim-hash-123',
    stake_amount: '1000000000000000000',
    status: 'active',
    challenger_address: '0x123...abc',
    ...overrides
  };
}