import { db } from './db';

/**
 * Community Clustering for Sheaved Communities Framework
 * 
 * Implements overlapping community detection using:
 * 1. Rule-based community assignment (foundation for BERT clustering)
 * 2. Community intersection analysis 
 * 3. Information flow boundary detection
 */

export interface CommunityMembership {
  community_id: string;
  weight: number; // 0-1, strength of membership
  confidence: number; // 0-1, certainty of assignment
  basis: string; // reason for assignment
}

export interface UserCommunityProfile {
  user_id: string;
  primary_community: string;
  community_memberships: CommunityMembership[];
  boundary_resistance: number; // how much this user's info struggles to cross boundaries
  bridge_potential: number; // how well this user can translate between communities
}

export interface CommunityCluster {
  cluster_id: string;
  community_type: string;
  member_count: number;
  dominant_sentiment: 'pro' | 'anti' | 'neutral';
  avg_intensity: number;
  geographic_center?: { lat: number; lng: number };
  boundary_strength: number; // how resistant to outside information
}

/**
 * Rule-based community detection based on template categories and sentiment
 */
export function detectUserCommunities(
  templateCategories: string[],
  sentimentClass: string,
  userRole?: string,
  location?: { state: string; district: string }
): CommunityMembership[] {
  
  const memberships: CommunityMembership[] = [];
  
  // Geographic communities (high weight for local issues)
  if (location) {
    memberships.push({
      community_id: `geographic_${location.state.toLowerCase()}`,
      weight: 0.8,
      confidence: 0.9,
      basis: 'geographic_location'
    });
    
    memberships.push({
      community_id: `district_${location.district}`,
      weight: 0.7,
      confidence: 0.85,
      basis: 'congressional_district'
    });
  }
  
  // Issue-based communities from template engagement
  const issueWeights: Record<string, number> = {};
  
  templateCategories.forEach(category => {
    const normalized = category.toLowerCase();
    
    // Map template categories to community types
    if (normalized.includes('education') || normalized.includes('student')) {
      issueWeights['education_advocates'] = (issueWeights['education_advocates'] || 0) + 0.3;
    }
    if (normalized.includes('health') || normalized.includes('medical')) {
      issueWeights['healthcare_community'] = (issueWeights['healthcare_community'] || 0) + 0.3;
    }
    if (normalized.includes('business') || normalized.includes('economic')) {
      issueWeights['business_community'] = (issueWeights['business_community'] || 0) + 0.3;
    }
    if (normalized.includes('environment') || normalized.includes('climate')) {
      issueWeights['environmental_advocates'] = (issueWeights['environmental_advocates'] || 0) + 0.3;
    }
    if (normalized.includes('tax') || normalized.includes('fiscal')) {
      issueWeights['fiscal_conservatives'] = (issueWeights['fiscal_conservatives'] || 0) + 0.3;
    }
  });
  
  // Convert issue weights to memberships
  Object.entries(issueWeights).forEach(([community, weight]) => {
    memberships.push({
      community_id: community,
      weight: Math.min(1.0, weight),
      confidence: 0.7,
      basis: 'template_engagement'
    });
  });
  
  // Sentiment-based communities
  if (sentimentClass !== 'neutral') {
    memberships.push({
      community_id: `${sentimentClass}_activists`,
      weight: 0.6,
      confidence: 0.8,
      basis: 'sentiment_pattern'
    });
  }
  
  // Role-based communities
  if (userRole) {
    const roleNormalized = userRole.toLowerCase();
    if (roleNormalized.includes('parent')) {
      memberships.push({
        community_id: 'parents_community',
        weight: 0.9,
        confidence: 0.95,
        basis: 'declared_role'
      });
    }
    if (roleNormalized.includes('teacher') || roleNormalized.includes('educator')) {
      memberships.push({
        community_id: 'educators_community',
        weight: 0.9,
        confidence: 0.95,
        basis: 'declared_role'
      });
    }
    if (roleNormalized.includes('business') || roleNormalized.includes('entrepreneur')) {
      memberships.push({
        community_id: 'business_community',
        weight: 0.9,
        confidence: 0.95,
        basis: 'declared_role'
      });
    }
  }
  
  return memberships;
}

/**
 * Calculate boundary resistance and bridge potential for a user
 */
export function calculateCommunityMetrics(memberships: CommunityMembership[]): {
  boundary_resistance: number;
  bridge_potential: number;
} {
  
  // Users with strong membership in one community have high boundary resistance
  const maxWeight = Math.max(...memberships.map(m => m.weight));
  const totalMemberships = memberships.length;
  
  // High resistance = strong single community membership
  const boundary_resistance = maxWeight * (1 - Math.log(totalMemberships + 1) * 0.3);
  
  // High bridge potential = multiple moderate memberships
  const avgWeight = memberships.reduce((sum, m) => sum + m.weight, 0) / totalMemberships;
  const weightVariance = memberships.reduce((sum, m) => sum + Math.pow(m.weight - avgWeight, 2), 0) / totalMemberships;
  const bridge_potential = totalMemberships > 2 ? (1 - weightVariance) * Math.log(totalMemberships) * 0.4 : 0;
  
  return {
    boundary_resistance: Math.min(1.0, boundary_resistance),
    bridge_potential: Math.min(1.0, bridge_potential)
  };
}

/**
 * Process user's community memberships and store in community_sheaves
 */
export async function processUserCommunities(
  userId: string,
  dryRun: boolean = true
): Promise<UserCommunityProfile | null> {
  
  try {
    // Get user data
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        templates: {
          select: { category: true },
          take: 10 // Recent templates
        },
        coordinates: {
          select: {
            political_embedding: true,
            latitude: true,
            longitude: true
          }
        }
      }
    });
    
    if (!user) return null;
    
    // Extract data for community detection
    const templateCategories = user.templates.map(t => t.category);
    const embedding = user.coordinates?.political_embedding as any;
    const sentimentClass = embedding?.sentiment_class || 'neutral';
    
    const location = user.state && user.congressional_district ? {
      state: user.state,
      district: user.congressional_district
    } : undefined;
    
    // Detect communities
    const memberships = detectUserCommunities(
      templateCategories,
      sentimentClass,
      undefined, // TODO: Add user role field
      location
    );
    
    // Calculate metrics
    const metrics = calculateCommunityMetrics(memberships);
    
    // Determine primary community (highest weight)
    const primaryCommunity = memberships.length > 0 
      ? memberships.reduce((max, current) => current.weight > max.weight ? current : max).community_id
      : 'uncategorized';
    
    const profile: UserCommunityProfile = {
      user_id: userId,
      primary_community: primaryCommunity,
      community_memberships: memberships,
      boundary_resistance: metrics.boundary_resistance,
      bridge_potential: metrics.bridge_potential
    };
    
    if (dryRun) {
      console.log(`🧪 DRY RUN - Community profile for user ${userId}:`);
      console.log(`   Primary: ${primaryCommunity}`);
      console.log(`   Memberships: ${memberships.length}`);
      console.log(`   Boundary resistance: ${metrics.boundary_resistance.toFixed(2)}`);
      console.log(`   Bridge potential: ${metrics.bridge_potential.toFixed(2)}`);
      return profile;
    }
    
    // Store in user_coordinates.community_sheaves
    await db.user_coordinates.upsert({
      where: { user_id: userId },
      update: {
        community_sheaves: {
          primary_community: primaryCommunity,
          memberships: memberships,
          boundary_resistance: metrics.boundary_resistance,
          bridge_potential: metrics.bridge_potential,
          last_calculated: new Date().toISOString()
        }
      },
      create: {
        user_id: userId,
        community_sheaves: {
          primary_community: primaryCommunity,
          memberships: memberships,
          boundary_resistance: metrics.boundary_resistance,
          bridge_potential: metrics.bridge_potential,
          last_calculated: new Date().toISOString()
        }
      }
    });
    
    console.log(`✅ Stored community profile for user ${userId}`);
    return profile;
    
  } catch (error) {
    console.error(`❌ Error processing communities for user ${userId}:`, error);
    return null;
  }
}

/**
 * Detect community intersections and store in community_intersection table
 */
export async function detectCommunityIntersections(dryRun: boolean = true): Promise<CommunityCluster[]> {
  
  try {
    console.log('🔍 Detecting community intersections...');
    
    // Get users with community data
    const usersWithCommunities = await db.user_coordinates.findMany({
      where: {
        community_sheaves: { not: null }
      },
      select: {
        user_id: true,
        community_sheaves: true,
        political_embedding: true
      },
      take: 50 // Limit for safety
    });
    
    console.log(`Found ${usersWithCommunities.length} users with community data`);
    
    // Group users by primary community
    const communityGroups: Record<string, any[]> = {};
    
    usersWithCommunities.forEach(user => {
      const sheaves = user.community_sheaves as any;
      if (!sheaves?.primary_community) return;
      
      const primaryCommunity = sheaves.primary_community;
      if (!communityGroups[primaryCommunity]) {
        communityGroups[primaryCommunity] = [];
      }
      
      communityGroups[primaryCommunity].push({
        user_id: user.user_id,
        sheaves,
        embedding: user.political_embedding
      });
    });
    
    const clusters: CommunityCluster[] = [];
    
    // Analyze each community cluster
    Object.entries(communityGroups).forEach(([communityType, members]) => {
      if (members.length < 2) return; // Need minimum cluster size
      
      // Calculate cluster statistics
      const sentiments = members.map(m => {
        const embedding = m.embedding as any;
        return embedding?.sentiment_class || 'neutral';
      });
      
      const intensities = members.map(m => {
        const embedding = m.embedding as any;
        return embedding?.intensity || 0.5;
      });
      
      // Determine dominant sentiment
      const sentimentCounts = sentiments.reduce((acc: Record<string, number>, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
      
      const dominantSentiment = Object.entries(sentimentCounts)
        .reduce((max, [sentiment, count]) => count > max[1] ? [sentiment, count] : max, ['neutral', 0])[0] as any;
      
      const avgIntensity = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
      
      // Calculate boundary strength (how uniform the community is)
      const intensityVariance = intensities.reduce((sum, i) => sum + Math.pow(i - avgIntensity, 2), 0) / intensities.length;
      const boundaryStrength = 1 - intensityVariance; // Lower variance = stronger boundaries
      
      const cluster: CommunityCluster = {
        cluster_id: `cluster_${communityType}_${Date.now()}`,
        community_type: communityType,
        member_count: members.length,
        dominant_sentiment: dominantSentiment,
        avg_intensity: avgIntensity,
        boundary_strength: Math.max(0, Math.min(1, boundaryStrength))
      };
      
      clusters.push(cluster);
      
      console.log(`📊 Cluster: ${communityType}`);
      console.log(`   Members: ${members.length}`);
      console.log(`   Dominant sentiment: ${dominantSentiment}`);
      console.log(`   Avg intensity: ${avgIntensity.toFixed(2)}`);
      console.log(`   Boundary strength: ${boundaryStrength.toFixed(2)}`);
    });
    
    if (!dryRun) {
      // Store intersections in community_intersection table
      for (const cluster of clusters) {
        if (cluster.member_count >= 3) { // Only store significant clusters
          await db.community_intersection.create({
            data: {
              community_a: cluster.community_type,
              community_b: 'general_population',
              shared_users: [], // TODO: Add user IDs
              shared_issues: [cluster.community_type],
              conflict_issues: [],
              influence_flow: { direction: 'internal' },
              intersection_strength: cluster.boundary_strength
            }
          });
        }
      }
      console.log(`✅ Stored ${clusters.length} community intersections`);
    }
    
    return clusters;
    
  } catch (error) {
    console.error('❌ Error detecting community intersections:', error);
    return [];
  }
}

/**
 * Test community clustering system
 */
export async function testCommunityClustering(): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  
  try {
    console.log('🧪 Testing Community Clustering System...\n');
    
    // Test 1: Process a single user's communities
    const recentCampaign = await db.template_campaign.findFirst({
      include: {
        template: {
          include: {
            user: { select: { id: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    
    if (recentCampaign?.template.user?.id) {
      console.log('Testing single user community detection...');
      const userProfile = await processUserCommunities(recentCampaign.template.user.id, true);
      
      if (userProfile) {
        console.log(`✅ Successfully detected ${userProfile.community_memberships.length} community memberships\n`);
      }
    }
    
    // Test 2: Detect community intersections
    console.log('Testing community intersection detection...');
    const clusters = await detectCommunityIntersections(true);
    
    return {
      success: true,
      message: 'Community clustering test completed successfully',
      data: {
        clusters_detected: clusters.length,
        cluster_summary: clusters.map(c => ({
          type: c.community_type,
          members: c.member_count,
          sentiment: c.dominant_sentiment
        }))
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}