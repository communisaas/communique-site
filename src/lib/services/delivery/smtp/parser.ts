/**
 * Email parsing and validation utilities
 */

import { type ParsedMail } from 'mailparser';
import { z } from 'zod';
import type { ParsedIncomingMessage } from '@/types';

// ============================================================================
// Validation Schemas
// ============================================================================

const EmailAddressSchema = z.string().email('Invalid email address');

const TemplateIdentifierSchema = z.string()
  .min(1, 'Template identifier cannot be empty')
  .max(100, 'Template identifier too long')
  .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid template identifier format');

const PersonalConnectionSchema = z.string()
  .max(500, 'Personal connection message too long')
  .optional();

const IncomingMessageSchema = z.object({
  senderEmail: EmailAddressSchema,
  templateIdentifier: TemplateIdentifierSchema,
  personalConnection: PersonalConnectionSchema,
  certifiedDelivery: z.boolean()
});

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse incoming email message into structured data
 */
export async function parseIncomingMessage(mail: ParsedMail): Promise<ParsedIncomingMessage> {
  try {
    // Extract sender email
    const senderEmail = extractSenderEmail(mail);
    
    // Extract template identifier from subject or body
    const templateIdentifier = extractTemplateIdentifier(mail);
    
    // Extract personal connection message if present
    const personalConnection = extractPersonalConnection(mail);
    
    // Determine if this is a certified delivery request
    const certifiedDelivery = isCertifiedDelivery(mail);
    
    // Validate the parsed data
    const validatedData = IncomingMessageSchema.parse({
      senderEmail,
      templateIdentifier,
      personalConnection,
      certifiedDelivery
    });
    
    return {
      ...validatedData,
      rawMessage: mail
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid message format', error.errors);
    }
    throw error;
  }
}

/**
 * Extract sender email address from parsed mail
 */
function extractSenderEmail(mail: ParsedMail): string {
  // Check 'from' field
  if (mail.from?.value?.[0]?.address) {
    return mail.from.value[0].address.toLowerCase();
  }
  
  // Check reply-to field as fallback
  if (mail.replyTo?.value?.[0]?.address) {
    return mail.replyTo.value[0].address.toLowerCase();
  }
  
  throw new ValidationError('No sender email address found');
}

/**
 * Extract template identifier from subject or body
 */
function extractTemplateIdentifier(mail: ParsedMail): string {
  // Check subject for template ID patterns
  if (mail.subject) {
    // Pattern 1: [template:slug] format
    const templateMatch = mail.subject.match(/\[template:([^\]]+)\]/i);
    if (templateMatch?.[1]) {
      return templateMatch[1].trim();
    }
    
    // Pattern 2: Template ID in parentheses
    const parenMatch = mail.subject.match(/\(([a-zA-Z0-9-_]+)\)/);
    if (parenMatch?.[1] && parenMatch[1].length > 3) {
      return parenMatch[1].trim();
    }
    
    // Pattern 3: After "Template:" or "ID:"
    const prefixMatch = mail.subject.match(/(?:template|id):\s*([a-zA-Z0-9-_]+)/i);
    if (prefixMatch?.[1]) {
      return prefixMatch[1].trim();
    }
  }
  
  // Check body for template identifier
  const bodyText = mail.text || mail.html || '';
  
  // Pattern 1: Template URL
  const urlMatch = bodyText.match(/communi(?:que)?\.(?:app|email)\/templates?\/([a-zA-Z0-9-_]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].trim();
  }
  
  // Pattern 2: Template ID line
  const idLineMatch = bodyText.match(/^template[:\s]+([a-zA-Z0-9-_]+)$/mi);
  if (idLineMatch?.[1]) {
    return idLineMatch[1].trim();
  }
  
  // Pattern 3: Hash-prefixed ID
  const hashMatch = bodyText.match(/#([a-zA-Z0-9-_]{4,})/);
  if (hashMatch?.[1]) {
    return hashMatch[1].trim();
  }
  
  throw new ValidationError('No template identifier found in message');
}

/**
 * Extract personal connection message from email body
 */
function extractPersonalConnection(mail: ParsedMail): string | undefined {
  const bodyText = mail.text || '';
  
  // Look for personal connection section markers
  const markers = [
    /personal\s*connection[:\s]+([\s\S]+?)(?:\n\n|\n---|\n===|$)/i,
    /why\s*this\s*matters[:\s]+([\s\S]+?)(?:\n\n|\n---|\n===|$)/i,
    /my\s*story[:\s]+([\s\S]+?)(?:\n\n|\n---|\n===|$)/i,
    /--- personal ---\n([\s\S]+?)(?:\n---|$)/i
  ];
  
  for (const marker of markers) {
    const match = bodyText.match(marker);
    if (match?.[1]) {
      const connection = match[1].trim();
      // Limit length and clean up
      return connection.substring(0, 500);
    }
  }
  
  // Check for quoted personal message
  const quotedMatch = bodyText.match(/"([^"]{10,500})"/);
  if (quotedMatch?.[1] && quotedMatch[1].length > 50) {
    return quotedMatch[1].trim();
  }
  
  return undefined;
}

/**
 * Determine if this is a certified delivery request
 */
function isCertifiedDelivery(mail: ParsedMail): boolean {
  // Check To addresses
  const toValue = Array.isArray(mail.to) ? mail.to : mail.to ? [mail.to] : [];
  const toAddresses = toValue.flatMap(to => 
    to.value?.map(addr => addr.address?.toLowerCase()).filter(Boolean) || []
  );
  const certifiedPatterns = [
    'congress@',
    'certified@',
    'cwc@',
    'delivery@'
  ];
  
  for (const address of toAddresses) {
    if (certifiedPatterns.some(pattern => address?.startsWith(pattern))) {
      return true;
    }
  }
  
  // Check subject for certified keywords
  const subject = mail.subject?.toLowerCase() || '';
  if (subject.includes('certified') || subject.includes('congress') || subject.includes('cwc')) {
    return true;
  }
  
  // Check headers for certified delivery flag
  const certifiedHeader = mail.headers?.get('x-certified-delivery');
  if (certifiedHeader === 'true' || certifiedHeader === '1') {
    return true;
  }
  
  return false;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate incoming message meets requirements
 */
export function validateMessage(message: ParsedIncomingMessage): void {
  // Validate email format
  if (!EmailAddressSchema.safeParse(message.senderEmail).success) {
    throw new ValidationError(`Invalid sender email: ${message.senderEmail}`);
  }
  
  // Validate template identifier
  if (!TemplateIdentifierSchema.safeParse(message.templateIdentifier).success) {
    throw new ValidationError(`Invalid template identifier: ${message.templateIdentifier}`);
  }
  
  // Validate personal connection if present
  if (message.personalConnection) {
    if (message.personalConnection.length > 500) {
      throw new ValidationError('Personal connection message exceeds 500 characters');
    }
    
    // Check for spam patterns
    if (containsSpamPatterns(message.personalConnection)) {
      throw new ValidationError('Personal connection message contains spam patterns');
    }
  }
  
  // Additional validations for certified delivery
  if (message.certifiedDelivery) {
    // Ensure we have minimal required data
    if (!message.senderEmail || !message.templateIdentifier) {
      throw new ValidationError('Certified delivery requires sender email and template identifier');
    }
  }
}

/**
 * Check for common spam patterns
 */
function containsSpamPatterns(text: string): boolean {
  const spamPatterns = [
    /\b(?:viagra|cialis|pharmacy|casino|lottery)\b/i,
    /\b(?:click here|act now|limited time|winner|congratulations)\b/i,
    /\${3,}|\b\d{4,}\s*(?:USD|dollars?)\b/i,
    /(?:http|https):\/\/[^\s]+\.(?:tk|ml|ga|cf)/i // Suspicious TLDs
  ];
  
  return spamPatterns.some(pattern => pattern.test(text));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract clean text from HTML content
 */
export function extractTextFromHtml(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Replace line breaks with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return text.trim();
}

/**
 * Sanitize user input for safe processing
 */
export function sanitizeInput(input: string): string {
  // Remove control characters except newlines and tabs
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit consecutive whitespace
  sanitized = sanitized.replace(/[ \t]{3,}/g, '  ');
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // Trim to reasonable length
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000) + '...';
  }
  
  return sanitized.trim();
}

// Custom ValidationError class
class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}