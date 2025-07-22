import { db } from './db';

/**
 * Geographic Sentiment Interpolation (IDW Algorithm)
 * 
 * Implements: S(x₀, y₀) = Σᵢ wᵢ · sᵢ / Σᵢ wᵢ
 * where: wᵢ = 1 / d(x₀, y₀, xᵢ, yᵢ)^p
 */

export interface SentimentPoint {
  user_id: string;
  latitude: number;
  longitude: number;
  sentiment_value: number; // -1 (anti) to +1 (pro)
  intensity: number; // 0 to 1
  confidence: number; // 0 to 1
}

export interface GeographicSentimentField {
  query_latitude: number;
  query_longitude: number;
  interpolated_sentiment: number;
  interpolated_intensity: number;
  contributing_points: number;
  max_distance_km: number;
}

/**
 * Calculate distance between two geographic points (Haversine formula)
 */
function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Convert sentiment class to numeric value
 */
function sentimentToNumeric(sentiment: string): number {
  switch (sentiment.toLowerCase()) {
    case 'pro': return 1;
    case 'anti': return -1;
    case 'neutral': default: return 0;
  }
}

/**
 * Get sentiment points from database (with geographic coordinates)
 */
export async function getSentimentPoints(
  centerLat?: number, 
  centerLng?: number, 
  radiusKm: number = 500,
  limit: number = 50
): Promise<SentimentPoint[]> {
  
  try {
    // Get users with both coordinates and sentiment data
    const usersWithSentiment = await db.user_coordinates.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        political_embedding: { not: null }
      },
      select: {
        user_id: true,
        latitude: true,
        longitude: true,
        political_embedding: true
      },
      take: limit
    });
    
    const sentimentPoints: SentimentPoint[] = [];
    
    for (const user of usersWithSentiment) {
      if (!user.latitude || !user.longitude || !user.political_embedding) continue;
      
      try {
        const embedding = user.political_embedding as any;
        const sentimentClass = embedding.sentiment_class || 'neutral';
        const confidence = embedding.confidence || 0.5;
        const intensity = embedding.intensity || 0.5;
        
        // Filter by radius if center point provided
        if (centerLat && centerLng) {
          const distance = calculateDistance(
            centerLat, centerLng,
            user.latitude, user.longitude
          );
          if (distance > radiusKm) continue;
        }
        
        sentimentPoints.push({
          user_id: user.user_id,
          latitude: user.latitude,
          longitude: user.longitude,
          sentiment_value: sentimentToNumeric(sentimentClass) * intensity,
          intensity,
          confidence
        });
        
      } catch (error) {
        console.warn(`Error parsing sentiment for user ${user.user_id}:`, error);
      }
    }
    
    return sentimentPoints;
    
  } catch (error) {
    console.error('Error fetching sentiment points:', error);
    return [];
  }
}

/**
 * Perform IDW interpolation at a specific geographic point
 */
export function interpolateSentimentAtPoint(
  queryLat: number,
  queryLng: number,
  sentimentPoints: SentimentPoint[],
  power: number = 2,
  maxDistanceKm: number = 100
): GeographicSentimentField {
  
  let weightedSentimentSum = 0;
  let weightedIntensitySum = 0;
  let totalWeight = 0;
  let contributingPoints = 0;
  let maxDistance = 0;
  
  for (const point of sentimentPoints) {
    const distance = calculateDistance(
      queryLat, queryLng,
      point.latitude, point.longitude
    );
    
    // Skip points that are too far away
    if (distance > maxDistanceKm) continue;
    
    // Avoid division by zero for exact matches
    const effectiveDistance = Math.max(distance, 0.001);
    
    // IDW weight calculation: wᵢ = 1 / d^p
    const weight = 1 / Math.pow(effectiveDistance, power);
    
    // Apply confidence as additional weighting
    const confidenceWeight = weight * point.confidence;
    
    weightedSentimentSum += point.sentiment_value * confidenceWeight;
    weightedIntensitySum += point.intensity * confidenceWeight;
    totalWeight += confidenceWeight;
    contributingPoints++;
    maxDistance = Math.max(maxDistance, distance);
  }
  
  // Calculate interpolated values
  const interpolated_sentiment = totalWeight > 0 ? weightedSentimentSum / totalWeight : 0;
  const interpolated_intensity = totalWeight > 0 ? weightedIntensitySum / totalWeight : 0;
  
  return {
    query_latitude: queryLat,
    query_longitude: queryLng,
    interpolated_sentiment,
    interpolated_intensity,
    contributing_points: contributingPoints,
    max_distance_km: maxDistance
  };
}

/**
 * Generate sentiment field for a geographic region
 */
export async function generateSentimentField(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 50,
  gridResolution: number = 5
): Promise<GeographicSentimentField[]> {
  
  console.log(`🗺️  Generating sentiment field for (${centerLat}, ${centerLng}) radius ${radiusKm}km`);
  
  // Get sentiment points in the region
  const sentimentPoints = await getSentimentPoints(centerLat, centerLng, radiusKm * 2);
  
  if (sentimentPoints.length === 0) {
    console.log('No sentiment points found in region');
    return [];
  }
  
  console.log(`Found ${sentimentPoints.length} sentiment points`);
  
  // Create a grid of interpolation points
  const field: GeographicSentimentField[] = [];
  const kmPerDegree = 111; // Approximate km per degree latitude
  const stepSize = radiusKm / gridResolution / kmPerDegree;
  
  for (let latOffset = -radiusKm/kmPerDegree; latOffset <= radiusKm/kmPerDegree; latOffset += stepSize) {
    for (let lngOffset = -radiusKm/kmPerDegree; lngOffset <= radiusKm/kmPerDegree; lngOffset += stepSize) {
      const queryLat = centerLat + latOffset;
      const queryLng = centerLng + lngOffset;
      
      const interpolation = interpolateSentimentAtPoint(
        queryLat, queryLng, sentimentPoints, 2, radiusKm
      );
      
      if (interpolation.contributing_points > 0) {
        field.push(interpolation);
      }
    }
  }
  
  return field;
}

/**
 * Test geographic interpolation with real data
 */
export async function testGeographicInterpolation(): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  
  try {
    console.log('🧪 Testing Geographic Interpolation...\n');
    
    // Test coordinates: Austin, TX (center of our example)
    const testLat = 30.27;
    const testLng = -97.74;
    
    console.log(`Test location: Austin, TX (${testLat}, ${testLng})`);
    
    // Get sentiment points in Texas
    const sentimentPoints = await getSentimentPoints(testLat, testLng, 500, 20);
    console.log(`Found ${sentimentPoints.length} sentiment points in region\n`);
    
    if (sentimentPoints.length === 0) {
      return {
        success: true,
        message: 'No sentiment data available for interpolation test',
        data: { points_found: 0 }
      };
    }
    
    // Display the sentiment points
    sentimentPoints.forEach((point, index) => {
      console.log(`Point ${index + 1}:`);
      console.log(`  Location: (${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)})`);
      console.log(`  Sentiment: ${point.sentiment_value.toFixed(2)} (intensity: ${point.intensity.toFixed(2)})`);
      console.log(`  Distance from Austin: ${calculateDistance(testLat, testLng, point.latitude, point.longitude).toFixed(1)} km\n`);
    });
    
    // Test interpolation at Austin
    const interpolation = interpolateSentimentAtPoint(testLat, testLng, sentimentPoints);
    
    console.log('📍 Interpolation at Austin, TX:');
    console.log(`   Sentiment: ${interpolation.interpolated_sentiment.toFixed(3)} (-1=anti, +1=pro)`);
    console.log(`   Intensity: ${interpolation.interpolated_intensity.toFixed(3)}`);
    console.log(`   Contributing points: ${interpolation.contributing_points}`);
    console.log(`   Max distance: ${interpolation.max_distance_km.toFixed(1)} km`);
    
    // Test a small sentiment field (3x3 grid)
    console.log('\n🗺️  Generating 3x3 sentiment field...');
    const field = await generateSentimentField(testLat, testLng, 100, 3);
    
    console.log(`Generated ${field.length} field points:`);
    field.forEach((point, index) => {
      console.log(`  [${index}] (${point.query_latitude.toFixed(2)}, ${point.query_longitude.toFixed(2)}): sentiment=${point.interpolated_sentiment.toFixed(2)}`);
    });
    
    return {
      success: true,
      message: 'Geographic interpolation test completed successfully',
      data: {
        test_location: { lat: testLat, lng: testLng },
        sentiment_points: sentimentPoints.length,
        interpolated_sentiment: interpolation.interpolated_sentiment,
        field_points: field.length
      }
    };
    
  } catch (error) {
    console.error('❌ Error in geographic interpolation test:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}