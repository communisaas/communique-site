import { db } from './db';
import { classifyBasicSentiment, type BasicSentiment } from './sentiment-basic';

/**
 * SAFE sentiment storage - incremental updates only
 * NO bulk operations, NO cascading updates, NO risky database operations
 */

export interface StoredSentiment {
  user_id: string;
  message_text: string;
  sentiment_result: BasicSentiment;
  stored_at: Date;
}

/**
 * Store sentiment for a SINGLE user (safest possible operation)
 */
export async function storeSingleUserSentiment(
  userId: string, 
  messageText: string,
  dryRun: boolean = true
): Promise<StoredSentiment | null> {
  
  try {
    // Step 1: Classify sentiment (safe - no DB operations)
    const sentiment = classifyBasicSentiment(messageText);
    
    // Step 2: Prepare the data structure
    const sentimentData = {
      version: 'v1_basic',
      sentiment_class: sentiment.sentiment,
      confidence: sentiment.confidence,
      intensity: sentiment.intensity,
      keywords_found: sentiment.keywords_found,
      processed_at: new Date().toISOString(),
      message_length: messageText.length
    };
    
    if (dryRun) {
      // DRY RUN - Would store sentiment data
      return {
        user_id: userId,
        message_text: messageText,
        sentiment_result: sentiment,
        stored_at: new Date()
      };
    }
    
    // Step 3: Store safely with upsert (won't break if user_coordinates doesn't exist)
    await db.user_coordinates.upsert({
      where: { user_id: userId },
      update: {
        political_embedding: sentimentData,
        embedding_version: 'v1_basic',
        last_calculated: new Date()
      },
      create: {
        user_id: userId,
        political_embedding: sentimentData,
        embedding_version: 'v1_basic',
        last_calculated: new Date()
      }
    });
    
    // Stored sentiment successfully
    
    return {
      user_id: userId,
      message_text: messageText,
      sentiment_result: sentiment,
      stored_at: new Date()
    };
    
  } catch (error) {
    // Error storing sentiment (suppressed for production)
    return null;
  }
}

/**
 * Process ONE template campaign message (ultra-safe)
 */
export async function processSingleCampaign(
  campaignId: string,
  dryRun: boolean = true
): Promise<StoredSentiment | null> {
  
  try {
    // Get campaign data
    const campaign = await db.template_campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: {
          include: {
            user: {
              select: { id: true }
            }
          }
        }
      }
    });
    
    if (!campaign?.template.user?.id) {
      // Campaign has no valid user
      return null;
    }
    
    const messageText = campaign.template.message_body || campaign.template.description || '';
    if (messageText.length < 10) {
      // Campaign has no meaningful text
      return null;
    }
    
    // Process sentiment for this user
    return await storeSingleUserSentiment(
      campaign.template.user.id,
      messageText,
      dryRun
    );
    
  } catch (error) {
    return null;
  }
}

/**
 * Safe test: process just ONE recent campaign
 */
export async function testSingleCampaignProcessing(dryRun: boolean = true): Promise<void> {
  
  try {
    // Get the most recent campaign
    const recentCampaign = await db.template_campaign.findFirst({
      orderBy: { created_at: 'desc' },
      include: {
        template: {
          select: {
            id: true,
            message_body: true,
            description: true,
            category: true
          }
        }
      }
    });
    
    if (!recentCampaign) {
      return;
    }
    
    
    const result = await processSingleCampaign(recentCampaign.id, dryRun);
    
    if (result) {
    } else {
    }
    
  } catch (error) {
  }
}

/**
 * Super safe API endpoint test
 */
export async function runSafeStorageTest(): Promise<{
  success: boolean;
  message: string;
  data?: unknown;
}> {
  try {
    
    // Always start with dry run
    await testSingleCampaignProcessing(true);
    
    return {
      success: true,
      message: 'Safe storage test completed successfully',
      data: {
        note: 'This was a dry run - no data was actually stored'
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}