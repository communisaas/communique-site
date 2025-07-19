import { db } from './db';

export interface CascadeMetrics {
    r0: number;                    // Average users activated per initial user
    generation_depth: number;     // How many degrees of separation 
    activation_velocity: number;  // Users/hour during peak spread
    geographic_jump_rate: number; // Cross-district transmission rate
    temporal_decay: number;       // How fast activation rate drops
}

export interface UserActivation {
    user_id: string;
    template_id: string;
    activated_at: Date;
    source_user_id?: string;      // Who referred them
    activation_generation: number; // Degree of separation from patient zero
    geographic_distance: number;  // Miles from source user
    time_to_activation: number;   // Hours from exposure to action
}

/**
 * Calculate R0 - how many secondary users each user activates on average
 */
export async function calculateTemplateR0(templateId: string): Promise<number> {
    // Get all user activations for this template
    const activations = await getTemplateActivationChain(templateId);
    
    if (activations.length < 2) return 0;
    
    // Count secondary activations per primary user
    const generationCounts = new Map<number, number>();
    
    activations.forEach(activation => {
        const gen = activation.activation_generation;
        generationCounts.set(gen, (generationCounts.get(gen) || 0) + 1);
    });
    
    // R0 = average secondary infections per primary case
    const primaryCases = generationCounts.get(0) || 0;
    const secondaryCases = generationCounts.get(1) || 0;
    
    return primaryCases > 0 ? secondaryCases / primaryCases : 0;
}

/**
 * Track activation cascades - who activated whom
 */
export async function getTemplateActivationChain(templateId: string): Promise<UserActivation[]> {
    // Get all campaigns for this template with user data and timestamps
    const campaigns = await db.template_campaign.findMany({
        where: {
            template_id: templateId,
            status: { in: ['delivered', 'confirmed'] }
        },
        include: {
            template: {
                include: {
                    user: {
                        select: {
                            id: true,
                            congressional_district: true,
                            state: true,
                            city: true,
                            zip: true,
                            createdAt: true
                        }
                    }
                }
            }
        },
        orderBy: {
            created_at: 'asc'
        }
    });

    const activations: UserActivation[] = [];
    
    for (let i = 0; i < campaigns.length; i++) {
        const campaign = campaigns[i];
        const user = campaign.template.user;
        
        if (!user) continue;
        
        // Find potential source user (most recent activation in same/nearby district)
        const sourceUser = findLikelySourceUser(
            user,
            campaign.created_at,
            activations,
            campaigns.slice(0, i)
        );
        
        const activation: UserActivation = {
            user_id: user.id,
            template_id: templateId,
            activated_at: campaign.created_at,
            source_user_id: sourceUser?.user_id,
            activation_generation: sourceUser ? sourceUser.activation_generation + 1 : 0,
            geographic_distance: sourceUser ? calculateDistanceBetweenUsers(user, sourceUser) : 0,
            time_to_activation: sourceUser ? 
                (campaign.created_at.getTime() - sourceUser.activated_at.getTime()) / (1000 * 60 * 60) : 0
        };
        
        activations.push(activation);
    }
    
    return activations;
}

/**
 * Find most likely source user for a new activation
 */
function findLikelySourceUser(
    newUser: any,
    activationTime: Date,
    existingActivations: UserActivation[],
    campaigns: any[]
): UserActivation | null {
    
    // Look for recent activations in same or nearby districts
    const recentActivations = existingActivations.filter(activation => {
        const timeDiff = activationTime.getTime() - activation.activated_at.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Consider activations from last 72 hours
        return hoursDiff <= 72 && hoursDiff > 0;
    });
    
    if (recentActivations.length === 0) return null;
    
    // Score potential sources by proximity and recency
    const scoredSources = recentActivations.map(activation => {
        const sourceCampaign = campaigns.find(c => c.template.user?.id === activation.user_id);
        if (!sourceCampaign?.template.user) return null;
        
        const sourceUser = sourceCampaign.template.user;
        
        // Geographic proximity score
        const geoScore = calculateGeographicProximity(newUser, sourceUser);
        
        // Temporal recency score  
        const timeDiff = activationTime.getTime() - activation.activated_at.getTime();
        const hoursAgo = timeDiff / (1000 * 60 * 60);
        const timeScore = Math.exp(-hoursAgo / 24); // Exponential decay over 24h
        
        return {
            activation,
            score: geoScore * timeScore
        };
    }).filter(Boolean);
    
    if (scoredSources.length === 0) return null;
    
    // Return highest scoring source
    scoredSources.sort((a, b) => b!.score - a!.score);
    return scoredSources[0]!.activation;
}

/**
 * Calculate geographic proximity score between users
 */
function calculateGeographicProximity(user1: any, user2: any): number {
    // Same congressional district = high proximity
    if (user1.congressional_district === user2.congressional_district) {
        return 1.0;
    }
    
    // Same state = medium proximity
    if (user1.state === user2.state) {
        return 0.7;
    }
    
    // Different states = low proximity
    return 0.3;
}

/**
 * Calculate distance between users (simplified)
 */
function calculateDistanceBetweenUsers(user1: any, sourceActivation: UserActivation): number {
    // Simplified distance - in real implementation use actual coordinates
    if (user1.congressional_district === sourceActivation.user_id) return 0;
    if (user1.state === sourceActivation.user_id) return 50; // ~50 miles same state
    return 200; // ~200 miles different states
}

/**
 * Calculate activation velocity during peak spread
 */
export async function calculateActivationVelocity(templateId: string): Promise<number> {
    const activations = await getTemplateActivationChain(templateId);
    
    if (activations.length < 10) return 0; // Need minimum sample size
    
    // Find 6-hour window with highest activation rate
    const windowSize = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    let maxVelocity = 0;
    
    for (let i = 0; i < activations.length - 1; i++) {
        const windowStart = activations[i].activated_at.getTime();
        const windowEnd = windowStart + windowSize;
        
        const activationsInWindow = activations.filter(a => 
            a.activated_at.getTime() >= windowStart && 
            a.activated_at.getTime() <= windowEnd
        ).length;
        
        const velocity = activationsInWindow / 6; // Users per hour
        maxVelocity = Math.max(maxVelocity, velocity);
    }
    
    return maxVelocity;
}

/**
 * Full cascade analysis for a template
 */
export async function analyzeCascade(templateId: string): Promise<CascadeMetrics> {
    const activations = await getTemplateActivationChain(templateId);
    const r0 = await calculateTemplateR0(templateId);
    const velocity = await calculateActivationVelocity(templateId);
    
    // Calculate generation depth
    const maxGeneration = Math.max(...activations.map(a => a.activation_generation));
    
    // Calculate geographic jump rate (cross-district activations)
    const crossDistrictJumps = activations.filter(a => 
        a.source_user_id && a.geographic_distance > 0
    ).length;
    const totalActivations = activations.filter(a => a.source_user_id).length;
    const jumpRate = totalActivations > 0 ? crossDistrictJumps / totalActivations : 0;
    
    // Calculate temporal decay (how activation rate drops over time)
    const decay = calculateTemporalDecay(activations);
    
    return {
        r0,
        generation_depth: maxGeneration,
        activation_velocity: velocity,
        geographic_jump_rate: jumpRate,
        temporal_decay: decay
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
    
    return (end - start) / (1000 * 60 * 60); // Hours
}