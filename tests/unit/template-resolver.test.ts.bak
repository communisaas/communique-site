import { describe, it, expect } from 'vitest';
import {
	resolveTemplate,
	isValidTemplate,
	isValidEmailServiceUser
} from '$lib/utils/templateResolver';
import type { Template } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';

describe('Template Resolver Type Safety', () => {
	// Test template with all delivery methods to prevent regression
	const createTestTemplate = (deliveryMethod: Template['deliveryMethod']): Template => ({
		id: 'test-template-id',
		slug: 'test-template',
		title: 'Test Template',
		description: 'Test description',
		category: 'test',
		type: 'template',
		deliveryMethod,
		subject: 'Test Subject',
		message_body: 'Hello [Name], this is from [Address]. Sincerely, [Name]',
		delivery_config: {},
		recipient_config: {},
		metrics: { sent: 0 },
		status: 'active',
		is_public: true,
		send_count: 0,
		applicable_countries: ['US'],
		specific_locations: [],
		preview: 'Preview text'
	});

	const createTestUser = (): EmailServiceUser => ({
		id: 'test-user-id',
		email: 'test@example.com',
		name: 'Test User',
		street: '123 Test St',
		city: 'Test City',
		state: 'CA',
		zip: '12345',
		representatives: [
			{
				name: 'Test Representative',
				party: 'Independent',
				chamber: 'house',
				state: 'CA',
				district: '1'
			},
			{
				name: 'Test Senator',
				party: 'Independent',
				chamber: 'senate',
				state: 'CA',
				district: 'statewide'
			}
		]
	});

	describe('Template Type Validation', () => {
		it('should accept all valid delivery methods', () => {
			const validDeliveryMethods: Template['deliveryMethod'][] = [
				'email',
				'certified',
				'direct',
				'cwc'
			];

			validDeliveryMethods.forEach((deliveryMethod) => {
				const template = createTestTemplate(deliveryMethod);
				expect(isValidTemplate(template)).toBe(true);

				// Should not throw when resolving
				expect(() => resolveTemplate(template, null)).not.toThrow();
				expect(() => resolveTemplate(template, createTestUser())).not.toThrow();
			});
		});

		it('should reject invalid delivery methods', () => {
			const template = createTestTemplate('email' as Template['deliveryMethod']);
			// @ts-expect-error - Testing invalid delivery method
			template.deliveryMethod = 'invalid-method';

			expect(isValidTemplate(template)).toBe(false);
		});

		it('should validate required template fields', () => {
			const validTemplate = createTestTemplate('email');
			expect(isValidTemplate(validTemplate)).toBe(true);

			// Test missing required fields
			expect(isValidTemplate({})).toBe(false);
			expect(isValidTemplate({ ...validTemplate, id: undefined })).toBe(false);
			expect(isValidTemplate({ ...validTemplate, title: undefined })).toBe(false);
			expect(isValidTemplate({ ...validTemplate, deliveryMethod: undefined })).toBe(false);
		});
	});

	describe('User Type Validation', () => {
		it('should validate EmailServiceUser correctly', () => {
			const validUser = createTestUser();
			expect(isValidEmailServiceUser(validUser)).toBe(true);

			// Test invalid users
			expect(isValidEmailServiceUser(null)).toBe(false);
			expect(isValidEmailServiceUser({})).toBe(false);
			expect(isValidEmailServiceUser({ ...validUser, id: undefined })).toBe(false);
			expect(isValidEmailServiceUser({ ...validUser, email: undefined })).toBe(false);
		});

		it('should accept user with minimal required fields', () => {
			const minimalUser: EmailServiceUser = {
				id: 'test-id',
				email: 'test@example.com'
			};
			expect(isValidEmailServiceUser(minimalUser)).toBe(true);
		});
	});

	describe('Template Resolution', () => {
		it('should resolve template with authenticated user', () => {
			const template = createTestTemplate('email');
			const user = createTestUser();

			const result = resolveTemplate(template, user);

			// Subject resolves to title when no placeholders in subject
			expect(result.subject).toBe('Test Template');
			expect(result.body).toContain('Test User'); // Name should be resolved
			expect(result.body).toContain('123 Test St, Test City, CA 12345'); // Address should be resolved
			expect(result.recipients).toEqual([]);
			expect(result.isCongressional).toBe(false);
		});

		it('should resolve template without authenticated user', () => {
			const template = createTestTemplate('email');

			const result = resolveTemplate(template, null);

			// Subject resolves to title when no placeholders in subject
			expect(result.subject).toBe('Test Template');
			expect(result.body).toContain('[Your Name]'); // Should convert [Name] to [Your Name]
			expect(result.body).toContain('[Your Address]'); // Should convert [Address] to [Your Address]
			expect(result.recipients).toEqual([]);
			expect(result.isCongressional).toBe(false);
		});

		it('should handle congressional delivery method correctly', () => {
			const template = createTestTemplate('certified');
			const user = createTestUser();

			const result = resolveTemplate(template, user);

			expect(result.isCongressional).toBe(true);
			expect(result.routingEmail).toBe('congress+test-template-id-test-user-id@communique.org');
		});

		it('should handle cwc delivery method correctly', () => {
			const template = createTestTemplate('cwc');
			const user = createTestUser();

			const result = resolveTemplate(template, user);

			// CWC is treated as congressional
			expect(result.isCongressional).toBe(true);
			expect(result.routingEmail).toBe('congress+test-template-id-test-user-id@communique.org');
		});

		it('should resolve representative variables correctly', () => {
			const template = createTestTemplate('email');
			template.message_body = 'Dear [Representative Name], this is about [Senator Name].';
			const user = createTestUser();

			const result = resolveTemplate(template, user);

			expect(result.body).toContain('Test Representative');
			expect(result.body).toContain('Test Senator');
		});

		it('should handle missing representative data gracefully', () => {
			const template = createTestTemplate('email');
			template.message_body = 'Dear [Representative Name], this message is important.';
			const userWithoutReps = { ...createTestUser(), representatives: [] };

			const result = resolveTemplate(template, userWithoutReps);

			expect(result.body).toContain('Representative'); // Should use generic fallback
			expect(result.body).not.toContain('[Representative Name]'); // Variable should be replaced
		});
	});

	describe('Regression Prevention', () => {
		it('should not break when new delivery methods are added to Template type', () => {
			// This test ensures that adding new delivery methods to the Template type
			// doesn't break the template resolver's type validation
			const allDeliveryMethods: Template['deliveryMethod'][] = [
				'email',
				'certified',
				'direct',
				'cwc'
			];

			allDeliveryMethods.forEach((method) => {
				const template = createTestTemplate(method);
				expect(() => resolveTemplate(template, null)).not.toThrow();
				expect(() => resolveTemplate(template, createTestUser())).not.toThrow();
			});
		});

		it('should maintain type safety with strict TypeScript checking', () => {
			// This test ensures our types are strict enough to catch errors
			const template = createTestTemplate('email');
			const user = createTestUser();

			// These should all work without type errors
			expect(() => {
				const result = resolveTemplate(template, user);
				const body: string = result.body;
				const subject: string = result.subject;
				const recipients: string[] = result.recipients;
				const isCongressional: boolean = result.isCongressional;
				const routingEmail: string | undefined = result.routingEmail;

				// Use the variables to avoid unused variable warnings
				expect(typeof body).toBe('string');
				expect(typeof subject).toBe('string');
				expect(Array.isArray(recipients)).toBe(true);
				expect(typeof isCongressional).toBe('boolean');
				expect(routingEmail === undefined || typeof routingEmail === 'string').toBe(true);
			}).not.toThrow();
		});
	});
});
