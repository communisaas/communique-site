import { describe, it, expect, vi } from 'vitest';

// Test that verifies our API path fix works correctly
describe('Slug Check Frontend Integration', () => {
  it('should call the correct API endpoint without double /api', async () => {
    // Mock fetch to capture the actual URL being called
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ available: true, slug: 'test-slug' })
    });
    
    global.fetch = mockFetch;
    
    // Import the API client after mocking fetch
    const { api } = await import('../../src/lib/core/api/client');
    
    // This should call templates/check-slug (not /api/templates/check-slug)
    await api.get('templates/check-slug?slug=test-slug');
    
    // Verify the correct URL was called (should be /api/templates/check-slug, not /api/api/templates/check-slug)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^.*\/api\/templates\/check-slug\?slug=test-slug$/),
      expect.any(Object)
    );
    
    // Verify it's NOT calling the double /api path
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).not.toContain('/api/api/');
  });

  it('should handle slug availability response correctly', async () => {
    const mockResponse = { available: true, slug: 'available-slug' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const { api } = await import('../../src/lib/core/api/client');
    const result = await api.get('templates/check-slug?slug=available-slug');
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponse);
  });

  it('should handle slug unavailable response with suggestions', async () => {
    const mockResponse = { 
      available: false, 
      error: 'Slug "taken-slug" is already taken.',
      suggestions: ['taken-slug-2023', 'taken-slug-alt', 'support-taken-slug']
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const { api } = await import('../../src/lib/core/api/client');
    const result = await api.get('templates/check-slug?slug=taken-slug&title=My Campaign');
    
    expect(result.success).toBe(true);
    expect(result.data.available).toBe(false);
    expect(result.data.suggestions).toHaveLength(3);
  });
});