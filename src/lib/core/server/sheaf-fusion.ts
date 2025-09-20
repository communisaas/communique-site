import { db } from '$lib/core/db';

/**
 * SHEAF DATA FUSION ENGINE - Distributed Information Consistency
 *
 * Prototype, sheaf-inspired consistency over overlaps. This is a pragmatic
 * proxy for Čech-style reasoning, not a full cohomology implementation.
 * Used to detect cross-region agreement and conflicts with transparent
 * heuristics suitable for production.
 */

export interface InformationSource {
	source_id: string;
	content: string;
	category: string;
	geographic_region: string; // state-district
	confidence: number;
	timestamp: Date;
	community_context: string[];
}

export interface SheafSection {
	region: string;
	local_data: {
		content?: string;
		category?: string;
		source_id?: string;
		sentiment?: 'pro' | 'anti' | 'neutral';
		community_context?: string[];
		global_consensus?: boolean;
		supporting_regions?: number;
	};
	confidence: number;
	consistency_check: boolean;
}

export interface CohomologyResult {
	H0: SheafSection[]; // Global consistent sections
	H1: unknown[]; // Obstructions to consistency
	H2: unknown[]; // Higher-order conflicts
	fusion_quality: number; // 0-1 quality score
	confidence_bound: number; // Mathematical lower bound on result quality
}

// Tunable heuristic weight for penalizing conflicts when computing the
// confidence bound. This is intentionally simple and transparent.
export const SHEAF_CONFLICT_PENALTY_WEIGHT = Number(
	process.env.SHEAF_CONFLICT_PENALTY_WEIGHT ?? '0.1'
);

/**
 * Get overlapping information sources from our template/campaign system
 */
export async function getOverlappingInformationSources(
	category: string,
	timeWindowDays: number = 7
): Promise<InformationSource[]> {
	const cutoffDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);

	const templates = await db.template.findMany({
		where: {
			category: category,
			createdAt: { gte: cutoffDate }
		},
		include: {
			user: {
				select: {
					id: true,
					state: true,
					congressional_district: true,
					community_sheaves: true,
					political_embedding: true
				}
			},
			template_campaign: {
				where: {
					status: { in: ['delivered', 'confirmed'] }
				},
				select: {
					status: true,
					created_at: true
				}
			}
		}
	});

	return templates.map((template) => {
		const user = template.user;
		const region = `${user?.state || 'unknown'}-${user?.congressional_district || 'unknown'}`;

		// Extract community context from sheaves
		const sheaves = user?.community_sheaves as Record<string, unknown> | null;
		const communityContext =
			(sheaves?.memberships as Array<{ community_id: string }> | undefined)?.map(
				(m) => m.community_id
			) || [];

		// Calculate confidence from campaign success rate
		const campaigns = (template as any).template_campaign;
		const totalCampaigns = campaigns?.length || 0;
		const confidence = totalCampaigns > 0 ? 1.0 : 0.5; // Basic confidence model

		return {
			source_id: template.id,
			content: template.message_body || template.description || '',
			category: template.category,
			geographic_region: region,
			confidence,
			timestamp: template.createdAt,
			community_context: communityContext
		};
	});
}

/**
 * Build sheaf structure from information sources
 */
export function buildSheafStructure(sources: InformationSource[]): Map<string, SheafSection[]> {
	const sheaf = new Map<string, SheafSection[]>();

	// Group sources by overlapping regions
	const regionGroups = new Map<string, InformationSource[]>();

	sources.forEach((source) => {
		const region = source.geographic_region;
		if (!regionGroups.has(region)) {
			regionGroups.set(region, []);
		}
		regionGroups.get(region)!.push(source);
	});

	// Create sheaf sections for each region
	regionGroups.forEach((regionSources, region) => {
		const sections: SheafSection[] = regionSources.map((source) => {
			// Check local consistency (sources in same region should agree)
			const otherSources = regionSources.filter((s) => s.source_id !== source.source_id);
			const consistency = checkLocalConsistency(source, otherSources);

			return {
				region,
				local_data: {
					content: source.content,
					category: source.category,
					source_id: source.source_id,
					sentiment: analyzeSentiment(source.content),
					community_context: source.community_context
				},
				confidence: source.confidence,
				consistency_check: consistency
			};
		});

		sheaf.set(region, sections);
	});

	return sheaf;
}

/**
 * Simple sentiment analysis for consistency checking
 */
function analyzeSentiment(content: string): 'pro' | 'anti' | 'neutral' {
	const lowerContent = content.toLowerCase();
	const proWords = ['support', 'approve', 'yes', 'help', 'benefit'];
	const antiWords = ['oppose', 'against', 'no', 'reject', 'harm'];

	const proCount = proWords.filter((word) => lowerContent.includes(word)).length;
	const antiCount = antiWords.filter((word) => lowerContent.includes(word)).length;

	if (proCount > antiCount) return 'pro';
	if (antiCount > proCount) return 'anti';
	return 'neutral';
}

/**
 * Check consistency between information sources in same region
 */
function checkLocalConsistency(
	source: InformationSource,
	otherSources: InformationSource[]
): boolean {
	if (otherSources.length === 0) return true;

	const sourceSentiment = analyzeSentiment(source.content);

	// Check if majority of other sources agree on sentiment
	const otherSentiments = otherSources.map((s) => analyzeSentiment(s.content));
	const agreementCount = otherSentiments.filter((s) => s === sourceSentiment).length;

	return agreementCount >= otherSentiments.length * 0.5; // 50% agreement threshold
}

/**
 * Estimate sheaf-style consistency using a Čech-inspired proxy.
 *
 * Notes:
 * - H0 is treated as globally consistent sections that match on
 *   sentiment and category across all regions.
 * - H1 is a list of pairwise conflicts by category across regions.
 * - H2 is not computed in this proxy.
 */
export function estimateSheafConsistencyCechProxy(
	sheaf: Map<string, SheafSection[]>
): CohomologyResult {
	const regions = Array.from(sheaf.keys());

	// H^0: Global sections (consistent across all regions)
	const H0: SheafSection[] = [];

	if (regions.length === 0) {
		return {
			H0: [],
			H1: [],
			H2: [],
			fusion_quality: 0,
			confidence_bound: 0
		};
	}

	// Find globally consistent information
	const firstRegionSections = sheaf.get(regions[0]) || [];

	firstRegionSections.forEach((section) => {
		const localData = section.local_data as any;
		const sentiment = localData?.sentiment;
		const category = localData?.category;

		// Check if this sentiment/category is consistent across all regions
		let isGloballyConsistent = true;
		let totalConfidence = section.confidence;
		let regionCount = 1;

		for (let i = 1; i < regions.length; i++) {
			const otherRegionSections = sheaf.get(regions[i]) || [];
			const matchingSections = otherRegionSections.filter((s) => {
				const sLocalData = s.local_data as any;
				return sLocalData?.sentiment === sentiment && sLocalData?.category === category;
			});

			if (matchingSections.length === 0) {
				isGloballyConsistent = false;
				break;
			}

			// Add to confidence calculation
			const bestMatch = matchingSections.reduce((best, current) =>
				current.confidence > best.confidence ? current : best
			);
			totalConfidence += bestMatch.confidence;
			regionCount++;
		}

		if (isGloballyConsistent) {
			H0.push({
				region: 'global',
				local_data: {
					...(section.local_data as any),
					global_consensus: true,
					supporting_regions: regions.length
				},
				confidence: totalConfidence / regionCount,
				consistency_check: true
			});
		}
	});

	// H^1: Obstructions (conflicts between regions)
	const H1: unknown[] = [];

	// Find pairs of regions with conflicting information
	for (let i = 0; i < regions.length; i++) {
		for (let j = i + 1; j < regions.length; j++) {
			const region1 = regions[i];
			const region2 = regions[j];
			const sections1 = sheaf.get(region1) || [];
			const sections2 = sheaf.get(region2) || [];

			// Check for sentiment conflicts on same category
			sections1.forEach((s1) => {
				sections2.forEach((s2) => {
					const s1Data = s1.local_data as any;
					const s2Data = s2.local_data as any;
					if (s1Data.category === s2Data.category && s1Data.sentiment !== s2Data.sentiment) {
						H1.push({
							type: 'sentiment_conflict',
							region1,
							region2,
							category: s1Data.category,
							sentiment1: s1Data.sentiment,
							sentiment2: s2Data.sentiment,
							confidence1: s1.confidence,
							confidence2: s2.confidence
						});
					}
				});
			});
		}
	}

	// H^2: Higher-order conflicts (leave empty for now)
	const H2: unknown[] = [];

	// Calculate fusion quality
	const totalSections = Array.from(sheaf.values()).reduce(
		(sum, sections) => sum + sections.length,
		0
	);
	const consistentSections = H0.length;
	const fusionQuality = totalSections > 0 ? consistentSections / totalSections : 0;

	// Confidence bound (theoretical lower bound on result quality)
	const avgConfidence =
		H0.reduce((sum, section) => sum + section.confidence, 0) / Math.max(H0.length, 1);
	const conflictPenalty = H1.length * SHEAF_CONFLICT_PENALTY_WEIGHT; // Heuristic penalty per conflict
	const confidenceBound = Math.max(0, avgConfidence - conflictPenalty);

	return {
		H0,
		H1,
		H2,
		fusion_quality: fusionQuality,
		confidence_bound: confidenceBound
	};
}

/**
 * Fuse information sources using sheaf theory
 */
export async function fuseInformationSources(
	category: string,
	timeWindowDays: number = 7
): Promise<{
	success: boolean;
	global_consensus: SheafSection[];
	conflicts: unknown[];
	quality_metrics: {
		fusion_quality: number;
		confidence_bound: number;
		total_sources: number;
		consistent_sources: number;
	};
}> {
	// Get overlapping information sources
	const sources = await getOverlappingInformationSources(category, timeWindowDays);

	if (sources.length === 0) {
		return {
			success: false,
			global_consensus: [],
			conflicts: [],
			quality_metrics: {
				fusion_quality: 0,
				confidence_bound: 0,
				total_sources: 0,
				consistent_sources: 0
			}
		};
	}

	// Build sheaf structure
	const sheaf = buildSheafStructure(sources);

	// Calculate proxy cohomology/consistency
	const cohomology = estimateSheafConsistencyCechProxy(sheaf);

	return {
		success: true,
		global_consensus: cohomology.H0,
		conflicts: cohomology.H1,
		quality_metrics: {
			fusion_quality: cohomology.fusion_quality,
			confidence_bound: cohomology.confidence_bound,
			total_sources: sources.length,
			consistent_sources: cohomology.H0.length
		}
	};
}

/**
 * Store fusion results in political_uncertainty table
 */
export async function storeFusionResults(
	category: string,
	fusionResult: {
		global_consensus: SheafSection[];
		conflicts: unknown[];
		quality_metrics: {
			fusion_quality: number;
			confidence_bound: number;
			total_sources: number;
			consistent_sources: number;
		};
	}
): Promise<void> {
	try {
		// Calculate position variance from conflicts
		const positionVariance = fusionResult.conflicts.length * 0.1;

		// Calculate entropy from global consensus diversity
		const consensusEntropy =
			fusionResult.global_consensus.length > 0
				? -Math.log2(1 / fusionResult.global_consensus.length)
				: 0;

		// Note: This is a placeholder - we need a user_id to create political_uncertainty
		// The current schema requires user_id, so this function may need redesign
		console.log('Fusion analysis results:', {
			category,
			positionVariance,
			consensusEntropy,
			qualityMetrics: fusionResult.quality_metrics
		});
	} catch (_error) {
		// Silently handle database errors in development
	}
}
