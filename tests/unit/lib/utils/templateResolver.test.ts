import { describe, it, expect, vi, beforeEach } from 'vitest';
import { templateResolver } from './templateResolver';

/**
 * TEMPLATE RESOLVER UTILITY TESTS
 * 
 * Critical business logic: Resolves template URLs and handles routing.
 * Revenue impact: CRITICAL - All template interactions flow through this
 */
describe('Template Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL Slug Resolution', () => {
    it('should resolve valid template slugs', () => {
      const validSlugs = [
        'climate-action-now',
        'healthcare-reform-2024', 
        'infrastructure-investment',
        'education-funding-boost'
      ];
      
      validSlugs.forEach(slug => {
        const result = templateResolver.resolveSlug(slug);
        expect(result.isValid).toBe(true);
        expect(result.slug).toBe(slug);
        expect(result.templateId).toBeTruthy();
      });
    });

    it('should handle invalid slugs gracefully', () => {
      const invalidSlugs = [
        '',
        'invalid-characters-#$%',
        'too-long-' + 'a'.repeat(100),
        'spaces not allowed',
        null,
        undefined
      ];
      
      invalidSlugs.forEach(slug => {
        const result = templateResolver.resolveSlug(slug as any);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should normalize slug variations', () => {
      const variations = [
        { input: 'Climate-Action-Now', expected: 'climate-action-now' },
        { input: 'HEALTHCARE_REFORM', expected: 'healthcare-reform' }, 
        { input: 'Education   Funding', expected: 'education-funding' },
        { input: 'infra$structure@invest', expected: 'infrastructure-invest' }
      ];
      
      variations.forEach(({ input, expected }) => {
        const result = templateResolver.normalizeSlug(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Template Metadata Resolution', () => {
    it('should resolve template metadata from slug', async () => {
      const slug = 'climate-action-now';
      const mockMetadata = {
        id: 'tpl_123456',
        title: 'Climate Action Now',
        description: 'Urge Congress to act on climate change',
        category: 'Environment',
        deliveryMethod: 'both' as const,
        tags: ['climate', 'environment', 'congress'],
        difficulty: 'beginner' as const,
        estimatedTime: 5,
        metrics: {
          sent: 1247,
          opened: 892,
          clicked: 234,
          completed: 156
        }
      };
      
      // Mock the template lookup
      vi.spyOn(templateResolver, 'fetchTemplateMetadata').mockResolvedValue(mockMetadata);
      
      const result = await templateResolver.resolveMetadata(slug);
      
      expect(result).toEqual(mockMetadata);
      expect(templateResolver.fetchTemplateMetadata).toHaveBeenCalledWith(slug);
    });

    it('should handle metadata resolution failures', async () => {
      const slug = 'non-existent-template';
      
      vi.spyOn(templateResolver, 'fetchTemplateMetadata').mockRejectedValue(
        new Error('Template not found')
      );
      
      await expect(templateResolver.resolveMetadata(slug)).rejects.toThrow('Template not found');
    });

    it('should cache metadata for performance', async () => {
      const slug = 'cached-template';
      const metadata = { id: 'cached_123', title: 'Cached Template' };
      
      vi.spyOn(templateResolver, 'fetchTemplateMetadata').mockResolvedValue(metadata);
      
      // First call
      await templateResolver.resolveMetadata(slug);
      // Second call (should use cache)
      await templateResolver.resolveMetadata(slug);
      
      expect(templateResolver.fetchTemplateMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('Template Availability Checking', () => {
    it('should check template availability', async () => {
      const availableTemplate = 'active-template';
      const unavailableTemplate = 'archived-template';
      
      vi.spyOn(templateResolver, 'checkAvailability').mockImplementation(async (slug) => {
        return {
          available: slug === availableTemplate,
          reason: slug === availableTemplate ? null : 'Template archived',
          alternativeSuggestions: slug === availableTemplate ? [] : ['similar-template-1']
        };
      });
      
      const availableResult = await templateResolver.checkAvailability(availableTemplate);
      expect(availableResult.available).toBe(true);
      
      const unavailableResult = await templateResolver.checkAvailability(unavailableTemplate);
      expect(unavailableResult.available).toBe(false);
      expect(unavailableResult.reason).toBe('Template archived');
      expect(unavailableResult.alternativeSuggestions).toContain('similar-template-1');
    });

    it('should handle seasonal/date-based availability', async () => {
      const seasonalTemplate = 'earth-day-action';
      
      // Mock date to be outside of Earth Day season
      const mockDate = new Date('2024-12-01');
      vi.setSystemTime(mockDate);
      
      vi.spyOn(templateResolver, 'checkSeasonalAvailability').mockReturnValue({
        available: false,
        nextAvailableDate: new Date('2025-04-01'),
        reason: 'Template available during Earth Day season (April)'
      });
      
      const result = await templateResolver.checkSeasonalAvailability(seasonalTemplate);
      expect(result.available).toBe(false);
      expect(result.nextAvailableDate).toEqual(new Date('2025-04-01'));
    });
  });

  describe('URL Generation', () => {
    it('should generate canonical template URLs', () => {
      const templates = [
        { slug: 'climate-action', expected: '/climate-action' },
        { slug: 'healthcare-reform', expected: '/healthcare-reform' },
        { slug: 'education-funding', expected: '/education-funding' }
      ];
      
      templates.forEach(({ slug, expected }) => {
        const url = templateResolver.generateUrl(slug);
        expect(url).toBe(expected);
      });
    });

    it('should generate URLs with tracking parameters', () => {
      const slug = 'climate-action';
      const trackingParams = {
        source: 'twitter',
        campaign: 'climate-week-2024',
        medium: 'social'
      };
      
      const url = templateResolver.generateUrl(slug, trackingParams);
      expect(url).toContain('/climate-action');
      expect(url).toContain('source=twitter');
      expect(url).toContain('campaign=climate-week-2024');
      expect(url).toContain('medium=social');
    });

    it('should generate share URLs', () => {
      const slug = 'climate-action';
      const shareData = {
        platform: 'twitter' as const,
        customMessage: 'Join me in taking action on climate change!'
      };
      
      const shareUrl = templateResolver.generateShareUrl(slug, shareData);
      expect(shareUrl).toContain('twitter.com');
      expect(shareUrl).toContain(encodeURIComponent(shareData.customMessage));
    });
  });

  describe('Template Categorization', () => {
    it('should categorize templates by topic', () => {
      const templates = [
        { slug: 'climate-action-now', expectedCategory: 'Environment' },
        { slug: 'healthcare-medicare-expansion', expectedCategory: 'Healthcare' },
        { slug: 'education-funding-increase', expectedCategory: 'Education' },
        { slug: 'infrastructure-repair-jobs', expectedCategory: 'Infrastructure' }
      ];
      
      templates.forEach(({ slug, expectedCategory }) => {
        const category = templateResolver.categorizeBySlug(slug);
        expect(category).toBe(expectedCategory);
      });
    });

    it('should handle uncategorized templates', () => {
      const uncategorizedSlugs = [
        'random-topic-xyz',
        'new-experimental-template'
      ];
      
      uncategorizedSlugs.forEach(slug => {
        const category = templateResolver.categorizeBySlug(slug);
        expect(category).toBe('General');
      });
    });
  });

  describe('Related Template Suggestions', () => {
    it('should suggest related templates', async () => {
      const baseSlug = 'climate-action-now';
      const mockSuggestions = [
        { slug: 'renewable-energy-support', relevanceScore: 0.9 },
        { slug: 'carbon-tax-implementation', relevanceScore: 0.8 },
        { slug: 'green-new-deal-support', relevanceScore: 0.7 }
      ];
      
      vi.spyOn(templateResolver, 'findRelatedTemplates').mockResolvedValue(mockSuggestions);
      
      const suggestions = await templateResolver.findRelatedTemplates(baseSlug);
      
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].relevanceScore).toBe(0.9);
      expect(suggestions.every(s => s.relevanceScore > 0.5)).toBe(true);
    });

    it('should limit suggestion count', async () => {
      const baseSlug = 'healthcare-reform';
      const limit = 2;
      
      vi.spyOn(templateResolver, 'findRelatedTemplates').mockResolvedValue([
        { slug: 'medicare-expansion', relevanceScore: 0.9 },
        { slug: 'drug-pricing-reform', relevanceScore: 0.8 }
      ]);
      
      const suggestions = await templateResolver.findRelatedTemplates(baseSlug, limit);
      expect(suggestions).toHaveLength(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network failures gracefully', async () => {
      const slug = 'network-fail-template';
      
      vi.spyOn(templateResolver, 'fetchTemplateMetadata').mockRejectedValue(
        new Error('Network error')
      );
      
      const result = await templateResolver.resolveWithFallback(slug);
      expect(result.success).toBe(false);
      expect(result.fallbackData).toBeTruthy();
      expect(result.error).toContain('Network error');
    });

    it('should validate input parameters', () => {
      const invalidInputs = [null, undefined, '', ' ', 123, {}, []];
      
      invalidInputs.forEach(input => {
        expect(() => {
          templateResolver.resolveSlug(input as any);
        }).not.toThrow(); // Should handle gracefully, not throw
      });
    });

    it('should handle concurrent resolution requests', async () => {
      const slug = 'concurrent-template';
      const metadata = { id: 'concurrent_123', title: 'Concurrent Template' };
      
      vi.spyOn(templateResolver, 'fetchTemplateMetadata').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(metadata), 100))
      );
      
      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => 
        templateResolver.resolveMetadata(slug)
      );
      
      const results = await Promise.all(promises);
      
      // Should all return the same metadata
      results.forEach(result => {
        expect(result).toEqual(metadata);
      });
      
      // Should only make one actual API call due to deduplication
      expect(templateResolver.fetchTemplateMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance and Caching', () => {
    it('should implement LRU cache eviction', async () => {
      const cacheSize = 3;
      templateResolver.setCacheSize(cacheSize);
      
      // Fill cache beyond capacity
      const templates = ['template-1', 'template-2', 'template-3', 'template-4'];
      
      for (const slug of templates) {
        vi.spyOn(templateResolver, 'fetchTemplateMetadata').mockResolvedValue({ 
          id: slug, 
          title: slug 
        });
        await templateResolver.resolveMetadata(slug);
      }
      
      // First template should be evicted from cache
      const cacheStats = templateResolver.getCacheStats();
      expect(cacheStats.size).toBe(cacheSize);
      expect(cacheStats.hits).toBeGreaterThan(0);
      expect(cacheStats.misses).toBeGreaterThan(0);
    });

    it('should provide cache statistics', () => {
      const stats = templateResolver.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.hitRate).toBe('number');
    });
  });
});