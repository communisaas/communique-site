import { db } from '$lib/core/db';

export interface CascadeMetrics {
	r0: number; // Average users activated per initial user
	generation_depth: number; // How many degrees of separation
	activation_velocity: number; // Users/hour during peak spread
	geographic_jump_rate: number; // Cross-district transmission rate
	temporal_decay: number; // How fast activation rate drops
}

export interface UserActivation {
	user_id: string;
	template_id: string;
	activated_at: Date;
	source_user_id?: string; // Who referred them
	activation_generation: number; // Degree of separation from patient zero
	geographic_distance: number; // Miles from source user
	time_to_activation: number; // Hours from exposure to action
}

/**
 * Calculate R0 using ACTUAL user_activation data (not inferred)
 */
export async function calculateTemplateR0(templateId: string): Promise<number> {
	// Get actual activation data from user_activation table
	const activations = await db.user_activation.findMany({
		where: {
			template_id: templateId
		},
		orderBy: {
			activation_time: 'asc'
		}
	});

	if (activations.length < 2) return 0;

	// Count secondary activations per primary user using REAL cascade data
	const generationCounts = new Map<number, number>();

	activations.forEach((activation) => {
		const gen = activation.activation_generation;
		generationCounts.set(gen, (generationCounts.get(gen) || 0) + 1);
	});

	// R0 = average secondary infections per primary case
	const primaryCases = generationCounts.get(0) || 0;
	const secondaryCases = generationCounts.get(1) || 0;

	return primaryCases > 0 ? secondaryCases / primaryCases : 0;
}

/**
 * Get REAL activation chain from user_activation table
 */
export async function getTemplateActivationChain(templateId: string): Promise<UserActivation[]> {
	// Use actual user_activation data - no inference needed!
	const activations = await db.user_activation.findMany({
		where: {
			template_id: templateId
		},
		include: {
			user: {
				select: {
					id: true,
					congressional_district: true,
					state: true,
					city: true,
					zip: true
				}
			},
			source_user: {
				select: {
					id: true,
					congressional_district: true,
					state: true
				}
			}
		},
		orderBy: {
			activation_time: 'asc'
		}
	});

	return activations.map((activation) => ({
		user_id: activation.user_id,
		template_id: activation.template_id,
		activated_at: activation.activation_time,
		source_user_id: activation.source_user_id || undefined,
		activation_generation: activation.activation_generation,
		geographic_distance: activation.geographic_distance || 0,
		time_to_activation: activation.time_to_activation || 0
	}));
}

/**
 * Calculate activation velocity during peak spread using REAL timestamps
 */
export async function calculateActivationVelocity(templateId: string): Promise<number> {
	const activations = await getTemplateActivationChain(templateId);

	if (activations.length < 10) return 0; // Need minimum sample size

	// Find 6-hour window with highest activation rate
	const windowSize = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
	let maxVelocity = 0;

	// Sort by time to ensure proper windowing
	const sortedActivations = activations.sort(
		(a, b) => a.activated_at.getTime() - b.activated_at.getTime()
	);

	for (let i = 0; i < sortedActivations.length - 1; i++) {
		const windowStart = sortedActivations[i].activated_at.getTime();
		const windowEnd = windowStart + windowSize;

		const activationsInWindow = sortedActivations.filter(
			(a) => a.activated_at.getTime() >= windowStart && a.activated_at.getTime() <= windowEnd
		).length;

		const velocity = activationsInWindow / 6; // Users per hour
		maxVelocity = Math.max(maxVelocity, velocity);
	}

	return maxVelocity;
}

/**
 * Full cascade analysis using REAL activation data
 */
export async function analyzeCascade(templateId: string): Promise<CascadeMetrics> {
	const activations = await getTemplateActivationChain(templateId);

	if (activations.length === 0) {
		return {
			r0: 0,
			generation_depth: 0,
			activation_velocity: 0,
			geographic_jump_rate: 0,
			temporal_decay: 0
		};
	}

	const r0 = await calculateTemplateR0(templateId);
	const velocity = await calculateActivationVelocity(templateId);

	// Calculate generation depth from REAL data
	const maxGeneration = Math.max(...activations.map((a) => a.activation_generation));

	// Calculate geographic jump rate (cross-district activations) from REAL data
	const crossDistrictJumps = activations.filter((a) => {
		if (!a.source_user_id) return false;
		// This would need to be calculated properly with user district data
		return a.geographic_distance > 0;
	}).length;

	const totalActivations = activations.filter((a) => a.source_user_id).length;
	const jumpRate = totalActivations > 0 ? crossDistrictJumps / totalActivations : 0;

	// Calculate temporal decay
	const decay = calculateTemporalDecay(activations);

	return {
		r0,
		generation_depth: maxGeneration,
		activation_velocity: velocity,
		geographic_jump_rate: jumpRate,
		temporal_decay: decay
	};
}

/**
 * Check if we have REAL cascade data for a template
 */
export async function hasActivationData(templateId: string): Promise<boolean> {
	const count = await db.user_activation.count({
		where: { template_id: templateId }
	});
	return count > 0;
}

/**
 * Get delivery metrics from template_campaign (separate from cascade metrics)
 */
export async function getDeliveryMetrics(templateId: string) {
	const campaigns = await db.template_campaign.findMany({
		where: { template_id: templateId },
		select: {
			status: true,
			created_at: true,
			delivered_at: true,
			user_id: true
		}
	});

	const totalCampaigns = campaigns.length;
	const delivered = campaigns.filter((c) => c.status === 'delivered').length;
	const pending = campaigns.filter((c) => c.status === 'pending').length;
	const failed = campaigns.filter((c) => c.status === 'failed').length;

	return {
		total_campaigns: totalCampaigns,
		delivered_count: delivered,
		pending_count: pending,
		failed_count: failed,
		success_rate: totalCampaigns > 0 ? delivered / totalCampaigns : 0,
		unique_users: new Set(campaigns.map((c) => c.user_id)).size
	};
}

function calculateTemporalDecay(activations: UserActivation[]): number {
	if (activations.length < 5) return 0;

	// Simple decay calculation - compare first vs last quintile activation rates
	const quintileSize = Math.floor(activations.length / 5);
	const firstQuintile = activations.slice(0, quintileSize);
	const lastQuintile = activations.slice(-quintileSize);

	const firstRate = quintileSize / getTimeSpan(firstQuintile);
	const lastRate = quintileSize / getTimeSpan(lastQuintile);

	return firstRate > 0 ? (firstRate - lastRate) / firstRate : 0;
}

function getTimeSpan(activations: UserActivation[]): number {
	if (activations.length < 2) return 1;

	const start = activations[0].activated_at.getTime();
	const end = activations[activations.length - 1].activated_at.getTime();

	return Math.max(1, (end - start) / (1000 * 60 * 60)); // Hours, minimum 1
}
