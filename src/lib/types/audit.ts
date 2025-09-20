/**
 * AUDIT SYSTEM TYPES - Post-Consolidation (Phase 3: 4→2 Models)
 * 
 * This file contains TypeScript interfaces for our consolidated audit system:
 * - AuditLog (unified audit trail for all user actions)
 * - CivicAction (blockchain-specific only)
 */

// === CONSOLIDATED AUDIT TYPES (Phase 3) ===

// Unified Audit Log (replaces AuditLog + CertificationLog + ReputationLog)
export interface AuditLog {
	id: string;
	user_id: string;
	
	// Core audit classification
	action_type: 'civic_action' | 'reputation_change' | 'verification' | 'authentication' | 'template_action';
	action_subtype?: string; // 'cwc_message', 'challenge_create', 'score_update', 'login', 'template_submit'
	
	// Unified audit data (flexible JSONB storage)
	audit_data: Record<string, any>; // Flexible data storage for any audit type
	
	// Agent provenance & evidence (from ReputationLog)
	agent_source?: string; // Which agent made the decision
	agent_decisions?: Record<string, any>; // AI decision trail
	evidence_hash?: string; // IPFS hash of evidence
	confidence?: number; // Agent confidence 0-1
	
	// Reputation tracking (consolidated from ReputationLog)
	score_before?: number;
	score_after?: number;
	change_amount?: number;
	change_reason?: string;
	
	// Certification tracking (for future CertificationLog functionality)
	certification_type?: string; // 'voter_protocol', 'template_approval', 'identity_verification'
	certification_data?: Record<string, any>;
	reward_amount?: string; // BigInt as string
	
	// Blockchain correlation (link to CivicAction if applicable)
	civic_action_id?: string;
	
	// Metadata & status
	status: 'pending' | 'completed' | 'failed' | 'cancelled';
	metadata?: Record<string, any>;
	
	// Timestamps
	created_at: Date;
}

// Refocused Civic Action (blockchain-specific only)
export interface CivicAction {
	id: string;
	user_id: string;
	
	// Core action identification (minimal, just for blockchain correlation)
	action_type: 'cwc_message' | 'template_submit' | 'challenge_create';
	template_id?: string;
	
	// === BLOCKCHAIN INTEGRATION ONLY ===
	tx_hash?: string; // Ethereum/Monad transaction hash
	reward_wei?: string; // BigInt as string (VOTER tokens)
	status: 'pending' | 'confirmed' | 'failed';
	
	// Blockchain proof & validation
	block_number?: number;
	confirmation_count?: number;
	gas_used?: string; // BigInt as string
	
	// Multi-agent consensus for blockchain actions
	consensus_data?: Record<string, any>; // Multi-model voting results for rewards
	
	// Timestamps
	created_at: Date;
	confirmed_at?: Date;
}

// === AUDIT QUERY TYPES ===

// For fetching user audit trail
export interface UserAuditTrail {
	user_id: string;
	audit_logs: AuditLog[];
	civic_actions: CivicAction[];
	total_count: number;
	date_range: {
		start: Date;
		end: Date;
	};
}

// For audit filtering and pagination
export interface AuditFilters {
	action_types?: ('civic_action' | 'reputation_change' | 'verification' | 'authentication' | 'template_action')[];
	date_from?: Date;
	date_to?: Date;
	user_id?: string;
	status?: ('pending' | 'completed' | 'failed' | 'cancelled')[];
	agent_source?: string;
	limit?: number;
	offset?: number;
}

// For audit analytics and reporting
export interface AuditMetrics {
	total_actions: number;
	actions_by_type: Record<string, number>;
	actions_by_status: Record<string, number>;
	reputation_changes: {
		total_changes: number;
		average_change: number;
		positive_changes: number;
		negative_changes: number;
	};
	blockchain_actions: {
		total_transactions: number;
		confirmed_transactions: number;
		total_rewards_wei: string;
		average_gas_used: string;
	};
	time_period: {
		start: Date;
		end: Date;
	};
}

