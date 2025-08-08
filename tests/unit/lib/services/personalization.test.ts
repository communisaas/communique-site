import { describe, it, expect } from 'vitest';
import { resolveVariables } from './personalization';
import type { User, representative } from '@prisma/client';

describe('resolveVariables', () => {
	// Mock user data
	const mockUser: User = {
		id: 'user-123',
		name: 'John Doe',
		email: 'john@example.com',
		street: '123 Main St',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102',
		phone: null,
		googleId: null,
		facebookId: null,
		twitterId: null,
		linkedinId: null,
		discordId: null,
		isVerified: false,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	// Mock representative data
	const mockRep: representative = {
		id: 'rep-123',
		name: 'Rep. Jane Smith',
		title: 'Representative',
		district: 'CA-12',
		party: 'D',
		email: 'jane.smith@house.gov',
		phone: '202-555-0100',
		office: '1234 Longworth HOB',
		website: 'https://janesmith.house.gov',
		twitter: '@RepJaneSmith',
		facebook: 'RepJaneSmith',
		youtube: 'RepJaneSmith',
		contactForm: 'https://janesmith.house.gov/contact',
		createdAt: new Date(),
		updatedAt: new Date()
	};

	describe('Variable Resolution', () => {
		it('should resolve [Name] variable', () => {
			const body = 'Hello [Name], this is a test message.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello John Doe, this is a test message.');
		});

		it('should resolve [Address] variable', () => {
			const body = 'My address is [Address].';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('My address is 123 Main St, San Francisco, CA, 94102.');
		});

		it('should resolve [Representative Name] variable', () => {
			const body = 'Dear [Representative Name], I am writing to you.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Dear Rep. Jane Smith, I am writing to you.');
		});

		it('should resolve multiple variables', () => {
			const body = 'Dear [Representative Name],\n\nMy name is [Name] and I live at [Address].';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Dear Rep. Jane Smith,\n\nMy name is John Doe and I live at 123 Main St, San Francisco, CA, 94102.');
		});
	});

	describe('Empty Variable Handling', () => {
		it('should handle empty name by removing variable', () => {
			const userWithoutName = { ...mockUser, name: null };
			const body = 'Hello [Name], this is a test.';
			const result = resolveVariables(body, userWithoutName, mockRep);
			expect(result).toBe('Hello , this is a test.');
		});

		it('should handle incomplete address by removing variable', () => {
			const userWithoutAddress = { ...mockUser, street: null, city: null };
			const body = 'My address is [Address].';
			const result = resolveVariables(body, userWithoutAddress, mockRep);
			expect(result).toBe('My address is .');
		});

		it('should handle missing representative by removing variable', () => {
			const body = 'Dear [Representative Name], hello.';
			const result = resolveVariables(body, mockUser, undefined);
			expect(result).toBe('Dear , hello.');
		});
	});

	describe('Block Variable Removal', () => {
		it('should remove [Name] when on its own line and empty', () => {
			const userWithoutName = { ...mockUser, name: null };
			const body = 'Dear Representative,\n\n[Name]\n\nThank you.';
			const result = resolveVariables(body, userWithoutName, mockRep);
			expect(result).toBe('Dear Representative,\n\nThank you.');
		});

		it('should remove [Address] when on its own line and empty', () => {
			const userWithoutAddress = { ...mockUser, street: null };
			const body = 'From:\n[Address]\n\nHello there.';
			const result = resolveVariables(body, userWithoutAddress, mockRep);
			expect(result).toBe('From:\n\nHello there.');
		});

		it('should remove [Personal Connection] blocks', () => {
			const body = 'Dear Representative,\n\n[Personal Connection]\n\nThank you.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Dear Representative,\n\nThank you.');
		});

		it('should handle variables with whitespace', () => {
			const userWithoutName = { ...mockUser, name: null };
			const body = 'Dear Representative,\n\n  [Name]  \n\nThank you.';
			const result = resolveVariables(body, userWithoutName, mockRep);
			expect(result).toBe('Dear Representative,\n\nThank you.');
		});

		it('should handle variables with tabs', () => {
			const userWithoutName = { ...mockUser, name: null };
			const body = 'Dear Representative,\n\n\t[Name]\t\n\nThank you.';
			const result = resolveVariables(body, userWithoutName, mockRep);
			expect(result).toBe('Dear Representative,\n\nThank you.');
		});
	});

	describe('Unresolved Variable Cleanup', () => {
		it('should remove unresolved block variables', () => {
			const body = 'Dear Representative,\n\n[Unknown Variable]\n\nThank you.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Dear Representative,\n\nThank you.');
		});

		it('should remove unresolved inline variables', () => {
			const body = 'Hello [Unknown Variable], how are you?';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello , how are you?');
		});

		it('should remove multiple unresolved variables', () => {
			const body = 'Hello [Unknown1] and [Unknown2], from [Unknown3].';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello  and , from .');
		});
	});

	describe('Newline Cleanup', () => {
		it('should clean up excessive newlines', () => {
			const body = 'Hello\n\n\n\n\nWorld';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello\n\nWorld');
		});

		it('should preserve double newlines', () => {
			const body = 'Hello\n\nWorld';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello\n\nWorld');
		});

		it('should trim final result', () => {
			const body = '  \n\nHello World\n\n  ';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello World');
		});
	});

	describe('Address Formatting', () => {
		it('should format complete address correctly', () => {
			const body = '[Address]';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('123 Main St, San Francisco, CA, 94102');
		});

		it('should handle partial address', () => {
			const partialUser = { ...mockUser, street: null };
			const body = '[Address]';
			const result = resolveVariables(body, partialUser, mockRep);
			expect(result).toBe('San Francisco, CA, 94102');
		});

		it('should handle address with missing city', () => {
			const partialUser = { ...mockUser, city: null };
			const body = '[Address]';
			const result = resolveVariables(body, partialUser, mockRep);
			expect(result).toBe('123 Main St, CA, 94102');
		});

		it('should handle address with only ZIP', () => {
			const partialUser = { ...mockUser, street: null, city: null, state: null };
			const body = '[Address]';
			const result = resolveVariables(body, partialUser, mockRep);
			expect(result).toBe('94102');
		});

		it('should remove address when completely empty', () => {
			const emptyUser = { ...mockUser, street: null, city: null, state: null, zip: null };
			const body = 'Address: [Address]';
			const result = resolveVariables(body, emptyUser, mockRep);
			expect(result).toBe('Address:');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty body', () => {
			const result = resolveVariables('', mockUser, mockRep);
			expect(result).toBe('');
		});

		it('should handle body with only variables', () => {
			const body = '[Name]\n[Address]\n[Representative Name]';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('John Doe\n123 Main St, San Francisco, CA, 94102\nRep. Jane Smith');
		});

		it('should handle repeated variables', () => {
			const body = '[Name] and [Name] are the same person.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('John Doe and John Doe are the same person.');
		});

		it('should handle variables with special regex characters', () => {
			// Variables contain brackets which are special regex characters
			const body = 'Hello [Name], your address [Address] is noted.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello John Doe, your address 123 Main St, San Francisco, CA, 94102 is noted.');
		});

		it('should handle Windows line endings', () => {
			const body = 'Hello\r\n[Name]\r\nGoodbye';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Hello\r\nJohn Doe\r\nGoodbye');
		});

		it('should handle mixed line endings', () => {
			const userWithoutName = { ...mockUser, name: null };
			const body = 'Hello\r\n\r\n[Name]\r\n\r\nGoodbye';
			const result = resolveVariables(body, userWithoutName, mockRep);
			expect(result).toBe('Hello\r\n\r\nGoodbye');
		});
	});

	describe('Personal Connection Variable', () => {
		it('should always remove [Personal Connection] as it is user-defined', () => {
			const body = 'Dear Representative,\n\n[Personal Connection]\n\nThank you.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('Dear Representative,\n\nThank you.');
		});

		it('should remove inline [Personal Connection] variables', () => {
			const body = 'My story: [Personal Connection] - that is why I care.';
			const result = resolveVariables(body, mockUser, mockRep);
			expect(result).toBe('My story:  - that is why I care.');
		});
	});

	describe('Variable Case Sensitivity', () => {
		it('should be case sensitive for variable names', () => {
			const body = 'Hello [name] and [NAME] and [Name].';
			const result = resolveVariables(body, mockUser, mockRep);
			// Only [Name] should be resolved
			expect(result).toBe('Hello [name] and [NAME] and John Doe.');
		});
	});
});