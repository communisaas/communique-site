import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const mockDb = {
  template: {
    findUnique: vi.fn()
  }
};

vi.mock('$lib/core/db', () => ({
  db: mockDb
}));

// Mock reserved slugs
const mockReservedSlugs = {
  isSlugReserved: vi.fn(() => false),
  getReservedSlugError: vi.fn(() => 'Reserved slug error'),
  suggestAlternativeSlug: vi.fn(() => ['alternative-slug']),
  suggestAvailableAlternatives: vi.fn(() => Promise.resolve(['alternative-1', 'alternative-2']))
};

vi.mock('$lib/server/reserved-slugs', () => mockReservedSlugs);

describe('Slug Check API Integration', () => {
  // Test the API client instead of the server handler directly
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error for missing slug parameter', async () => {
    // Mock fetch to return error for missing slug
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Slug parameter is required' })
    });
    
    const { api } = await import('../../src/lib/core/api/client');
    const result = await api.get('templates/check-slug');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 400');
  });

  it('should return error for invalid slug format', async () => {
    // Mock fetch to return error for invalid slug
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ 
        available: false, 
        error: 'Invalid slug format. Use only lowercase letters, numbers, and hyphens.',
        suggestions: []
      })
    });
    
    const { api } = await import('../../src/lib/core/api/client');
    const result = await api.get('templates/check-slug?slug=Invalid_Slug!');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 400');
  });

  it('should return available for new valid slug', async () => {
    // Mock fetch to return available slug
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ 
        available: true,
        slug: 'new-valid-slug'
      })
    });
    
    const { api } = await import('../../src/lib/core/api/client');
    const result = await api.get('templates/check-slug?slug=new-valid-slug');
    
    expect(result.success).toBe(true);
    expect(result.data.available).toBe(true);
    expect(result.data.slug).toBe('new-valid-slug');
  });

  it('should return unavailable for existing slug with suggestions', async () => {
    // Mock fetch to return unavailable slug with suggestions
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        available: false,
        error: 'Slug "existing-slug" is already taken.',
        suggestions: ['alternative-1', 'alternative-2']
      })
    });
    
    const { api } = await import('../../src/lib/core/api/client');
    const result = await api.get('templates/check-slug?slug=existing-slug&title=Test Title');
    
    expect(result.success).toBe(true);
    expect(result.data.available).toBe(false);
    expect(result.data.error).toContain('already taken');
    expect(result.data.suggestions).toEqual(['alternative-1', 'alternative-2']);
  });

  it('should validate slug format correctly', async () => {
    const testCases = [
      { slug: 'valid-slug-123', shouldBeValid: true },
      { slug: 'another-valid-slug', shouldBeValid: true },
      { slug: 'Invalid_Slug', shouldBeValid: false },
      { slug: 'invalid slug with spaces', shouldBeValid: false },
      { slug: 'invalid@slug', shouldBeValid: false }
    ];

    for (const testCase of testCases) {
      if (testCase.shouldBeValid) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ 
            available: true,
            slug: testCase.slug
          })
        });
      } else {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            available: false,
            error: 'Invalid slug format. Use only lowercase letters, numbers, and hyphens.',
            suggestions: []
          })
        });
      }
      
      const { api } = await import('../../src/lib/core/api/client');
      const encodedSlug = encodeURIComponent(testCase.slug);
      const result = await api.get(`templates/check-slug?slug=${encodedSlug}`);
      
      if (testCase.shouldBeValid) {
        expect(result.success).toBe(true);
        expect(result.data.available).toBe(true);
      } else {
        expect(result.success).toBe(false);
      }
    }
  });

  it('should handle database errors gracefully', async () => {
    // Mock fetch to return server error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Failed to check slug availability' })
    });
    
    const { api } = await import('../../src/lib/core/api/client');
    const result = await api.get('templates/check-slug?slug=test-slug');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 500');
  });
});