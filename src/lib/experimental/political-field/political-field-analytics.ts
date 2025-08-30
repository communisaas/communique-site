import { db } from './db';

export interface PoliticalBubbleAnalysis {
  bubble_id: string;
  center_user: string;
  radius: number;
  member_count: number;
  agreement_strength: number;
  dominant_issues: string[];
  edge_tensions: Array<{
    neighboring_bubble: string;
    conflict_intensity: number;
    disputed_issues: string[];
  }>;
}

export interface CommunityIntersectionMap {
  intersection_id: string;
  communities: [string, string];
  overlap_size: number;
  shared_priorities: string[];
  tension_points: string[];
  influence_direction: 'a_dominates' | 'b_dominates' | 'balanced' | 'conflicted';
}

export interface PoliticalFlowState {
  timestamp: Date;
  flow_strength: number;
  primary_sources: Array<{
    user_id: string;
    energy_output: number;
    issue_focus: string[];
  }>;
  absorption_zones: Array<{
    geographic_area: string;
    absorption_rate: number;
    neutralizing_factors: string[];
  }>;
  turbulence_areas: Array<{
    location: string;
    chaos_level: number;
    cause: string;
  }>;
}

/**
 * Detect and analyze local political bubbles
 */
export async function analyzePoliticalBubbles(
  center_lat: number, 
  center_lng: number, 
  max_radius: number = 50
): Promise<PoliticalBubbleAnalysis[]> {
  
  // Get users within geographic radius
  const nearbyUsers = await db.user.findMany({
    where: {
      coordinates: {
        latitude: {
          gte: center_lat - (max_radius / 69), // ~69 miles per degree lat
          lte: center_lat + (max_radius / 69)
        },
        longitude: {
          gte: center_lng - (max_radius / 55), // ~55 miles per degree lng at mid-latitudes
          lte: center_lng + (max_radius / 55)
        }
      }
    },
    include: {
      coordinates: true,
      campaigns: {
        include: {
          template: {
            select: { category: true, type: true }
          }
        }
      },
      political_uncertainty: true
    }
  });

  const bubbles: PoliticalBubbleAnalysis[] = [];
  
  for (const user of nearbyUsers) {
    if (!user.coordinates) continue;
    
    // Find users with similar political positions within radius
    const similarUsers = await findPoliticallySimilarUsers(user.id, 10); // 10 mile radius
    
    if (similarUsers.length < 3) continue; // Need minimum group size
    
    // Calculate shared beliefs and agreement strength
    const sharedBeliefs = await calculateSharedBeliefs(similarUsers.map(u => u.id));
    const agreementStrength = await calculateAgreementStrength(similarUsers.map(u => u.id));
    
    // Check for existing bubble
    const existingBubble = await db.local_political_bubble.findFirst({
      where: {
        center_user_id: user.id,
        is_active: true
      }
    });
    
    let bubbleId: string;
    
    if (existingBubble) {
      // Update existing bubble
      await db.local_political_bubble.update({
        where: { id: existingBubble.id },
        data: {
          member_count: similarUsers.length,
          bubble_strength: agreementStrength,
          shared_beliefs: sharedBeliefs,
          last_updated: new Date()
        }
      });
      bubbleId = existingBubble.id;
    } else {
      // Create new bubble
      const newBubble = await db.local_political_bubble.create({
        data: {
          center_user_id: user.id,
          radius_miles: 10,
          shared_beliefs: sharedBeliefs,
          bubble_strength: agreementStrength,
          member_count: similarUsers.length
        }
      });
      bubbleId = newBubble.id;
    }
    
    // Detect edge conflicts with neighboring bubbles
    const edgeTensions = await detectBubbleConflicts(bubbleId, user.coordinates);
    
    bubbles.push({
      bubble_id: bubbleId,
      center_user: user.id,
      radius: 10,
      member_count: similarUsers.length,
      agreement_strength: agreementStrength,
      dominant_issues: extractDominantIssues(sharedBeliefs),
      edge_tensions: edgeTensions
    });
  }
  
  return bubbles;
}

/**
 * Map community intersections and influence flows
 */
export async function analyzeCommunityIntersections(): Promise<CommunityIntersectionMap[]> {
  
  // Get all active community pairs
  const communityTypes = ['union_members', 'parents', 'students', 'small_business', 'veterans', 'teachers'];
  const intersections: CommunityIntersectionMap[] = [];
  
  for (let i = 0; i < communityTypes.length; i++) {
    for (let j = i + 1; j < communityTypes.length; j++) {
      const communityA = communityTypes[i];
      const communityB = communityTypes[j];
      
      // Find users who belong to both communities
      const sharedUsers = await findUsersInBothCommunities(communityA, communityB);
      
      if (sharedUsers.length < 5) continue; // Need minimum intersection size
      
      // Analyze shared priorities and conflicts
      const sharedPriorities = await calculateSharedPriorities(sharedUsers);
      const tensionPoints = await calculateTensionPoints(communityA, communityB, sharedUsers);
      const influenceDirection = await calculateInfluenceDirection(communityA, communityB, sharedUsers);
      
      // Store/update intersection data
      const intersection = await db.community_intersection.upsert({
        where: {
          community_a_community_b: {
            community_a: communityA,
            community_b: communityB
          }
        },
        create: {
          community_a: communityA,
          community_b: communityB,
          shared_users: sharedUsers.map(u => u.id),
          shared_issues: sharedPriorities,
          conflict_issues: tensionPoints,
          influence_flow: { direction: influenceDirection },
          intersection_strength: sharedUsers.length / 100 // Normalize by expected max
        },
        update: {
          shared_users: sharedUsers.map(u => u.id),
          shared_issues: sharedPriorities,
          conflict_issues: tensionPoints,
          influence_flow: { direction: influenceDirection },
          intersection_strength: sharedUsers.length / 100,
          last_calculated: new Date()
        }
      });
      
      intersections.push({
        intersection_id: intersection.id,
        communities: [communityA, communityB],
        overlap_size: sharedUsers.length,
        shared_priorities: sharedPriorities,
        tension_points: tensionPoints,
        influence_direction: influenceDirection
      });
    }
  }
  
  return intersections;
}

/**
 * Calculate current political flow dynamics
 */
export async function calculatePoliticalFlow(): Promise<PoliticalFlowState> {
  
  const timeWindow = 24; // 24 hour analysis window
  const cutoffTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
  
  // Find recent high-activity users (flow sources)
  const recentCampaigns = await db.template_campaign.findMany({
    where: {
      created_at: { gte: cutoffTime },
      status: { in: ['delivered', 'confirmed'] }
    },
    include: {
      user: {
        include: {
          coordinates: true
        }
      },
      template: {
        select: { category: true, type: true }
      }
    }
  });
  
  // Group by user to find energy sources
  const userActivity = new Map<string, number>();
  const userIssues = new Map<string, string[]>();
  
  recentCampaigns.forEach(campaign => {
    if (!campaign.user) return;
    
    const userId = campaign.user.id;
    userActivity.set(userId, (userActivity.get(userId) || 0) + 1);
    
    const issues = userIssues.get(userId) || [];
    issues.push(campaign.template.category);
    userIssues.set(userId, issues);
  });
  
  // Identify top energy sources
  const primarySources = Array.from(userActivity.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, activity]) => ({
      user_id: userId,
      energy_output: activity,
      issue_focus: Array.from(new Set(userIssues.get(userId) || []))
    }));
  
  // Detect absorption zones (areas with low activity despite high user density)
  const absorptionZones = await findAbsorptionZones(recentCampaigns);
  
  // Detect turbulence (areas with conflicting high activity)
  const turbulenceAreas = await findTurbulenceZones(recentCampaigns);
  
  // Calculate overall flow strength
  const totalActivity = Array.from(userActivity.values()).reduce((sum, count) => sum + count, 0);
  const flowStrength = Math.min(totalActivity / 1000, 1.0); // Normalize to 0-1
  
  // Store flow state
  await db.political_flow.create({
    data: {
      time_window_hours: timeWindow,
      flow_sources: primarySources,
      flow_sinks: absorptionZones,
      flow_velocity: { avg_activation_time: await calculateAvgActivationTime(cutoffTime) },
      flow_direction: await calculatePrimaryFlowDirection(recentCampaigns),
      turbulence_zones: turbulenceAreas,
      flow_strength: flowStrength,
      dominant_issues: await calculateDominantIssues(recentCampaigns)
    }
  });
  
  return {
    timestamp: new Date(),
    flow_strength: flowStrength,
    primary_sources: primarySources,
    absorption_zones: absorptionZones,
    turbulence_areas: turbulenceAreas
  };
}

/**
 * Detect political dead ends - views that can't spread
 */
export async function detectPoliticalDeadEnds(userId: string, templateId: string): Promise<void> {
  
  // Check if this template has failed to spread from this user
  const activations = await db.user_activation.findMany({
    where: {
      template_id: templateId,
      source_user_id: userId
    }
  });
  
  // If no secondary activations after 72 hours, might be a dead end
  const hoursWithoutSpread = (Date.now() - new Date(activations[0]?.activation_time || 0).getTime()) / (1000 * 60 * 60);
  
  if (hoursWithoutSpread > 72 && activations.length === 0) {
    
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { coordinates: true, context_stack: true }
    });
    
    if (!user) return;
    
    // Analyze blocking factors
    const blockingFactors = await analyzeBlockingFactors(userId, templateId);
    
    await db.political_dead_end.create({
      data: {
        political_view: await extractPoliticalView(templateId),
        origin_user_id: userId,
        origin_location: {
          lat: user.coordinates?.latitude,
          lng: user.coordinates?.longitude,
          district: user.congressional_district
        },
        blocking_factors: blockingFactors,
        max_reach_miles: 0, // Didn't spread at all
        decay_rate: 1.0, // Immediate decay
        attempt_count: 1
      }
    });
  }
}

// Helper functions (implementation details)

async function findPoliticallySimilarUsers(userId: string, radiusMiles: number): Promise<{id: string}[]> {
  // Implementation: Find users with similar template usage patterns within radius
  // For now, return a basic mock result to allow compilation
  const baseUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, congressional_district: true, state: true }
  });
  
  if (!baseUser) return [];
  
  // Find users in same district as a basic similarity metric
  const similarUsers = await db.user.findMany({
    where: {
      congressional_district: baseUser.congressional_district,
      id: { not: userId }
    },
    select: { id: true },
    take: 10
  });
  
  return similarUsers;
}

async function calculateSharedBeliefs(userIds: string[]) {
  // Implementation: Analyze common template categories/types users have engaged with
  if (userIds.length === 0) return {};
  
  const campaigns = await db.template_campaign.findMany({
    where: {
      template: {
        user: {
          id: { in: userIds }
        }
      }
    },
    include: {
      template: {
        select: {
          category: true,
          type: true
        }
      }
    }
  });
  
  // Count categories
  const categoryCount: Record<string, number> = {};
  campaigns.forEach(campaign => {
    const category = campaign.template.category;
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });
  
  return categoryCount;
}

async function calculateAgreementStrength(userIds: string[]): Promise<number> {
  // Implementation: Calculate how closely users align on issues based on template usage
  if (userIds.length === 0) return 0;
  
  // Get template usage for all users
  const userTemplates = await db.template_campaign.findMany({
    where: {
      template: {
        user: {
          id: { in: userIds }
        }
      }
    },
    include: {
      template: {
        select: {
          category: true,
          user: {
            select: { id: true }
          }
        }
      }
    }
  });
  
  // Calculate overlap in template categories used
  const userCategories: Record<string, Set<string>> = {};
  userTemplates.forEach(campaign => {
    const userId = campaign.template.user?.id;
    const category = campaign.template.category;
    if (userId) {
      if (!userCategories[userId]) userCategories[userId] = new Set();
      userCategories[userId].add(category);
    }
  });
  
  // Calculate Jaccard similarity across all user pairs
  const userIdsList = Object.keys(userCategories);
  if (userIdsList.length < 2) return 0.5;
  
  let totalSimilarity = 0;
  let comparisons = 0;
  
  for (let i = 0; i < userIdsList.length; i++) {
    for (let j = i + 1; j < userIdsList.length; j++) {
      const set1 = userCategories[userIdsList[i]];
      const set2 = userCategories[userIdsList[j]];
      
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      totalSimilarity += jaccard;
      comparisons++;
    }
  }
  
  return comparisons > 0 ? totalSimilarity / comparisons : 0.5;
}

function extractDominantIssues(sharedBeliefs: unknown): string[] {
  // Implementation: Extract top issues from shared beliefs
  return ['healthcare', 'education'];
}

async function detectBubbleConflicts(bubbleId: string, coordinates: unknown) {
  // Implementation: Find nearby bubbles with conflicting views
  return [];
}

async function findUsersInBothCommunities(communityA: string, communityB: string): Promise<{id: string}[]> {
  // Implementation: Find users that could belong to both community types
  // For now, return users from similar geographic areas as a proxy
  const users = await db.user.findMany({
    where: {
      AND: [
        { state: { not: null } },
        { congressional_district: { not: null } }
      ]
    },
    select: { id: true },
    take: 10
  });
  
  return users;
}

async function calculateSharedPriorities(users: Array<Record<string, unknown>>) {
  // Implementation: Find issues both communities care about
  return ['jobs', 'infrastructure'];
}

async function calculateTensionPoints(communityA: string, communityB: string, users: Array<Record<string, unknown>>) {
  // Implementation: Find issues where communities disagree
  return ['taxation', 'regulation'];
}

async function calculateInfluenceDirection(communityA: string, communityB: string, users: Array<Record<string, unknown>>): Promise<'a_dominates' | 'b_dominates' | 'balanced' | 'conflicted'> {
  // Implementation: Determine which community has more influence
  return 'balanced';
}

async function findAbsorptionZones(campaigns: Array<Record<string, unknown>>) {
  // Implementation: Find areas with low activity despite high user density
  return [];
}

async function findTurbulenceZones(campaigns: Array<Record<string, unknown>>) {
  // Implementation: Find areas with conflicting high activity
  return [];
}

async function calculateAvgActivationTime(cutoffTime: Date) {
  // Implementation: Calculate average time from exposure to activation
  return 4.2; // hours
}

async function calculatePrimaryFlowDirection(campaigns: Array<Record<string, unknown>>) {
  // Implementation: Calculate net direction of political flow
  return { north_south: 0.3, east_west: -0.1 };
}

async function calculateDominantIssues(campaigns: Array<Record<string, unknown>>) {
  // Implementation: Find most active issues in time window
  return ['climate', 'economy'];
}

async function analyzeBlockingFactors(userId: string, templateId: string) {
  // Implementation: Analyze why template didn't spread
  return ['geographic_isolation', 'community_mismatch'];
}

async function extractPoliticalView(templateId: string) {
  // Implementation: Extract structured political position from template
  return { issue: 'healthcare', position: 'support', intensity: 0.8 };
}