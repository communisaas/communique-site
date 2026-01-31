/**
 * Example: ThoughtStream Decision-Maker Integration
 *
 * This file demonstrates how to use the v2 decision-maker agent
 * with ThoughtStream integration.
 *
 * Run this example in a SvelteKit endpoint or server action.
 */

import { resolveDecisionMakersV2 } from './decision-maker-v2';
import type { ThoughtSegment } from '$lib/core/thoughts/types';

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

export async function exampleBasicUsage() {
	console.log('=== Example 1: Basic Usage ===\n');

	const segments: ThoughtSegment[] = [];

	const result = await resolveDecisionMakersV2(
		{
			targetType: 'corporate',
			targetEntity: 'Apple Inc.',
			subjectLine: 'Climate leadership and sustainability',
			coreMessage: 'We urgently need action on scope 3 emissions and supply chain accountability.',
			topics: ['climate', 'sustainability', 'emissions']
		},
		(segment) => {
			segments.push(segment);
			console.log(`[${segment.type}] ${segment.content}`);
		}
	);

	console.log('\n=== Resolution Complete ===');
	console.log(`Decision-makers found: ${result.decisionMakers.length}`);
	console.log(`Total segments emitted: ${segments.length}`);
	console.log(`Latency: ${result.latencyMs}ms`);

	return { result, segments };
}

// ============================================================================
// Example 2: Filtering by Segment Type
// ============================================================================

export async function exampleFilterByType() {
	console.log('=== Example 2: Filter by Segment Type ===\n');

	const insights: ThoughtSegment[] = [];
	const recommendations: ThoughtSegment[] = [];
	const citations: ThoughtSegment[] = [];

	await resolveDecisionMakersV2(
		{
			targetType: 'congress',
			subjectLine: 'Healthcare reform legislation',
			coreMessage: 'We need universal healthcare coverage...',
			topics: ['healthcare', 'policy'],
			geographicScope: { state: 'CA' }
		},
		(segment) => {
			switch (segment.type) {
				case 'insight':
					insights.push(segment);
					console.log('💡 Insight:', segment.content);
					break;
				case 'recommendation':
					recommendations.push(segment);
					console.log('✨ Recommendation:', segment.content);
					break;
				case 'reasoning':
					if (segment.citations && segment.citations.length > 0) {
						citations.push(segment);
						console.log('📄 With citation:', segment.content);
					}
					break;
			}
		}
	);

	console.log('\n=== Summary ===');
	console.log(`Insights: ${insights.length}`);
	console.log(`Recommendations: ${recommendations.length}`);
	console.log(`Citations: ${citations.length}`);

	return { insights, recommendations, citations };
}

// ============================================================================
// Example 3: Grouping by Phase
// ============================================================================

export async function exampleGroupByPhase() {
	console.log('=== Example 3: Group by Phase ===\n');

	const segmentsByPhase: Record<string, ThoughtSegment[]> = {};

	await resolveDecisionMakersV2(
		{
			targetType: 'nonprofit',
			targetEntity: 'Sierra Club',
			subjectLine: 'Wilderness protection advocacy',
			coreMessage: 'We need to protect old-growth forests...',
			topics: ['environment', 'conservation']
		},
		(segment) => {
			if (!segmentsByPhase[segment.phase]) {
				segmentsByPhase[segment.phase] = [];
			}
			segmentsByPhase[segment.phase].push(segment);
		}
	);

	// Print organized by phase
	for (const [phase, segments] of Object.entries(segmentsByPhase)) {
		console.log(`\n--- Phase: ${phase} (${segments.length} segments) ---`);
		segments.forEach((seg) => {
			console.log(`  [${seg.type}] ${seg.content.slice(0, 80)}...`);
		});
	}

	return segmentsByPhase;
}

// ============================================================================
// Example 4: Tracking Research Actions
// ============================================================================

export async function exampleTrackResearch() {
	console.log('=== Example 4: Track Research Actions ===\n');

	const researchActions: ThoughtSegment[] = [];

	await resolveDecisionMakersV2(
		{
			targetType: 'corporate',
			targetEntity: 'Microsoft',
			subjectLine: 'AI ethics and governance',
			coreMessage: 'We need transparent AI development practices...',
			topics: ['AI', 'ethics', 'technology']
		},
		(segment) => {
			if (segment.action) {
				researchActions.push(segment);

				console.log(`\n🔍 Research Action: ${segment.action.target}`);
				console.log(`   Status: ${segment.action.status}`);

				if (segment.action.findings) {
					console.log(`   Findings: ${segment.action.findings.length}`);
					segment.action.findings.forEach((finding) => {
						console.log(`     - ${finding}`);
					});
				}

				if (segment.action.pagesVisited) {
					console.log(`   Pages visited: ${segment.action.pagesVisited.length}`);
				}

				if (segment.action.endTime && segment.action.startTime) {
					const duration = segment.action.endTime - segment.action.startTime;
					console.log(`   Duration: ${duration}ms`);
				}
			}
		}
	);

	console.log(`\n=== Total Research Actions: ${researchActions.length} ===`);

	return researchActions;
}

// ============================================================================
// Example 5: Collecting Citations
// ============================================================================

export async function exampleCollectCitations() {
	console.log('=== Example 5: Collect Citations ===\n');

	const allCitations: Array<{
		citation: any;
		context: string;
	}> = [];

	await resolveDecisionMakersV2(
		{
			targetType: 'state_legislature',
			subjectLine: 'Renewable energy mandates',
			coreMessage: 'We need 100% renewable energy by 2030...',
			topics: ['energy', 'climate', 'policy'],
			geographicScope: { state: 'CA' }
		},
		(segment) => {
			if (segment.citations) {
				segment.citations.forEach((citation) => {
					allCitations.push({
						citation,
						context: segment.content
					});

					console.log(`\n📄 Citation: ${citation.label}`);
					console.log(`   Source: ${citation.sourceType}`);
					console.log(`   URL: ${citation.url || 'N/A'}`);
					console.log(`   Excerpt: ${citation.excerpt.slice(0, 100)}...`);
					console.log(`   Context: ${segment.content.slice(0, 100)}...`);
				});
			}
		}
	);

	console.log(`\n=== Total Citations: ${allCitations.length} ===`);

	return allCitations;
}

// ============================================================================
// Example 6: Key Moments Only
// ============================================================================

export async function exampleKeyMoments() {
	console.log('=== Example 6: Key Moments Only ===\n');

	const keyMoments: ThoughtSegment[] = [];

	await resolveDecisionMakersV2(
		{
			targetType: 'local_government',
			subjectLine: 'Affordable housing policy',
			coreMessage: 'We need rent control and tenant protections...',
			topics: ['housing', 'affordability'],
			geographicScope: { city: 'San Francisco', state: 'CA' }
		},
		(segment) => {
			if (segment.pinToKeyMoments) {
				keyMoments.push(segment);
				console.log(`⭐ Key Moment [${segment.type}]: ${segment.content.slice(0, 80)}...`);
			}
		}
	);

	console.log(`\n=== Total Key Moments: ${keyMoments.length} ===`);

	// Key moments should include:
	// - Important insights
	// - Recommendations (decision-makers)
	// - Major citations
	// - Research completions

	return keyMoments;
}

// ============================================================================
// Example 7: Real-time UI Updates (Svelte)
// ============================================================================

/**
 * Example Svelte component using the v2 API
 */
export const svelteExample = `
<script lang="ts">
  import { resolveDecisionMakersV2 } from '$lib/core/agents/agents';
  import type { ThoughtSegment } from '$lib/core/thoughts/types';

  let segments: ThoughtSegment[] = [];
  let isResolving = false;
  let error: string | null = null;

  async function resolve() {
    isResolving = true;
    error = null;
    segments = [];

    try {
      const result = await resolveDecisionMakersV2(
        {
          targetType: 'corporate',
          targetEntity: 'Tesla',
          subjectLine: 'Worker safety standards',
          coreMessage: 'We need better safety protocols...',
          topics: ['labor', 'safety']
        },
        (segment) => {
          // Real-time UI update on each segment
          segments = [...segments, segment];
        }
      );

      console.log('Resolution complete:', result);
    } catch (err) {
      error = err.message;
    } finally {
      isResolving = false;
    }
  }
</script>

<button on:click={resolve} disabled={isResolving}>
  {isResolving ? 'Resolving...' : 'Find Decision-Makers'}
</button>

{#if error}
  <div class="error">{error}</div>
{/if}

<div class="thoughts">
  {#each segments as segment (segment.id)}
    <div class="thought {segment.type} {segment.emphasis}">
      {#if segment.type === 'insight'}
        💡
      {:else if segment.type === 'recommendation'}
        ✨
      {/if}

      <p>{segment.content}</p>

      {#if segment.citations}
        <div class="citations">
          {#each segment.citations as citation}
            <a href={citation.url} target="_blank">
              📄 {citation.label}
            </a>
          {/each}
        </div>
      {/if}

      {#if segment.action && segment.action.status === 'pending'}
        <div class="loading">Researching...</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .thought {
    margin: 0.5rem 0;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: var(--surface-1);
  }

  .thought.insight {
    background: var(--accent-bg);
    border-left: 3px solid var(--accent);
  }

  .thought.recommendation {
    background: var(--success-bg);
    border-left: 3px solid var(--success);
  }

  .thought.highlight {
    font-weight: 500;
  }

  .thought.muted {
    opacity: 0.6;
    font-size: 0.9rem;
  }

  .citations {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .citations a {
    color: var(--link);
    text-decoration: none;
    font-size: 0.85rem;
  }
</style>
`;

// ============================================================================
// Run All Examples (for testing)
// ============================================================================

export async function runAllExamples() {
	console.log('\n======================================');
	console.log('ThoughtStream Integration Examples');
	console.log('======================================\n');

	try {
		await exampleBasicUsage();
		console.log('\n');

		await exampleFilterByType();
		console.log('\n');

		await exampleGroupByPhase();
		console.log('\n');

		await exampleTrackResearch();
		console.log('\n');

		await exampleCollectCitations();
		console.log('\n');

		await exampleKeyMoments();
	} catch (error) {
		console.error('Example failed:', error);
		throw error;
	}
}
