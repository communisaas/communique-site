import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeEmailFlow, generateMailtoUrl, launchEmail, type User, type EmailFlowResult } from './emailService';
import type { Template } from '$lib/types/template';

// Mock the template config extraction
vi.mock('$lib/types/templateConfig', () => ({
	extractRecipientEmails: vi.fn((config) => {
		const parsed = typeof config === 'string' ? JSON.parse(config) : config;
		return parsed?.emails || ['test@example.com'];
	})
}));

describe('EmailService', () => {
	// Mock template data
	const mockEmailTemplate: Template = {
		id: 'template-email-123',
		slug: 'test-email-template',
		title: 'Test Email Template',
		description: 'A test template for email delivery',
		category: 'Testing',
		type: 'advocacy',
		deliveryMethod: 'email',
		subject: 'Test Subject',
		message_body: 'Test message body',
		preview: 'Hello [Name], this is a test message from [Address].',
		metrics: JSON.stringify({ sent: 10, views: 50 }),
		delivery_config: JSON.stringify({ priority: 'normal' }),
		recipient_config: JSON.stringify({ emails: ['recipient@example.com', 'admin@example.com'] }),
		is_public: true,
		status: 'published',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	const mockCongressionalTemplate: Template = {
		...mockEmailTemplate,
		id: 'template-congress-123',
		slug: 'test-congressional-template',
		title: 'Test Congressional Template',
		deliveryMethod: 'both'
	};

	// Mock user data
	const mockUserComplete: User = {
		id: 'user-123',
		name: 'John Doe',
		street: '123 Main St',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102'
	};

	const mockUserIncomplete: User = {
		id: 'user-456',
		name: 'Jane Smith',
		street: null,
		city: null,
		state: null,
		zip: null
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('analyzeEmailFlow', () => {
		it('should require auth when user is null', () => {
			const result = analyzeEmailFlow(mockEmailTemplate, null);

			expect(result).toEqual({
				requiresAuth: true,
				nextAction: 'auth'
			});
		});

		it('should proceed to email for standard email template with any user', () => {
			const result = analyzeEmailFlow(mockEmailTemplate, mockUserIncomplete);

			expect(result).toEqual({
				requiresAuth: false,
				requiresAddress: false,
				mailtoUrl: expect.stringContaining('mailto:'),
				nextAction: 'email'
			});
		});

		it('should require address for congressional template with incomplete address', () => {
			const result = analyzeEmailFlow(mockCongressionalTemplate, mockUserIncomplete);

			expect(result).toEqual({
				requiresAuth: false,
				requiresAddress: true,
				nextAction: 'address'
			});
		});

		it('should proceed to email for congressional template with complete address', () => {
			const result = analyzeEmailFlow(mockCongressionalTemplate, mockUserComplete);

			expect(result).toEqual({
				requiresAuth: false,
				requiresAddress: false,
				mailtoUrl: expect.stringContaining('mailto:'),
				nextAction: 'email'
			});
		});

		it('should check all address fields for completeness', () => {
			const userMissingStreet = { ...mockUserComplete, street: null };
			const userMissingCity = { ...mockUserComplete, city: null };
			const userMissingState = { ...mockUserComplete, state: null };
			const userMissingZip = { ...mockUserComplete, zip: null };

			const testUsers = [userMissingStreet, userMissingCity, userMissingState, userMissingZip];

			testUsers.forEach(user => {
				const result = analyzeEmailFlow(mockCongressionalTemplate, user);
				expect(result.requiresAddress).toBe(true);
				expect(result.nextAction).toBe('address');
			});
		});

		it('should handle user with empty string fields as incomplete', () => {
			const userWithEmptyStrings: User = {
				id: 'user-789',
				name: '',
				street: '',
				city: '',
				state: '',
				zip: ''
			};

			const result = analyzeEmailFlow(mockCongressionalTemplate, userWithEmptyStrings);

			expect(result.requiresAddress).toBe(true);
			expect(result.nextAction).toBe('address');
		});
	});

	describe('generateMailtoUrl', () => {
		it('should generate mailto URL for email template', () => {
			const mailtoUrl = generateMailtoUrl(mockEmailTemplate, mockUserComplete);

            expect(mailtoUrl).toContain('mailto:recipient@example.com,admin@example.com');
            expect(mailtoUrl).toContain('subject=Test%20Email%20Template');
            expect(decodeURIComponent(mailtoUrl)).toContain('Test message body');
		});

		it('should generate congressional routing URL for congressional template', () => {
			const mailtoUrl = generateMailtoUrl(mockCongressionalTemplate, mockUserComplete);

            expect(mailtoUrl).toContain('mailto:congress+template-congress-123-user-123@communique.org');
            expect(mailtoUrl).toContain('subject=Test%20Congressional%20Template');
            expect(decodeURIComponent(mailtoUrl)).toContain('Test message body');
		});

		it('should handle anonymous user for congressional template', () => {
			const mailtoUrl = generateMailtoUrl(mockCongressionalTemplate, null);

			expect(mailtoUrl).toContain('mailto:congress+template-congress-123-anon@communique.org');
			expect(mailtoUrl).toContain('subject=Test%20Congressional%20Template');
		});

		it('should URL encode subject and body', () => {
            const templateWithSpecialChars: Template = {
                ...mockEmailTemplate,
                title: 'Test & Symbols!',
                message_body: 'Hello [Name], this has special characters: & < > " \''
            };

			const mailtoUrl = generateMailtoUrl(templateWithSpecialChars, mockUserComplete);

			expect(mailtoUrl).toContain('subject=Test%20%26%20Symbols!');
			expect(mailtoUrl).toContain('body=Hello%20John%20Doe');
			expect(mailtoUrl).toContain('special%20characters');
		});

		it('should fill template variables in body', () => {
            const templateWithVariables: Template = {
                ...mockEmailTemplate,
                message_body: 'Hello [Name], I live at [Address]. Writing to [Representative Name].'
            };

			const mailtoUrl = generateMailtoUrl(templateWithVariables, mockUserComplete);

			expect(decodeURIComponent(mailtoUrl)).toContain('Hello John Doe');
			expect(decodeURIComponent(mailtoUrl)).toContain('123 Main St, San Francisco, CA 94102');
			expect(decodeURIComponent(mailtoUrl)).toContain('Representative');
		});

		it('should handle empty preview gracefully', () => {
			const templateWithoutPreview: Template = {
				...mockEmailTemplate,
				preview: ''
			};

			const mailtoUrl = generateMailtoUrl(templateWithoutPreview, mockUserComplete);

			expect(mailtoUrl).toContain('body=');
		});

		it('should handle null preview gracefully', () => {
			const templateWithNullPreview: Template = {
				...mockEmailTemplate,
				preview: null as any
			};

			const mailtoUrl = generateMailtoUrl(templateWithNullPreview, mockUserComplete);

			expect(mailtoUrl).toContain('body=');
		});
	});

	describe('Template Variable Filling', () => {
		it('should replace [Name] with user name', () => {
            const templateWithName: Template = {
                ...mockEmailTemplate,
                message_body: 'Hello [Name], how are you?'
            };

			const mailtoUrl = generateMailtoUrl(templateWithName, mockUserComplete);
			const decodedUrl = decodeURIComponent(mailtoUrl);

			expect(decodedUrl).toContain('Hello John Doe, how are you?');
		});

		it('should replace [Address] with complete address', () => {
            const templateWithAddress: Template = {
                ...mockEmailTemplate,
                message_body: 'I live at [Address].'
            };

			const mailtoUrl = generateMailtoUrl(templateWithAddress, mockUserComplete);
			const decodedUrl = decodeURIComponent(mailtoUrl);

			expect(decodedUrl).toContain('I live at 123 Main St, San Francisco, CA 94102.');
		});

		it('should handle missing name gracefully', () => {
			const userWithoutName: User = {
				...mockUserComplete,
				name: null
			};

			const templateWithName: Template = {
				...mockEmailTemplate,
				preview: 'Hello [Name], how are you?'
			};

			const mailtoUrl = generateMailtoUrl(templateWithName, userWithoutName);
			const decodedUrl = decodeURIComponent(mailtoUrl);

			expect(decodedUrl).toContain('Hello , how are you?');
		});

		it('should remove address blocks when address is incomplete', () => {
            const templateWithAddressBlock: Template = {
                ...mockEmailTemplate,
                message_body: 'From:\n[Address]\n\nHello there.'
            };

			const mailtoUrl = generateMailtoUrl(templateWithAddressBlock, mockUserIncomplete);
			const decodedUrl = decodeURIComponent(mailtoUrl);

			expect(decodedUrl).toContain('From:\n\nHello there.');
		});

		it('should replace [Representative Name] with generic text', () => {
            const templateWithRep: Template = {
                ...mockEmailTemplate,
                message_body: 'Dear [Representative Name], I am writing to you.'
            };

			const mailtoUrl = generateMailtoUrl(templateWithRep, mockUserComplete);
			const decodedUrl = decodeURIComponent(mailtoUrl);

			expect(decodedUrl).toContain('Dear Representative, I am writing to you.');
		});

		it('should remove [Personal Connection] blocks', () => {
            const templateWithPersonalConnection: Template = {
                ...mockEmailTemplate,
                message_body: 'Dear Representative,\n\n[Personal Connection]\n\nThank you.'
            };

			const mailtoUrl = generateMailtoUrl(templateWithPersonalConnection, mockUserComplete);
			const decodedUrl = decodeURIComponent(mailtoUrl);

			expect(decodedUrl).toContain('Dear Representative,\n\nThank you.');
		});

		it('should clean up excessive newlines', () => {
            const templateWithExtraNewlines: Template = {
                ...mockEmailTemplate,
                message_body: 'Hello\n\n\n\n\nWorld'
            };

			const mailtoUrl = generateMailtoUrl(templateWithExtraNewlines, mockUserComplete);
			const decodedUrl = decodeURIComponent(mailtoUrl);

			expect(decodedUrl).toContain('Hello\n\nWorld');
		});
	});

	describe('launchEmail', () => {
		it('should set window.location.href to mailto URL', () => {
			// Mock window.location
			const mockLocation = {
				href: ''
			};
			Object.defineProperty(window, 'location', {
				value: mockLocation,
				writable: true
			});

			const mailtoUrl = 'mailto:test@example.com?subject=Test&body=Hello';
			launchEmail(mailtoUrl);

			expect(window.location.href).toBe(mailtoUrl);
		});

		it('should handle empty mailto URL', () => {
			const mockLocation = {
				href: ''
			};
			Object.defineProperty(window, 'location', {
				value: mockLocation,
				writable: true
			});

			launchEmail('');

			expect(window.location.href).toBe('');
		});
	});

	describe('Edge Cases', () => {
		it('should handle template without recipient_config', () => {
			const templateWithoutRecipients: Template = {
				...mockEmailTemplate,
				recipient_config: ''
			};

			const mailtoUrl = generateMailtoUrl(templateWithoutRecipients, mockUserComplete);

			expect(mailtoUrl).toContain('mailto:test@example.com'); // Default from mock
		});

		it('should handle invalid JSON in recipient_config', () => {
			const templateWithInvalidConfig: Template = {
				...mockEmailTemplate,
				recipient_config: 'invalid json'
			};

			// This should not throw, and should use the mock default
			expect(() => {
				generateMailtoUrl(templateWithInvalidConfig, mockUserComplete);
			}).not.toThrow();
		});

		it('should handle very long template content', () => {
			const longContent = 'A'.repeat(10000);
			const templateWithLongContent: Template = {
				...mockEmailTemplate,
				preview: longContent
			};

			const mailtoUrl = generateMailtoUrl(templateWithLongContent, mockUserComplete);

			expect(mailtoUrl).toContain('mailto:');
			expect(mailtoUrl.length).toBeGreaterThan(1000);
		});

		it('should handle unicode characters in template', () => {
            const templateWithUnicode: Template = {
                ...mockEmailTemplate,
                title: 'Test 🚀 Émojis & Spëcial Chārs',
                message_body: 'Hello [Name] 👋, this has émojis 🎉 and spëcial chārs!'
            };

			const mailtoUrl = generateMailtoUrl(templateWithUnicode, mockUserComplete);

			expect(mailtoUrl).toContain('mailto:');
			expect(decodeURIComponent(mailtoUrl)).toContain('🚀');
			expect(decodeURIComponent(mailtoUrl)).toContain('émojis');
		});
	});

	describe('Integration with analyzeEmailFlow', () => {
		it('should provide consistent mailto URLs between analyzeEmailFlow and generateMailtoUrl', () => {
			const flowResult = analyzeEmailFlow(mockEmailTemplate, mockUserComplete);
			const directUrl = generateMailtoUrl(mockEmailTemplate, mockUserComplete);

			expect(flowResult.mailtoUrl).toBe(directUrl);
		});

		it('should not provide mailto URL when address is required', () => {
			const flowResult = analyzeEmailFlow(mockCongressionalTemplate, mockUserIncomplete);

			expect(flowResult.mailtoUrl).toBeUndefined();
			expect(flowResult.requiresAddress).toBe(true);
		});
	});
});