import { describe, it, expect } from 'vitest';
import { 
  extractRecipientEmails, 
  isValidRecipientConfig, 
  isValidDeliveryConfig,
  migrateToTypedTemplate 
} from '$lib/types/templateConfig';

describe('Recipient Email Extraction Integration', () => {
  describe('extractRecipientEmails', () => {
    // Use parameterized tests for edge cases
    it.each([
      [null, []],
      [undefined, []],
      [{}, []],
      [{ emails: [] }, []],
      [{ recipients: ['test@example.com'] }, []], // wrong property
      [{ emails: 'test@example.com' }, []], // string instead of array
      [{ emails: ['test@example.com', 123, null] }, []], // mixed types
      [{ emails: ['valid@email.com'] }, ['valid@email.com']],
      [{ emails: ['a@b.com', 'c@d.org', 'e@f.net'] }, ['a@b.com', 'c@d.org', 'e@f.net']]
    ])('extracts emails from %p', (input, expected) => {
      expect(extractRecipientEmails(input)).toEqual(expected);
    });

    it('handles large email arrays efficiently', () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => `user${i}@example.com`);
      const config = { emails: largeArray };
      
      const result = extractRecipientEmails(config);
      expect(result).toHaveLength(100);
      expect(result[0]).toBe('user0@example.com');
      expect(result[99]).toBe('user99@example.com');
    });
  });

  describe('isValidRecipientConfig', () => {
    it.each([
      [null, false],
      [undefined, false],
      [{}, false],
      [{ emails: [] }, false],
      [{ emails: 'string' }, false],
      [{ emails: [123] }, false],
      [{ emails: ['valid@email.com'] }, true],
      [{ emails: ['a@b.com', 'c@d.org'] }, true]
    ])('validates %p as %p', (input, expected) => {
      expect(isValidRecipientConfig(input)).toBe(expected);
    });
  });

  describe('isValidDeliveryConfig', () => {
    const validBase = {
      channel: 'email',
      recipients: { emails: ['test@example.com'] }
    };

    it.each([
      [null, false],
      [undefined, false],
      [{}, false],
      [{ channel: 'email' }, false], // missing recipients
      [{ recipients: { emails: ['test@example.com'] } }, false], // missing channel
      [validBase, true],
      [{ ...validBase, channel: 'invalid' }, false],
      [{ ...validBase, recipients: null }, false],
      [{ ...validBase, recipients: { emails: [] } }, false]
    ])('validates delivery config %p as %p', (input, expected) => {
      expect(isValidDeliveryConfig(input)).toBe(expected);
    });

    it('validates allowed channels', () => {
      const channels = ['email', 'sms', 'web', 'api'];
      channels.forEach(channel => {
        const config = { ...validBase, channel };
        expect(isValidDeliveryConfig(config)).toBe(true);
      });
      
      expect(isValidDeliveryConfig({ ...validBase, channel: 'invalid' })).toBe(false);
    });
  });

  describe('migrateToTypedTemplate', () => {
    it('migrates legacy template to typed format', () => {
      const legacy = {
        id: 'template-123',
        title: 'Test Template',
        subject: 'Test Subject',
        message_body: 'Test message',
        recipient_emails: ['old@format.com']
      };

      const migrated = migrateToTypedTemplate(legacy);
      
      expect(migrated).toMatchObject({
        id: 'template-123',
        title: 'Test Template',
        subject: 'Test Subject',
        message_body: 'Test message',
        delivery: {
          channel: 'email',
          recipients: {
            emails: ['old@format.com']
          }
        }
      });
      expect(migrated.recipient_emails).toBeUndefined();
    });

    it('handles templates without legacy emails', () => {
      const modern = {
        id: 'template-456',
        title: 'Modern Template',
        delivery: {
          channel: 'email',
          recipients: {
            emails: ['modern@format.com']
          }
        }
      };

      const result = migrateToTypedTemplate(modern);
      expect(result).toEqual(modern);
    });

    it('preserves existing delivery config', () => {
      const template = {
        id: 'template-789',
        title: 'Template',
        recipient_emails: ['old@email.com'],
        delivery: {
          channel: 'sms',
          recipients: {
            phones: ['+1234567890']
          }
        }
      };

      const migrated = migrateToTypedTemplate(template);
      
      // Should preserve existing delivery config over legacy
      expect(migrated.delivery).toEqual({
        channel: 'sms',
        recipients: {
          phones: ['+1234567890']
        }
      });
      expect(migrated.recipient_emails).toBeUndefined();
    });
  });

  describe('Email Validation', () => {
    const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it.each([
      ['valid@email.com', true],
      ['user.name@domain.org', true],
      ['user+tag@example.co.uk', true],
      ['invalid', false],
      ['@domain.com', false],
      ['user@', false],
      ['user @domain.com', false],
      ['user@domain', false]
    ])('validates email %s as %p', (email, expected) => {
      expect(validateEmail(email)).toBe(expected);
    });
  });

  describe('Bulk Operations', () => {
    it('filters invalid emails from bulk list', () => {
      const emails = [
        'valid1@example.com',
        'invalid-email',
        'valid2@example.org',
        '@invalid.com',
        'valid3@example.net'
      ];

      const filtered = emails.filter(email => 
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      );

      expect(filtered).toEqual([
        'valid1@example.com',
        'valid2@example.org',
        'valid3@example.net'
      ]);
    });

    it('deduplicates email list', () => {
      const emails = [
        'duplicate@example.com',
        'unique@example.com',
        'duplicate@example.com',
        'another@example.com',
        'unique@example.com'
      ];

      const unique = [...new Set(emails)];
      
      expect(unique).toEqual([
        'duplicate@example.com',
        'unique@example.com',
        'another@example.com'
      ]);
    });

    it('normalizes email case', () => {
      const emails = [
        'Test@Example.COM',
        'test@example.com',
        'TEST@EXAMPLE.COM'
      ];

      const normalized = emails.map(e => e.toLowerCase());
      const unique = [...new Set(normalized)];
      
      expect(unique).toEqual(['test@example.com']);
    });
  });
});