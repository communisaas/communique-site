# Agent Documentation

This directory contains documentation for Communiqué's intelligent agent system that integrates with VOTER Protocol.

## Agent Architecture

### Core Agent Documentation

- **[AGENTIC_SYSTEM_DESIGN.md](./AGENTIC_SYSTEM_DESIGN.md)** - Comprehensive agent system architecture and design principles
- **[CREDIBILITY_GOVERNANCE_DESIGN.md](./CREDIBILITY_GOVERNANCE_DESIGN.md)** - Agent-driven governance and credibility mechanisms

### Integration with VOTER Protocol

Communiqué agents integrate with VOTER Protocol smart contracts to provide:

- **On-chain Verification**: Agent decisions are anchored on-chain through VOTER contracts
- **Token Distribution**: Agents trigger VOTER token minting based on civic participation
- **Reputation Management**: Agent-calculated credibility scores are stored in VOTER's ERC-8004 registries
- **Parameter Optimization**: Agents continuously calibrate economic parameters within smart contract safety rails

### Agent Implementations

Agent implementations are located in `/src/lib/agents/`:

- `verification-agent.ts` - Template verification and correction
- `supply-agent.ts` - Token supply and reward calculations
- `market-agent.ts` - Market dynamics and incentive optimization
- `impact-agent.ts` - Civic impact measurement
- `reputation-agent.ts` - ERC-8004 portable reputation
- `moderation-consensus.ts` - Multi-agent consensus

### Workflows

N8N workflow documentation is in `/docs/workflows/` which orchestrates agent interactions and provides the coordination layer between agents and blockchain contracts.

## Philosophy

**Agent-optimized parameters replace hardcoded tyranny.**

Instead of rigid smart contract constants, intelligent agents adapt to real human behavior while operating within auditable safety rails provided by VOTER Protocol's smart contracts.

**Quality discourse pays. Bad faith costs.**
