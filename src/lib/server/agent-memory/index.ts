/**
 * Agent Memory / RAG Service
 *
 * Provides contextual intelligence retrieval for agent reasoning.
 *
 * @module agent-memory
 */

export { AgentMemoryService } from './service';

export type {
	RetrieveContextParams,
	OrganizationContext,
	IntelligenceItem,
	AgentContext,
	SearchOptions
} from './service';
