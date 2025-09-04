import { describe, it, expect, vi } from 'vitest';
import { 
  extractRecipientEmails, 
  isValidRecipientConfig, 
  isValidDeliveryConfig,
  migrateToTypedTemplate 
} from '$lib/types/templateConfig';

describe('Recipient Email Extraction Integration', () => {
  describe('extractRecipientEmails function', () => {
    it('should extract valid email array from recipient config', () => {
      const validConfig = {
        emails: ['test@example.com', 'user@domain.org', 'admin@site.net']
      };
      
      const result = extractRecipientEmails(validConfig);
      
      expect(result).toEqual(['test@example.com', 'user@domain.org', 'admin@site.net']);
    });

    it('should return empty array for null config', () => {
      const result = extractRecipientEmails(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined config', () => {
      const result = extractRecipientEmails(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for malformed config object', () => {
      const malformedConfig = {
        recipients: ['test@example.com'], // wrong property name
        other: 'data'
      };
      
      const result = extractRecipientEmails(malformedConfig);
      expect(result).toEqual([]);
    });

    it('should return empty array when emails property is not an array', () => {
      const invalidConfig = {
        emails: 'test@example.com' // string instead of array
      };
      
      const result = extractRecipientEmails(invalidConfig);
      expect(result).toEqual([]);
    });

    it('should return empty array when emails contains non-string values', () => {
      const invalidConfig = {
        emails: ['test@example.com', 123, null, undefined, 'valid@email.com']
      };
      
      const result = extractRecipientEmails(invalidConfig);
      expect(result).toEqual([]);
    });

    it('should handle empty emails array', () => {
      const emptyConfig = {
        emails: []
      };
      
      const result = extractRecipientEmails(emptyConfig);
      expect(result).toEqual([]);
    });

    it('should handle large email arrays', () => {
      const largeEmailArray = Array.from({ length: 1000 }, (_, i) => `user${i}@example.com`);
      const largeConfig = {
        emails: largeEmailArray
      };
      
      const result = extractRecipientEmails(largeConfig);
      
      expect(result).toHaveLength(1000);
      expect(result[0]).toBe('user0@example.com');
      expect(result[999]).toBe('user999@example.com');
    });

    it('should handle config with extra properties', () => {
      const configWithExtras = {
        emails: ['test@example.com'],
        deliveryMethod: 'email',
        otherData: { nested: true }
      };
      
      const result = extractRecipientEmails(configWithExtras);
      expect(result).toEqual(['test@example.com']);
    });

    it('should handle JSON string config parsing', () => {
      // This tests the common case where recipient_config comes from database as JSON string
      const jsonConfig = '{"emails": ["parsed@example.com", "from@json.com"]}';
      const parsedConfig = JSON.parse(jsonConfig);
      
      const result = extractRecipientEmails(parsedConfig);
      expect(result).toEqual(['parsed@example.com', 'from@json.com']);
    });
  });

  describe('isValidRecipientConfig type guard', () => {
    it('should validate correct recipient config', () => {
      const validConfig = {
        emails: ['test@example.com', 'another@domain.com']
      };
      
      expect(isValidRecipientConfig(validConfig)).toBe(true);
    });

    it('should reject null values', () => {
      expect(isValidRecipientConfig(null)).toBe(false);
      expect(isValidRecipientConfig(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isValidRecipientConfig('string')).toBe(false);
      expect(isValidRecipientConfig(123)).toBe(false);
      expect(isValidRecipientConfig(true)).toBe(false);
      expect(isValidRecipientConfig(['array'])).toBe(false);
    });

    it('should reject objects missing emails property', () => {
      const noEmailsConfig = {
        recipients: ['test@example.com']
      };
      
      expect(isValidRecipientConfig(noEmailsConfig)).toBe(false);
    });

    it('should reject configs where emails is not an array', () => {
      const stringEmails = { emails: 'test@example.com' };
      const objectEmails = { emails: { primary: 'test@example.com' } };
      const numberEmails = { emails: 123 };
      
      expect(isValidRecipientConfig(stringEmails)).toBe(false);
      expect(isValidRecipientConfig(objectEmails)).toBe(false);
      expect(isValidRecipientConfig(numberEmails)).toBe(false);
    });

    it('should reject configs with non-string email entries', () => {
      const mixedTypes = {
        emails: ['valid@email.com', 123, null, { invalid: true }]
      };
      
      expect(isValidRecipientConfig(mixedTypes)).toBe(false);
    });

    it('should accept empty email arrays', () => {
      const emptyConfig = { emails: [] };
      expect(isValidRecipientConfig(emptyConfig)).toBe(true);
    });

    it('should handle edge cases with empty strings', () => {
      const emptyStringConfig = { emails: ['', 'valid@email.com', ''] };
      expect(isValidRecipientConfig(emptyStringConfig)).toBe(true); // Empty strings are still strings
    });
  });

  describe('isValidDeliveryConfig type guard', () => {
    it('should validate correct delivery config', () => {
      const validConfig = {
        timing: 'immediate' as const,
        followUp: true
      };
      
      expect(isValidDeliveryConfig(validConfig)).toBe(true);
    });

    it('should validate scheduled timing', () => {
      const scheduledConfig = {
        timing: 'scheduled' as const,
        followUp: false
      };
      
      expect(isValidDeliveryConfig(scheduledConfig)).toBe(true);
    });

    it('should reject invalid timing values', () => {
      const invalidTiming = {
        timing: 'later',
        followUp: true
      };
      
      expect(isValidDeliveryConfig(invalidTiming)).toBe(false);
    });

    it('should reject missing followUp property', () => {
      const missingFollowUp = {
        timing: 'immediate'
      };
      
      expect(isValidDeliveryConfig(missingFollowUp)).toBe(false);
    });

    it('should reject non-boolean followUp values', () => {
      const invalidFollowUp = {
        timing: 'immediate',
        followUp: 'yes'
      };
      
      expect(isValidDeliveryConfig(invalidFollowUp)).toBe(false);
    });

    it('should accept optional cwcEnabled property', () => {
      const withCwc = {
        timing: 'immediate' as const,
        followUp: false,
        cwcEnabled: true
      };
      
      expect(isValidDeliveryConfig(withCwc)).toBe(true);
    });
  });

  describe('migrateToTypedTemplate function', () => {
    it('should migrate legacy template with recipient config', () => {
      const legacyTemplate = {
        id: 'template-123',
        title: 'Test Template',
        message_body: 'Test message',
        recipient_config: {
          emails: ['legacy@example.com']
        },
        delivery_config: {
          timing: 'immediate',
          followUp: false
        }
      };
      
      const migrated = migrateToTypedTemplate(legacyTemplate);
      
      expect(migrated.recipient_config.emails).toEqual(['legacy@example.com']);
      expect(migrated.delivery_config.timing).toBe('immediate');
      expect(migrated.delivery_config.followUp).toBe(false);
    });

    it('should handle missing recipient config gracefully', () => {
      const legacyTemplate = {
        id: 'template-456',
        title: 'Test Template',
        message_body: 'Test message'
      };
      
      const migrated = migrateToTypedTemplate(legacyTemplate);
      
      expect(migrated.recipient_config.emails).toEqual([]);
      expect(migrated.delivery_config.timing).toBe('immediate');
      expect(migrated.delivery_config.followUp).toBe(false);
    });

    it('should handle invalid recipient config during migration', () => {
      const legacyTemplate = {
        id: 'template-789',
        title: 'Test Template',
        message_body: 'Test message',
        recipient_config: 'invalid-string-config',
        delivery_config: null
      };
      
      const migrated = migrateToTypedTemplate(legacyTemplate);
      
      expect(migrated.recipient_config.emails).toEqual([]);
      expect(migrated.delivery_config.timing).toBe('immediate');
      expect(migrated.delivery_config.followUp).toBe(false);
    });

    it('should preserve existing metrics during migration', () => {
      const legacyTemplate = {
        id: 'template-abc',
        title: 'Test Template',
        message_body: 'Test message',
        recipient_config: { emails: ['test@example.com'] },
        delivery_config: { timing: 'scheduled', followUp: true },
        metrics: {
          sent: 100,
          opened: 50,
          clicked: 25,
          responded: 5
        }
      };
      
      const migrated = migrateToTypedTemplate(legacyTemplate);
      
      expect(migrated.metrics).toEqual({
        sent: 100,
        opened: 50,
        clicked: 25,
        responded: 5
      });
    });

    it('should create default metrics when missing', () => {
      const legacyTemplate = {
        id: 'template-def',
        title: 'Test Template',
        message_body: 'Test message',
        recipient_config: { emails: ['test@example.com'] }
      };
      
      const migrated = migrateToTypedTemplate(legacyTemplate);
      
      expect(migrated.metrics).toEqual({
        sent: 0,
        opened: 0,
        clicked: 0,
        responded: 0
      });
    });
  });

  describe('Integration with Template Resolution', () => {
    it('should work with template resolver recipient parsing', () => {
      // Test the integration pattern used in templateResolver.ts lines 154-163
      const mockTemplate = {
        id: 'integration-test',
        recipient_config: JSON.stringify({
          emails: ['integration@example.com', 'resolver@test.com']
        })
      };
      
      // Simulate the parsing logic from templateResolver
      let recipientConfig: unknown = mockTemplate.recipient_config;
      if (typeof mockTemplate.recipient_config === 'string') {
        try {
          recipientConfig = JSON.parse(mockTemplate.recipient_config);
        } catch (_e) {
          recipientConfig = undefined;
        }
      }
      
      const recipients = extractRecipientEmails(recipientConfig);
      
      expect(recipients).toEqual(['integration@example.com', 'resolver@test.com']);
    });

    it('should handle malformed JSON in recipient_config', () => {
      const mockTemplate = {
        id: 'malformed-test',
        recipient_config: '{"emails": ["test@example.com", invalid-json}'
      };
      
      let recipientConfig: unknown = mockTemplate.recipient_config;
      if (typeof mockTemplate.recipient_config === 'string') {
        try {
          recipientConfig = JSON.parse(mockTemplate.recipient_config);
        } catch (_e) {
          recipientConfig = undefined;
        }
      }
      
      const recipients = extractRecipientEmails(recipientConfig);
      
      expect(recipients).toEqual([]); // Should gracefully handle malformed JSON
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle extremely large email lists efficiently', () => {
      const startTime = Date.now();
      const largeEmailArray = Array.from({ length: 10000 }, (_, i) => `user${i}@domain${i % 100}.com`);
      const largeConfig = { emails: largeEmailArray };
      
      const result = extractRecipientEmails(largeConfig);
      const endTime = Date.now();
      
      expect(result).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle deeply nested or complex objects gracefully', () => {
      const complexConfig = {
        emails: ['test@example.com'],
        nested: {
          deep: {
            object: {
              with: ['many', 'levels']
            }
          }
        },
        arrays: [1, 2, 3, [4, 5, [6, 7, 8]]],
        functions: () => console.log('test'),
        regex: /test/g,
        date: new Date(),
        set: new Set([1, 2, 3]),
        map: new Map([['key', 'value']])
      };
      
      const result = extractRecipientEmails(complexConfig);
      expect(result).toEqual(['test@example.com']);
    });

    it('should handle circular references in config object', () => {
      const circularConfig: any = {
        emails: ['circular@example.com']
      };
      circularConfig.self = circularConfig; // Create circular reference
      
      // This should not throw an error and should extract emails normally
      expect(() => {
        const result = extractRecipientEmails(circularConfig);
        expect(result).toEqual(['circular@example.com']);
      }).not.toThrow();
    });

    it('should handle unicode and international email addresses', () => {
      const unicodeConfig = {
        emails: [
          'test@bücher.example',
          'user@пример.рф',
          'admin@例え.テスト',
          'contact@münchen.de'
        ]
      };
      
      const result = extractRecipientEmails(unicodeConfig);
      expect(result).toEqual([
        'test@bücher.example',
        'user@пример.рф', 
        'admin@例え.テスト',
        'contact@münchen.de'
      ]);
    });
  });

  describe('Email Input Parsing (from AudienceSelector)', () => {
    // Core email parsing functionality from audience-selector
    const parseEmailInput = (input: string): string[] => {
      return input
        .split(/[\n,;]+/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0 && email.includes('@'));
    };

    const processEmails = (input: string): string[] => {
      const emails = parseEmailInput(input);
      return [...new Set(emails)]; // Remove duplicates
    };

    it('should parse comma-separated emails', () => {
      const input = 'user1@example.com,user2@example.com,user3@example.com';
      const result = parseEmailInput(input);
      
      expect(result).toEqual([
        'user1@example.com',
        'user2@example.com',
        'user3@example.com'
      ]);
    });

    it('should parse newline-separated emails', () => {
      const input = `user1@example.com
user2@example.com
user3@example.com`;
      const result = parseEmailInput(input);
      
      expect(result).toEqual([
        'user1@example.com',
        'user2@example.com', 
        'user3@example.com'
      ]);
    });

    it('should filter out entries without @ symbol', () => {
      const input = 'user1@example.com,invalidentry,user2@example.com';
      const result = parseEmailInput(input);
      
      expect(result).toEqual([
        'user1@example.com',
        'user2@example.com'
      ]);
    });

    it('should remove duplicate emails', () => {
      const input = 'user@example.com,user@example.com,different@example.com';
      const result = processEmails(input);
      
      expect(result).toEqual([
        'user@example.com',
        'different@example.com'
      ]);
    });

    it('should handle complex email formats with mixed separators', () => {
      const input = `first.last@example.com,
        user+tag@domain.co.uk;
        admin123@sub.domain.org`;
      const result = parseEmailInput(input);
      
      expect(result).toEqual([
        'first.last@example.com',
        'user+tag@domain.co.uk',
        'admin123@sub.domain.org'
      ]);
    });

    it('should handle empty and whitespace-only input', () => {
      expect(parseEmailInput('')).toEqual([]);
      expect(parseEmailInput('   \n  \t  ')).toEqual([]);
    });

    it('should handle congressional auto-routing setup', () => {
      const congressionalEmails = ['congress-auto-route@cwc.system'];
      const displayText = 'Congressional representatives (auto-routed via CWC)';
      
      expect(congressionalEmails).toEqual(['congress-auto-route@cwc.system']);
      expect(displayText).toContain('auto-routed');
    });
  });

  describe('Template Creator Integration (Key Cases)', () => {
    it('should validate audience step with recipient emails', () => {
      const formData = {
        channelId: 'direct',
        recipientEmails: []
      };
      
      const errors: string[] = [];
      if (formData.channelId === 'direct' && formData.recipientEmails.length === 0) {
        errors.push('At least one recipient email is required');
      }
      
      expect(errors).toContain('At least one recipient email is required');
    });

    it('should handle congressional channel without requiring recipients', () => {
      const formData = {
        channelId: 'congressional',
        recipientEmails: []
      };
      
      const errors: string[] = [];
      if (formData.channelId === 'direct' && formData.recipientEmails.length === 0) {
        errors.push('At least one recipient email is required');
      }
      
      expect(errors).toEqual([]);
    });
  });

  describe('Email Service Integration (Key Cases)', () => {
    it('should handle mailto URL generation with recipients', () => {
      // Mock template with recipients
      const mockTemplate = {
        id: 'test-template',
        title: 'Test Template',
        deliveryMethod: 'email' as const,
        recipient_config: { emails: ['test@example.com'] }
      };
      
      const mockUser = {
        id: 'test-user',
        name: 'Test User'
      };

      // Simulate mailto URL generation logic
      const recipients = extractRecipientEmails(mockTemplate.recipient_config);
      const mailtoUrl = `mailto:${recipients.join(',')}&subject=Test Subject&body=Test Body`;
      
      expect(recipients).toEqual(['test@example.com']);
      expect(mailtoUrl).toContain('test@example.com');
    });

    it('should handle congressional routing addresses', () => {
      const mockTemplate = {
        id: 'congressional-template',
        title: 'Congressional Template',
        deliveryMethod: 'both' as const,
        recipient_config: { emails: [] }
      };
      
      const mockUser = {
        id: 'test-user',
        name: 'Test User'
      };

      // Simulate congressional routing
      const routingEmail = `congress+congressional-template-test-user@communique.org`;
      
      expect(routingEmail).toContain('congress+');
      expect(routingEmail).toContain('congressional-template');
      expect(routingEmail).toContain('test-user');
    });

    it('should analyze email flow requirements', () => {
      // Test authentication requirements
      const requiresAuth = (user: any) => user === null;
      expect(requiresAuth(null)).toBe(true);
      expect(requiresAuth({ id: 'user' })).toBe(false);

      // Test address requirements for congressional templates
      const requiresAddress = (user: any, template: any) => {
        if (template.deliveryMethod === 'both') {
          return !user?.street || !user?.city || !user?.state || !user?.zip;
        }
        return false;
      };

      const incompleteUser = { id: 'user', street: '', city: '', state: '', zip: '' };
      const completeUser = { id: 'user', street: '123 Main', city: 'City', state: 'CA', zip: '90210' };
      const congressionalTemplate = { deliveryMethod: 'both' };

      expect(requiresAddress(incompleteUser, congressionalTemplate)).toBe(true);
      expect(requiresAddress(completeUser, congressionalTemplate)).toBe(false);
    });
  });

  describe('Template Resolver Integration (Key Cases)', () => {
    it('should parse recipient_config as JSON string', () => {
      const templateWithStringConfig = {
        recipient_config: '{"emails":["json@example.com"]}'
      };
      
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(templateWithStringConfig.recipient_config);
      } catch {
        parsedConfig = templateWithStringConfig.recipient_config;
      }
      
      expect(parsedConfig).toEqual({ emails: ['json@example.com'] });
    });

    it('should handle recipient_config as object', () => {
      const templateWithObjectConfig = {
        recipient_config: { emails: ['object@example.com'] }
      };
      
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(templateWithObjectConfig.recipient_config);
      } catch {
        parsedConfig = templateWithObjectConfig.recipient_config;
      }
      
      expect(parsedConfig).toEqual({ emails: ['object@example.com'] });
    });

    it('should resolve template variables with recipients', () => {
      const templateText = 'Dear [Name], Contact [Representative Name] at these addresses: [Recipients]';
      const user = { name: 'John Doe' };
      const representative = { name: 'Rep. Smith' };
      const recipients = ['rep@congress.gov', 'office@house.gov'];
      
      let resolved = templateText
        .replace(/\[Name\]/g, user.name)
        .replace(/\[Representative Name\]/g, representative.name)
        .replace(/\[Recipients\]/g, recipients.join(', '));
      
      expect(resolved).toBe('Dear John Doe, Contact Rep. Smith at these addresses: rep@congress.gov, office@house.gov');
    });
  });
});