import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AISuggestionsService } from './ai-suggestions';

describe('AISuggestionsService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('getSuggestions', () => {
		it('should return mock suggestions for Personal Connection variable', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				'Personal Connection'
			);

			expect(suggestions).toHaveLength(3);
			expect(suggestions[0]).toEqual({
				id: 'connection-1',
				category: 'personal_story',
				text: 'As a parent of two young children, I see firsthand how this policy affects families like mine...',
				contextTags: ['family', 'personal'],
				effectivenessScore: 0.85
			});
			expect(suggestions[1]).toEqual({
				id: 'connection-2',
				category: 'reasoning',
				text: 'This issue matters deeply to me because it represents the values we want to pass on to the next generation...',
				contextTags: ['values', 'future'],
				effectivenessScore: 0.82
			});
			expect(suggestions[2]).toEqual({
				id: 'connection-3',
				category: 'example',
				text: 'Last year, when my neighbor lost her job due to this very issue, I realized we need systemic change...',
				contextTags: ['community', 'real-world'],
				effectivenessScore: 0.78
			});
		});

		it('should return empty array for unknown variable names', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				'Unknown Variable'
			);

			expect(suggestions).toEqual([]);
		});

		it('should handle user context parameter', async () => {
			const userContext = {
				userId: 'user-123',
				location: {
					city: 'San Francisco',
					state: 'CA',
					congressionalDistrict: 'CA-12'
				},
				writingStyle: {
					tone: 'formal' as const,
					length: 'detailed' as const
				},
				personalThemes: ['education', 'healthcare']
			};

			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				'Personal Connection',
				userContext
			);

			// Should still return suggestions (current implementation doesn't use context)
			expect(suggestions).toHaveLength(3);
		});

		it('should handle empty template ID', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'',
				'Personal Connection'
			);

			expect(suggestions).toHaveLength(3);
		});

		it('should handle null/undefined parameters gracefully', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				'Personal Connection',
				undefined
			);

			expect(suggestions).toHaveLength(3);
		});
	});

	describe('recordSuggestionUsage', () => {
		it('should record suggestion usage without errors', async () => {
			// This is a stub implementation, so we just verify it doesn't throw
			await expect(
				AISuggestionsService.recordSuggestionUsage(
					'connection-1',
					'test-template-id',
					'Personal Connection',
					'My personal experience with this issue...'
				)
			).resolves.toBeUndefined();
		});

		it('should handle empty parameters', async () => {
			await expect(
				AISuggestionsService.recordSuggestionUsage('', '', '', '')
			).resolves.toBeUndefined();
		});
	});

	describe('getPersonalizedPrompts', () => {
		it('should return prompts for Personal Connection variable', async () => {
			const prompts = await AISuggestionsService.getPersonalizedPrompts(
				'Personal Connection',
				'advocacy'
			);

			expect(prompts).toEqual([
				'Think about how this issue has personally affected you or someone you care about.',
				'Consider what values or principles drive your passion for this cause.',
				'Reflect on a specific moment when you realized this issue was important.',
				'What would happen to your community if this problem isn\'t addressed?'
			]);
		});

		it('should return empty array for unknown variable names', async () => {
			const prompts = await AISuggestionsService.getPersonalizedPrompts(
				'Unknown Variable',
				'general'
			);

			expect(prompts).toEqual([]);
		});

		it('should handle user context parameter', async () => {
			const userContext = {
				userId: 'user-123',
				writingStyle: {
					tone: 'casual' as const,
					length: 'concise' as const
				}
			};

			const prompts = await AISuggestionsService.getPersonalizedPrompts(
				'Personal Connection',
				'environment',
				userContext
			);

			// Should still return prompts (current implementation doesn't use context)
			expect(prompts).toHaveLength(4);
		});

		it('should handle different template categories', async () => {
			const categories = ['advocacy', 'policy', 'community', 'environment', 'healthcare'];
			
			for (const category of categories) {
				const prompts = await AISuggestionsService.getPersonalizedPrompts(
					'Personal Connection',
					category
				);
				expect(prompts).toHaveLength(4);
			}
		});
	});

	describe('updateUserWritingProfile', () => {
		it('should update user writing profile without errors', async () => {
			const writingData = {
				text: 'This is my personal story about healthcare access...',
				context: 'healthcare-advocacy',
				effectiveness: 0.85
			};

			// This is a stub implementation, so we just verify it doesn't throw
			await expect(
				AISuggestionsService.updateUserWritingProfile('user-123', writingData)
			).resolves.toBeUndefined();
		});

		it('should handle minimal writing data', async () => {
			const writingData = {
				text: 'Short message',
				context: 'general'
			};

			await expect(
				AISuggestionsService.updateUserWritingProfile('user-456', writingData)
			).resolves.toBeUndefined();
		});

		it('should handle empty parameters', async () => {
			const writingData = {
				text: '',
				context: ''
			};

			await expect(
				AISuggestionsService.updateUserWritingProfile('', writingData)
			).resolves.toBeUndefined();
		});

		it('should handle writing data with effectiveness score', async () => {
			const writingData = {
				text: 'Detailed personal story...',
				context: 'education-policy',
				effectiveness: 0.92
			};

			await expect(
				AISuggestionsService.updateUserWritingProfile('user-789', writingData)
			).resolves.toBeUndefined();
		});
	});

	describe('Suggestion Categories', () => {
		it('should include all expected suggestion categories', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				'Personal Connection'
			);

			const categories = suggestions.map(s => s.category);
			expect(categories).toContain('personal_story');
			expect(categories).toContain('reasoning');
			expect(categories).toContain('example');
		});

		it('should include context tags for all suggestions', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				'Personal Connection'
			);

			suggestions.forEach(suggestion => {
				expect(suggestion.contextTags).toBeDefined();
				expect(Array.isArray(suggestion.contextTags)).toBe(true);
				expect(suggestion.contextTags.length).toBeGreaterThan(0);
			});
		});

		it('should include effectiveness scores for all suggestions', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				'Personal Connection'
			);

			suggestions.forEach(suggestion => {
				expect(suggestion.effectivenessScore).toBeDefined();
				expect(typeof suggestion.effectivenessScore).toBe('number');
				expect(suggestion.effectivenessScore).toBeGreaterThan(0);
				expect(suggestion.effectivenessScore).toBeLessThanOrEqual(1);
			});
		});
	});

	describe('Static Method Behavior', () => {
		it('should be callable as static methods', () => {
			// Verify all methods are static and accessible
			expect(typeof AISuggestionsService.getSuggestions).toBe('function');
			expect(typeof AISuggestionsService.recordSuggestionUsage).toBe('function');
			expect(typeof AISuggestionsService.getPersonalizedPrompts).toBe('function');
			expect(typeof AISuggestionsService.updateUserWritingProfile).toBe('function');
		});

		it('should not require instantiation', () => {
			// Should be able to call methods without creating instance
			expect(() => {
				AISuggestionsService.getSuggestions('test', 'test');
			}).not.toThrow();
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long variable names', async () => {
			const longVariableName = 'A'.repeat(1000);
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				longVariableName
			);

			expect(suggestions).toEqual([]);
		});

		it('should handle special characters in variable names', async () => {
			const specialVariableName = '[Personal Connection]';
			const suggestions = await AISuggestionsService.getSuggestions(
				'test-template-id',
				specialVariableName
			);

			expect(suggestions).toEqual([]);
		});

		it('should handle numeric template IDs', async () => {
			const suggestions = await AISuggestionsService.getSuggestions(
				'123456',
				'Personal Connection'
			);

			expect(suggestions).toHaveLength(3);
		});
	});
});