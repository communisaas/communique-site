import { db } from '$lib/core/db';

/**
 * OAUTH-BASED API SECURITY - Use Our Existing Login System
 * 
 * No API keys, no additional auth tokens - just OAuth sessions
 */

interface SessionValidation {
  valid: boolean;
  user_id?: string;
  user_email?: string;
  session_expires?: Date;
  error?: string;
}

interface RateLimit {
  user_id: string;
  endpoint: string;
  count: number;
  window_start: number;
}

// Simple in-memory rate limiting by user_id
const userRateLimits = new Map<string, RateLimit>();

/**
 * Validate OAuth session from cookie/header
 */
export async function validateOAuthSession(request: Request): Promise<SessionValidation> {
  
  try {
    // Extract session ID from cookie (SvelteKit auth pattern)
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return { valid: false, error: 'No session cookie' };
    }
    
    // Parse session ID from cookies (adjust based on your auth setup)
    const sessionMatch = cookies.match(/auth-session=([^;]+)/);
    if (!sessionMatch) {
      return { valid: false, error: 'No auth session found' };
    }
    
    const sessionId = sessionMatch[1];
    
    // Validate session in database
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    
    if (!session) {
      return { valid: false, error: 'Invalid session' };
    }
    
    if (session.expiresAt < new Date()) {
      return { valid: false, error: 'Session expired' };
    }
    
    return {
      valid: true,
      user_id: session.userId,
      user_email: session.user.email,
      session_expires: session.expiresAt
    };
    
  } catch (error) {
    return { valid: false, error: 'Session validation failed' };
  }
}

/**
 * Check if user can access specific analytics endpoints
 */
export async function checkAnalyticsPermission(
  user_id: string,
  endpoint: string
): Promise<{ allowed: boolean; reason?: string }> {
  
  try {
    // Get user info
    const user = await db.user.findUnique({
      where: { id: user_id },
      include: {
        templates: {
          select: { id: true }
        },
        campaigns: {
          select: { id: true }
        }
      }
    });
    
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }
    
    // Permission logic based on user activity
    const hasTemplates = user.templates.length > 0;
    const hasCampaigns = user.campaigns.length > 0;
    const isActiveUser = hasTemplates || hasCampaigns;
    
    switch (endpoint) {
      case 'percolation-analysis':
        // Only allow users who have created templates (they're contributing to the network)
        return { 
          allowed: hasTemplates, 
          reason: hasTemplates ? undefined : 'Must create templates to access network analysis' 
        };
      
      case 'sheaf-fusion':
        // Only allow active users (either created templates or sent campaigns)
        return { 
          allowed: isActiveUser, 
          reason: isActiveUser ? undefined : 'Must be active user to access data fusion' 
        };
      
      case 'test-clustering':
        // Allow all logged-in users
        return { allowed: true };
      
      case 'create-test-data':
        // Check if user is developer/admin (has many templates)
        const isDeveloper = user.templates.length > 5;
        return { 
          allowed: isDeveloper, 
          reason: isDeveloper ? undefined : 'Admin access required' 
        };
      
      default:
        return { allowed: false, reason: 'Unknown endpoint' };
    }
    
  } catch (error) {
    return { allowed: false, reason: 'Permission check failed' };
  }
}

/**
 * Rate limiting by OAuth user (not IP)
 */
export function checkUserRateLimit(
  user_id: string,
  endpoint: string,
  max_per_minute: number = 10
): { allowed: boolean; remaining: number; reset_time: number } {
  
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const key = `${user_id}:${endpoint}`;
  
  const record = userRateLimits.get(key);
  
  if (!record || now - record.window_start > windowMs) {
    // New window
    userRateLimits.set(key, {
      user_id,
      endpoint,
      count: 1,
      window_start: now
    });
    
    return {
      allowed: true,
      remaining: max_per_minute - 1,
      reset_time: now + windowMs
    };
  }
  
  if (record.count >= max_per_minute) {
    return {
      allowed: false,
      remaining: 0,
      reset_time: record.window_start + windowMs
    };
  }
  
  record.count++;
  userRateLimits.set(key, record);
  
  return {
    allowed: true,
    remaining: max_per_minute - record.count,
    reset_time: record.window_start + windowMs
  };
}

/**
 * OAuth security middleware for our analytics endpoints
 */
export async function oauthSecurityMiddleware(
  request: Request,
  endpoint: string
): Promise<{
  allowed: boolean;
  user_id?: string;
  error?: string;
  headers?: Record<string, string>;
}> {
  
  // Validate OAuth session
  const sessionValidation = await validateOAuthSession(request);
  
  if (!sessionValidation.valid) {
    return {
      allowed: false,
      error: `Authentication required: ${sessionValidation.error}`
    };
  }
  
  const user_id = sessionValidation.user_id!;
  
  // Check endpoint permissions
  const permission = await checkAnalyticsPermission(user_id, endpoint);
  
  if (!permission.allowed) {
    return {
      allowed: false,
      error: `Access denied: ${permission.reason}`
    };
  }
  
  // Check rate limiting
  const rateLimit = checkUserRateLimit(user_id, endpoint);
  
  if (!rateLimit.allowed) {
    return {
      allowed: false,
      error: 'Rate limit exceeded',
      headers: {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimit.reset_time.toString()
      }
    };
  }
  
  return {
    allowed: true,
    user_id,
    headers: {
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': rateLimit.reset_time.toString()
    }
  };
}

/**
 * Rate limits by endpoint for authenticated users
 */
export const OAUTH_RATE_LIMITS: Record<string, number> = {
  'percolation-analysis': 3,    // Heavy computation - 3/minute
  'sheaf-fusion': 5,           // Medium computation - 5/minute  
  'test-clustering': 10,       // Light computation - 10/minute
  'create-test-data': 1        // Admin only - 1/minute
};

/**
 * Log analytics usage for user
 */
export async function logAnalyticsUsage(
  user_id: string,
  endpoint: string,
  success: boolean,
  computation_time_ms?: number
): Promise<void> {
  
  try {
    
    // Could track usage stats in database
    // await db.analytics_usage.create({
    //   data: {
    //     user_id,
    //     endpoint,
    //     success,
    //     computation_time_ms,
    //     timestamp: new Date()
    //   }
    // });
    
  } catch (error) {
  }
}