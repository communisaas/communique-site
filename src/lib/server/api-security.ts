import { db } from './db';
import crypto from 'crypto';

/**
 * API SECURITY LAYER - UNFUCK OUR ENDPOINTS
 * 
 * Rate limiting, auth, input validation, and attack prevention
 */

interface RateLimitRecord {
  ip: string;
  endpoint: string;
  count: number;
  window_start: number;
}

interface SecurityConfig {
  max_requests_per_minute: number;
  max_computation_time_ms: number;
  require_auth: boolean;
  allowed_ips?: string[];
}

// In-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Rate limiting middleware
 */
export function checkRateLimit(
  ip: string, 
  endpoint: string, 
  config: SecurityConfig
): { allowed: boolean; remaining: number; reset_time: number } {
  
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const key = `${ip}:${endpoint}`;
  
  const record = rateLimitStore.get(key);
  
  if (!record || now - record.window_start > windowMs) {
    // New window
    rateLimitStore.set(key, {
      ip,
      endpoint,
      count: 1,
      window_start: now
    });
    
    return {
      allowed: true,
      remaining: config.max_requests_per_minute - 1,
      reset_time: now + windowMs
    };
  }
  
  if (record.count >= config.max_requests_per_minute) {
    return {
      allowed: false,
      remaining: 0,
      reset_time: record.window_start + windowMs
    };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  
  return {
    allowed: true,
    remaining: config.max_requests_per_minute - record.count,
    reset_time: record.window_start + windowMs
  };
}

/**
 * Input sanitization and validation
 */
export function validateAndSanitizeInput(input: any, schema: any): {
  valid: boolean;
  sanitized?: any;
  errors?: string[];
} {
  
  const errors: string[] = [];
  const sanitized: any = {};
  
  // Basic type checking and sanitization
  Object.keys(schema).forEach(key => {
    const expectedType = schema[key].type;
    const required = schema[key].required || false;
    const maxLength = schema[key].maxLength || 1000;
    
    const value = input[key];
    
    if (required && (value === undefined || value === null)) {
      errors.push(`Missing required field: ${key}`);
      return;
    }
    
    if (value === undefined || value === null) {
      return; // Optional field not provided
    }
    
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field ${key} must be string`);
          break;
        }
        
        // Sanitize string
        const sanitizedString = value
          .replace(/[<>]/g, '') // Remove HTML tags
          .replace(/['"]/g, '') // Remove quotes
          .substring(0, maxLength); // Limit length
        
        sanitized[key] = sanitizedString;
        break;
        
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`Field ${key} must be number`);
          break;
        }
        
        const min = schema[key].min || -Infinity;
        const max = schema[key].max || Infinity;
        
        if (num < min || num > max) {
          errors.push(`Field ${key} must be between ${min} and ${max}`);
          break;
        }
        
        sanitized[key] = num;
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Field ${key} must be boolean`);
          break;
        }
        sanitized[key] = value;
        break;
        
      default:
        errors.push(`Unknown type for field ${key}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    sanitized: errors.length === 0 ? sanitized : undefined,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Computation timeout wrapper
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    operation()
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * API key validation (basic implementation)
 */
export function validateApiKey(apiKey: string): { valid: boolean; scope?: string[] } {
  
  // In production, check against database
  const validKeys = new Map([
    ['dev_key_analysis', ['percolation', 'sheaf_fusion']],
    ['dev_key_admin', ['percolation', 'sheaf_fusion', 'create_data', 'admin']],
    ['public_key_read', ['basic_stats']]
  ]);
  
  const scope = validKeys.get(apiKey);
  
  return {
    valid: scope !== undefined,
    scope
  };
}

/**
 * IP whitelist checking
 */
export function checkIpWhitelist(ip: string, whitelist?: string[]): boolean {
  if (!whitelist || whitelist.length === 0) {
    return true; // No whitelist = allow all
  }
  
  // Check for localhost/development
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) {
    return true;
  }
  
  return whitelist.includes(ip);
}

/**
 * Security middleware factory
 */
export function createSecurityMiddleware(endpoint: string, config: SecurityConfig) {
  return async (request: Request): Promise<{ 
    allowed: boolean; 
    error?: string; 
    headers?: Record<string, string> 
  }> => {
    
    // Extract IP (in production, use proper IP extraction)
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               '127.0.0.1';
    
    // Check IP whitelist
    if (!checkIpWhitelist(ip, config.allowed_ips)) {
      return {
        allowed: false,
        error: 'IP not whitelisted'
      };
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit(ip, endpoint, config);
    
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
    
    // Check API key if required
    if (config.require_auth) {
      const apiKey = request.headers.get('x-api-key');
      
      if (!apiKey) {
        return {
          allowed: false,
          error: 'API key required'
        };
      }
      
      const keyValidation = validateApiKey(apiKey);
      
      if (!keyValidation.valid) {
        return {
          allowed: false,
          error: 'Invalid API key'
        };
      }
      
      // Check if API key has permission for this endpoint
      const endpointPermission = endpoint.split('/').pop() || endpoint;
      if (!keyValidation.scope?.includes(endpointPermission) && 
          !keyValidation.scope?.includes('admin')) {
        return {
          allowed: false,
          error: 'Insufficient permissions'
        };
      }
    }
    
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.reset_time.toString()
      }
    };
  };
}

/**
 * Security configurations for different endpoints
 */
export const SECURITY_CONFIGS: Record<string, SecurityConfig> = {
  'percolation-analysis': {
    max_requests_per_minute: 5, // Expensive computation
    max_computation_time_ms: 30000, // 30 seconds max
    require_auth: true
  },
  
  'sheaf-fusion': {
    max_requests_per_minute: 10,
    max_computation_time_ms: 15000,
    require_auth: true
  },
  
  'test-clustering': {
    max_requests_per_minute: 20,
    max_computation_time_ms: 10000,
    require_auth: false // Allow for testing
  },
  
  'create-test-data': {
    max_requests_per_minute: 2, // Very restrictive
    max_computation_time_ms: 5000,
    require_auth: true,
    allowed_ips: ['127.0.0.1', '::1'] // Localhost only
  }
};

/**
 * Log security events
 */
export async function logSecurityEvent(
  event_type: 'rate_limit' | 'invalid_key' | 'ip_blocked' | 'successful_auth',
  ip: string,
  endpoint: string,
  details?: any
): Promise<void> {
  
  try {
    // In production, log to proper security monitoring system
    console.log(`[SECURITY] ${event_type}: ${ip} -> ${endpoint}`, details);
    
    // Could store in database for analysis
    // await db.security_log.create({ ... });
    
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}