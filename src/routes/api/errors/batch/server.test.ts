import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server.ts';

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn().mockImplementation((data, options) => ({ 
    body: JSON.stringify(data), 
    status: options?.status || 200 
  }))
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'batch-uuid-12345')
  },
  writable: true
});

// Mock console methods
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

describe('Batch Error Report API (/api/errors/batch)', () => {
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

  describe('POST - Batch Error Report', () => {
    it('processes batch of errors successfully', async () => {
      const batchData = {
        errors: [
          {
            message: 'First error',
            stack: 'Error: First error\n    at Component1.svelte:10:5',
            context: 'button_click',
            timestamp: 1640995200000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            url: 'https://example.com/page1'
          },
          {
            message: 'Second error',
            stack: 'Error: Second error\n    at Component2.svelte:20:10',
            context: 'form_submit',
            timestamp: 1640995300000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            url: 'https://example.com/page2',
            additionalData: {
              formId: 'contact-form'
            }
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('2 errors reported successfully');
      expect(console.error).toHaveBeenCalledWith('Batch error report (2 errors):', [
        {
          message: 'First error',
          stack: 'Error: First error\n    at Component1.svelte:10:5',
          context: 'button_click',
          timestamp: 1640995200000,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          url: 'https://example.com/page1',
          userId: 'user123',
          additionalData: {
            sessionId: 'session456',
            batchId: 'batch-uuid-12345'
          }
        },
        {
          message: 'Second error',
          stack: 'Error: Second error\n    at Component2.svelte:20:10',
          context: 'form_submit',
          timestamp: 1640995300000,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          url: 'https://example.com/page2',
          userId: 'user123',
          additionalData: {
            formId: 'contact-form',
            sessionId: 'session456',
            batchId: 'batch-uuid-12345'
          }
        }
      ]);
    });

    it('handles single error in batch', async () => {
      const batchData = {
        errors: [
          {
            message: 'Single error in batch',
            context: 'api_call'
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('1 errors reported successfully');
      expect(console.error).toHaveBeenCalledWith('Batch error report (1 errors):', [
        expect.objectContaining({
          message: 'Single error in batch',
          context: 'api_call',
          userId: 'user123'
        })
      ]);
    });

    it('validates errors array exists', async () => {
      const invalidData = {
        // Missing errors array
      };

      mockRequest.json.mockResolvedValue(invalidData);

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Invalid errors array' },
        { status: 400 }
      );
    });

    it('validates errors is an array', async () => {
      const invalidData = {
        errors: 'not an array'
      };

      mockRequest.json.mockResolvedValue(invalidData);

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Invalid errors array' },
        { status: 400 }
      );
    });

    it('validates errors array is not empty', async () => {
      const invalidData = {
        errors: []
      };

      mockRequest.json.mockResolvedValue(invalidData);

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Invalid errors array' },
        { status: 400 }
      );
    });

    it('enforces batch size limit', async () => {
      const largeBatch = {
        errors: Array(51).fill(0).map((_, i) => ({
          message: `Error ${i}`,
          context: 'batch_test'
        }))
      };

      mockRequest.json.mockResolvedValue(largeBatch);

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Batch too large (max 50 errors)' },
        { status: 400 }
      );
    });

    it('allows maximum batch size of 50', async () => {
      const maxBatch = {
        errors: Array(50).fill(0).map((_, i) => ({
          message: `Error ${i}`,
          context: 'max_batch_test'
        }))
      };

      mockRequest.json.mockResolvedValue(maxBatch);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('50 errors reported successfully');
    });

    it('applies default values to errors missing properties', async () => {
      const batchData = {
        errors: [
          {}, // Completely empty error
          {
            message: 'Partial error'
            // Missing other properties
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Batch error report (2 errors):', [
        expect.objectContaining({
          message: 'Unknown error',
          stack: undefined,
          context: 'unknown',
          timestamp: expect.any(Number),
          userAgent: undefined,
          url: undefined,
          userId: 'user123'
        }),
        expect.objectContaining({
          message: 'Partial error',
          stack: undefined,
          context: 'unknown',
          timestamp: expect.any(Number),
          userAgent: undefined,
          url: undefined,
          userId: 'user123'
        })
      ]);
    });

    it('preserves existing additionalData and adds batch metadata', async () => {
      const batchData = {
        errors: [
          {
            message: 'Error with existing data',
            additionalData: {
              componentId: 'header-nav',
              actionType: 'click'
            }
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Batch error report (1 errors):', [
        expect.objectContaining({
          additionalData: {
            componentId: 'header-nav',
            actionType: 'click',
            sessionId: 'session456',
            batchId: 'batch-uuid-12345'
          }
        })
      ]);
    });

    it('handles anonymous user (no locals.user)', async () => {
      const batchData = {
        errors: [
          {
            message: 'Anonymous batch error',
            context: 'public_page'
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);
      mockLocals.user = null;

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(console.error).toHaveBeenCalledWith('Batch error report (1 errors):', [
        expect.objectContaining({
          message: 'Anonymous batch error',
          userId: undefined
        })
      ]);
    });

    it('handles missing session', async () => {
      const batchData = {
        errors: [
          {
            message: 'No session error'
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);
      mockLocals.session = null;

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Batch error report (1 errors):', [
        expect.objectContaining({
          additionalData: expect.objectContaining({
            sessionId: undefined,
            batchId: 'batch-uuid-12345'
          })
        })
      ]);
    });

    it('generates unique batch ID for each request', async () => {
      const batchData = {
        errors: [
          { message: 'Error 1' },
          { message: 'Error 2' }
        ]
      };

      // Mock crypto.randomUUID to return different values
      const mockUUIDs = ['batch-1', 'batch-1']; // Same batch should have same ID
      let callCount = 0;
      global.crypto.randomUUID = vi.fn(() => mockUUIDs[callCount++] || 'batch-fallback');

      mockRequest.json.mockResolvedValue(batchData);

      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(console.error).toHaveBeenCalledWith('Batch error report (2 errors):', [
        expect.objectContaining({
          additionalData: expect.objectContaining({
            batchId: 'batch-1'
          })
        }),
        expect.objectContaining({
          additionalData: expect.objectContaining({
            batchId: 'batch-1'
          })
        })
      ]);
    });

    it('handles JSON parsing errors', async () => {
      mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { success: false, error: 'Failed to process batch error report' },
        { status: 500 }
      );
      expect(console.error).toHaveBeenCalledWith('Failed to process batch error report:', expect.any(Error));
    });

    it('does not log in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const batchData = {
        errors: [
          {
            message: 'Production batch error'
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(console.error).not.toHaveBeenCalledWith('Batch error report (1 errors):', expect.anything());

      process.env.NODE_ENV = originalEnv;
    });

    it('handles mixed error formats in batch', async () => {
      const batchData = {
        errors: [
          {
            message: 'Complete error',
            stack: 'Stack trace here',
            context: 'component_render',
            timestamp: 1640995200000,
            userAgent: 'Mozilla/5.0',
            url: 'https://example.com',
            additionalData: {
              formData: { field: 'value' }
            }
          },
          {
            message: 'Minimal error'
            // Only message provided
          },
          {
            // No message, should use default
            context: 'unknown_error',
            stack: 'Some stack trace'
          }
        ]
      };

      mockRequest.json.mockResolvedValue(batchData);

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('3 errors reported successfully');
      
      expect(console.error).toHaveBeenCalledWith('Batch error report (3 errors):', [
        expect.objectContaining({
          message: 'Complete error',
          stack: 'Stack trace here',
          context: 'component_render',
          timestamp: 1640995200000
        }),
        expect.objectContaining({
          message: 'Minimal error',
          context: 'unknown',
          timestamp: expect.any(Number)
        }),
        expect.objectContaining({
          message: 'Unknown error',
          context: 'unknown_error',
          stack: 'Some stack trace',
          timestamp: expect.any(Number)
        })
      ]);
    });
  });
});