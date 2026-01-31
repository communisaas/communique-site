/**
 * ThoughtEmitter Usage Examples
 *
 * Demonstrates how agents use ThoughtEmitter to emit structured thoughts
 * instead of raw text streams.
 *
 * @module thoughts/example
 */

import { ThoughtEmitter } from './emitter';
import type { ThoughtSegment } from './types';

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

/**
 * Simple thought emission with phases and insights
 */
export function basicExample() {
	// Create emitter with callback
	const segments: ThoughtSegment[] = [];
	const emitter = new ThoughtEmitter((segment) => {
		segments.push(segment);
		console.log(`[${segment.type}] ${segment.content}`);
	});

	// Phase 1: Understanding
	emitter.startPhase('understanding');
	emitter.think('Analyzing your message about corporate sustainability...');
	emitter.think('Target: Apple Inc. (Fortune 500, Technology sector)');

	// Phase 2: Research
	emitter.startPhase('research');
	const research = emitter.startResearch('Apple Inc.', 'corporate');
	research.addFinding('Lisa Jackson leads Environmental Policy and Social Initiatives');
	research.addFinding('Reports directly to CEO Tim Cook');
	research.addFinding('Apple committed to carbon neutrality by 2030');
	research.complete('Found key sustainability leadership and commitments');

	// Phase 3: Insights
	emitter.startPhase('context');
	emitter.insight('Lisa Jackson is the right decision-maker for sustainability issues.');

	// Complete
	emitter.completePhase();

	return { segments, keyMoments: emitter.getKeyMoments(), phases: emitter.getPhases() };
}

// ============================================================================
// Example 2: With Citations
// ============================================================================

/**
 * Thoughts with inline citations and progressive disclosure
 */
export function citationExample() {
	const segments: ThoughtSegment[] = [];
	const emitter = new ThoughtEmitter((segment) => {
		segments.push(segment);
	});

	emitter.startPhase('context');

	// Create a citation
	const citation = emitter.cite("Apple's 2025 Environmental Report", {
		url: 'https://www.apple.com/environment/pdf/Apple_Environmental_Progress_Report_2025.pdf',
		excerpt:
			'Apple is committed to becoming carbon neutral across our entire business, manufacturing supply chain, and product life cycle by 2030.',
		mongoId: '507f1f77bcf86cd799439011'
	});

	// Use citation in thought
	emitter.think(
		'According to their latest environmental report, Apple has committed to carbon neutrality by 2030.',
		{
			citations: [citation],
			emphasis: 'highlight'
		}
	);

	emitter.insight('This commitment includes Scope 3 emissions, which is more ambitious than most tech companies.', {
		citations: [citation],
		pin: true
	});

	return { segments, keyMoments: emitter.getKeyMoments() };
}

// ============================================================================
// Example 3: Research with Retrieval
// ============================================================================

/**
 * Combined research and retrieval actions
 */
export function researchRetrievalExample() {
	const segments: ThoughtSegment[] = [];
	const emitter = new ThoughtEmitter((segment) => {
		segments.push(segment);
	});

	// Phase 1: Context retrieval
	emitter.startPhase('context');
	const retrieval = emitter.startRetrieval('climate policy corporate sustainability');
	retrieval.addFinding('Found 15 relevant intelligence items from past 30 days');
	retrieval.complete('Retrieved recent context on corporate climate commitments');

	// Phase 2: Research
	emitter.startPhase('research');
	const research = emitter.startResearch('Apple Inc. Environmental Policy', 'corporate');
	research.addPage?.('https://www.apple.com/environment/', 'Apple Environmental', true);
	research.addPage?.('https://www.apple.com/leadership/', 'Apple Leadership', true);
	research.addFinding('Lisa Jackson - VP Environmental Policy, Social Initiatives');
	research.addFinding('2025 Report shows Scope 3 emissions increased 12%');
	research.complete('Identified environmental leadership and recent performance data');

	// Phase 3: Synthesis
	emitter.startPhase('synthesis');
	emitter.recommend(
		'Contact Lisa Jackson at Apple Inc. regarding their increased Scope 3 emissions and commitment timelines.',
		{
			icon: '🎯'
		}
	);

	return {
		segments,
		keyMoments: emitter.getKeyMoments(),
		phases: emitter.getPhases()
	};
}

// ============================================================================
// Example 4: Error Handling
// ============================================================================

/**
 * Handling failed actions gracefully
 */
export function errorHandlingExample() {
	const segments: ThoughtSegment[] = [];
	const emitter = new ThoughtEmitter((segment) => {
		segments.push(segment);
	});

	emitter.startPhase('research');

	const research = emitter.startResearch('Unknown Corporation XYZ', 'corporate');

	// Simulate research failure
	research.error('Could not find organization "Unknown Corporation XYZ". Please verify the name.');

	// Continue with alternative approach
	emitter.think(
		'Unable to research this organization directly. Recommending manual verification.',
		{
			emphasis: 'muted'
		}
	);

	return { segments, keyMoments: emitter.getKeyMoments() };
}

// ============================================================================
// Example 5: Full Decision-Maker Resolution Flow
// ============================================================================

/**
 * Complete flow for decision-maker resolution with all features
 */
export function fullResolutionFlow(
	userMessage: string,
	targetEntity: string,
	targetType: 'corporate' | 'nonprofit'
) {
	const segments: ThoughtSegment[] = [];
	const emitter = new ThoughtEmitter((segment) => {
		segments.push(segment);
	});

	// Phase 1: Understanding
	emitter.startPhase('understanding');
	emitter.think(`Understanding your message about: ${userMessage}`);
	emitter.think(`Target organization: ${targetEntity} (${targetType})`);

	// Phase 2: Context retrieval
	emitter.startPhase('context');
	const retrieval = emitter.startRetrieval(`${targetEntity} ${userMessage}`);
	retrieval.addFinding('Found 8 relevant news items');
	retrieval.addFinding('Found 3 recent announcements');
	retrieval.complete('Retrieved relevant context for message framing');

	// Create citations from context
	const citation1 = emitter.cite(`${targetEntity} Q4 2025 Announcement`, {
		url: `https://${targetEntity.toLowerCase().replace(/\s+/g, '')}.com/news`,
		excerpt: 'Recent announcement relevant to your message...',
		mongoId: '507f1f77bcf86cd799439012'
	});

	emitter.think(`${targetEntity} recently announced initiatives aligned with your message.`, {
		citations: [citation1],
		emphasis: 'highlight'
	});

	// Phase 3: Research decision-maker
	emitter.startPhase('research');
	const research = emitter.startResearch(`${targetEntity} leadership`, targetType);
	research.addPage?.(`https://${targetEntity.toLowerCase().replace(/\s+/g, '')}.com/leadership`, 'Leadership Page', true);
	research.addFinding('Jane Smith - VP of Sustainability');
	research.addFinding('Reports to Chief Operations Officer');
	research.addFinding('Oversees ESG initiatives and stakeholder engagement');
	research.complete('Identified optimal decision-maker for sustainability issues');

	// Phase 4: Recommendation
	emitter.startPhase('recommendation');
	emitter.insight('Jane Smith is the right contact - she oversees sustainability and stakeholder engagement.', {
		pin: true,
		icon: '💡'
	});

	emitter.recommend(`Send your message to Jane Smith, VP of Sustainability at ${targetEntity}.`, {
		icon: '✉️'
	});

	// Complete
	emitter.completePhase();

	return {
		segments,
		keyMoments: emitter.getKeyMoments(),
		phases: emitter.getPhases()
	};
}

// ============================================================================
// Run Examples (for testing)
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
	console.log('\n=== Basic Example ===\n');
	const basic = basicExample();
	console.log(`\nEmitted ${basic.segments.length} segments`);
	console.log(`Captured ${basic.keyMoments.length} key moments`);
	console.log(`Progressed through ${basic.phases.length} phases`);

	console.log('\n=== Citation Example ===\n');
	const citations = citationExample();
	console.log(`\nKey moments: ${citations.keyMoments.map((m) => m.label).join(', ')}`);

	console.log('\n=== Research + Retrieval Example ===\n');
	const research = researchRetrievalExample();
	console.log(`\nPhases: ${research.phases.map((p) => p.name).join(' → ')}`);

	console.log('\n=== Error Handling Example ===\n');
	errorHandlingExample();

	console.log('\n=== Full Resolution Flow ===\n');
	const full = fullResolutionFlow(
		'We need stronger climate commitments',
		'Apple Inc.',
		'corporate'
	);
	console.log(`\nComplete flow:`);
	console.log(`  ${full.segments.length} thought segments`);
	console.log(`  ${full.keyMoments.length} key moments`);
	console.log(`  ${full.phases.length} phases`);
}
