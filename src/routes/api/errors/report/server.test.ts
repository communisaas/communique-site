import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server.ts';

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn().mockImplementation((data, options) => ({ 
    body: JSON.stringify(data), 
    status: options?.status || 200 
  }))
}));

// Mock console methods
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

describe('Error Report API (/api/errors/report)', () => {
  let mockRequest: any;
  let mockLocals: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRequest = {
      json: vi.fn()
    };
    
    mockLocals = {
      user: {
        id: 'user123',
        name: 'Test User'
      },
      session: {
        id: 'session456'
      }
    };
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  describe('POST - Report Error', () => {
    it('processes valid error report successfully', async () => {
      const errorData = {
        error: {
          message: 'TypeError: Cannot read property of undefined',
          stack: 'Error: TypeError\n    at Component.svelte:42:15\n    at onClick (Button.svelte:12:8)',
          timestamp: 1640995200000,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          url: 'https://example.com/dashboard'
        },
        context: 'button_click',
        retryCount: 1
      };

      mockRequest.json.mockResolvedValue(errorData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Error reported successfully');
      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        message: 'TypeError: Cannot read property of undefined',
        stack: errorData.error.stack,
        context: 'button_click',
        timestamp: 1640995200000,
        userAgent: errorData.error.userAgent,
        url: errorData.error.url,
        userId: 'user123',
        additionalData: {
          retryCount: 1,
          sessionId: 'session456'
        }
      }));
    });

    it('handles minimal error data', async () => {
      const errorData = {
        error: {
          message: 'Network request failed'
        }
      };

      mockRequest.json.mockResolvedValue(errorData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        message: 'Network request failed',
        stack: undefined,
        context: 'unknown',
        userId: 'user123',
        additionalData: {
          retryCount: 0,
          sessionId: 'session456'
        }
      }));
    });

    it('handles anonymous user (no locals.user)', async () => {
      const errorData = {
        error: {
          message: 'Anonymous user error'
        },
        context: 'public_page'
      };

      mockRequest.json.mockResolvedValue(errorData);
      mockLocals.user = null;

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        message: 'Anonymous user error',
        context: 'public_page',
        userId: undefined
      }));
    });

    it('handles missing session', async () => {
      const errorData = {
        error: {
          message: 'Session-less error'
        }
      };

      mockRequest.json.mockResolvedValue(errorData);
      mockLocals.session = null;

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        additionalData: {
          retryCount: 0,
          sessionId: undefined
        }
      }));
    });

    it('validates error data structure', async () => {
      const invalidData = {
        error: null,
        context: 'test'
      };

      mockRequest.json.mockResolvedValue(invalidData);

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Invalid error data' },
        { status: 400 }
      );
    });

    it('validates error as object', async () => {
      const invalidData = {
        error: 'string error instead of object',
        context: 'test'
      };

      mockRequest.json.mockResolvedValue(invalidData);

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Invalid error data' },
        { status: 400 }
      );
    });

    it('handles missing error field', async () => {
      const invalidData = {
        context: 'test',
        retryCount: 1
      };

      mockRequest.json.mockResolvedValue(invalidData);

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Invalid error data' },
        { status: 400 }
      );
    });

    it('uses default values for missing error properties', async () => {
      const errorData = {
        error: {}  // Empty error object
      };

      mockRequest.json.mockResolvedValue(errorData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        message: 'Unknown error',
        stack: undefined,
        context: 'unknown',
        timestamp: expect.any(Number),
        userAgent: undefined,
        url: undefined,
        additionalData: {
          retryCount: 0,
          sessionId: 'session456'
        }
      }));
    });

    it('preserves custom timestamp when provided', async () => {
      const customTimestamp = 1609459200000; // Jan 1, 2021
      const errorData = {
        error: {
          message: 'Custom timestamp error',
          timestamp: customTimestamp
        }
      };

      mockRequest.json.mockResolvedValue(errorData);

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        timestamp: customTimestamp
      }));
    });

    it('sets timestamp to current time when not provided', async () => {
      const errorData = {
        error: {
          message: 'No timestamp error'
        }
      };

      mockRequest.json.mockResolvedValue(errorData);
      
      // Mock Date.now() to return predictable value
      const mockTimestamp = 1640995200000;
      const originalDateNow = Date.now;
      Date.now = vi.fn(() => mockTimestamp);

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        timestamp: mockTimestamp
      }));

      Date.now = originalDateNow;
    });

    it('handles JSON parsing errors', async () => {
      mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Failed to process error report' },
        { status: 500 }
      );
      expect(console.error).toHaveBeenCalledWith('Failed to process error report:', expect.any(Error));
    });

    it('handles retry count correctly', async () => {
      const errorData = {
        error: {
          message: 'Retry test error'
        },
        retryCount: 3
      };

      mockRequest.json.mockResolvedValue(errorData);

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Error reported:', expect.objectContaining({
        additionalData: expect.objectContaining({
          retryCount: 3
        })
      }));
    });

    it('includes complete error context', async () => {
      const errorData = {
        error: {
          message: 'Component rendering error',
          stack: 'Error: Component rendering error\n    at MyComponent.svelte:25:10',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          url: 'https://example.com/dashboard/settings'
        },
        context: 'component_render',
        retryCount: 0
      };

      mockRequest.json.mockResolvedValue(errorData);

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Error reported:', {
        message: 'Component rendering error',
        stack: 'Error: Component rendering error\n    at MyComponent.svelte:25:10',
        context: 'component_render',
        timestamp: expect.any(Number),
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        url: 'https://example.com/dashboard/settings',
        userId: 'user123',
        additionalData: {
          retryCount: 0,
          sessionId: 'session456'
        }
      });
    });

    it('does not log in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const errorData = {
        error: {
          message: 'Production error'
        }
      };

      mockRequest.json.mockResolvedValue(errorData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(console.error).not.toHaveBeenCalledWith('Error reported:', expect.anything());

      process.env.NODE_ENV = originalEnv;
    });
  });
});