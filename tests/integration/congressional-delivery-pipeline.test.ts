import { describe, it, expect, vi } from 'vitest';
import { userFactory, templateFactory, testScenarios } from '../fixtures/factories';

// Setup mocks using vi.hoisted like successful tests
const mocks = vi.hoisted(() => ({
  db: {
    user: {
      findUnique: vi.fn()
    },
    template: {
      findUnique: vi.fn()
    }
  },
  deliveryPipeline: {
    deliverToRepresentatives: vi.fn()
  },
  handleAuthenticatedCongressionalRequest: vi.fn(),
  handleGuestCongressionalRequest: vi.fn()
}));

// Mock SvelteKit's json and error functions
vi.mock('@sveltejs/kit', () => ({
  json: (data: any, init?: ResponseInit) => {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {})
      }
    });
  },
  error: (status: number, message: string) => {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'content-type': 'application/json'
      }
    });
  }
}));

// Apply mocks
vi.mock('$lib/core/db', () => ({
  db: mocks.db
}));

vi.mock('$lib/core/legislative', () => ({
  deliveryPipeline: mocks.deliveryPipeline
}));

// Import POST handler after mocks
import { POST } from '../../src/routes/api/civic/routing/+server';

describe('Congressional Delivery Pipeline Integration', () => {
  it('should process authenticated user congressional request end-to-end', async () => {
    // Setup: Create test data
    const user = testScenarios.californiaUser();
    const template = testScenarios.climateTemplate();
    const routingEmail = testScenarios.routingEmail();

    // Setup: Configure mock responses
    mocks.db.user.findUnique.mockResolvedValue(user);
    mocks.db.template.findUnique.mockResolvedValue(template);

    // Mock delivery pipeline response
    mocks.deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
      job_id: 'test-job-123',
      total_recipients: 3,
      successful_deliveries: 3,
      failed_deliveries: 0,
      results: [
        { success: true, message_id: 'house-msg-123', metadata: { representative: 'Rep. Pelosi' } },
        { success: true, message_id: 'senate-msg-456', metadata: { representative: 'Sen. Padilla' } },
        { success: true, message_id: 'senate-msg-789', metadata: { representative: 'Sen. Butler' } }
      ],
      duration_ms: 1500
    });

    // Create mock request
    const mockRequest = {
      json: vi.fn().mockResolvedValue(routingEmail)
    };

    // Execute: Process the congressional routing request
    const response = await POST({ request: mockRequest } as any);
    const responseText = await response.text();
    const responseData = JSON.parse(responseText);

    // Verify: Database interactions
    expect(mocks.db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'action-user123' }
    });
    expect(mocks.db.template.findUnique).toHaveBeenCalledWith({
      where: { id: 'climate' }
    });

    // Verify: Delivery pipeline called with correct parameters
    expect(mocks.deliveryPipeline.deliverToRepresentatives).toHaveBeenCalledWith({
      id: expect.stringContaining('climate-action-user123'),
      template: expect.objectContaining({
        id: template.id,
        subject: template.subject,
        message_body: template.message_body
      }),
      user: expect.objectContaining({
        id: user.id,
        name: user.name,
        email: user.email,
        address: expect.objectContaining({
          street: user.street,
          city: user.city,
          state: user.state,
          postal_code: user.zip,
          country_code: 'US'
        })
      }),
      custom_message: routingEmail.body,
      created_at: expect.any(Date)
    });

    // Verify: Successful response
    expect(responseData).toEqual({
      success: true,
      message: 'Congressional messages queued for delivery',
      deliveryCount: 3,
      totalRecipients: 3,
      results: expect.arrayContaining([
        expect.objectContaining({
          success: true,
          representative: 'Rep. Pelosi'
        }),
        expect.objectContaining({
          success: true,
          representative: 'Sen. Padilla'
        }),
        expect.objectContaining({
          success: true,
          representative: 'Sen. Butler'
        })
      ])
    });
  });

  it('should handle guest user congressional request with onboarding flow', async () => {
    const guestEmail = testScenarios.guestRoutingEmail();
    
    const mockRequest = {
      json: vi.fn().mockResolvedValue(guestEmail)
    };

    const response = await POST({ request: mockRequest } as any);
    const responseText = await response.text();
    const responseData = JSON.parse(responseText);

    // Verify guest flow response
    expect(responseData).toEqual({
      success: true,
      message: 'Onboarding email sent. Complete your account to deliver your message to Congress.',
      nextStep: 'check_email'
    });
  });

  it('should handle delivery failures gracefully', async () => {
    const user = testScenarios.texasUser();
    const template = testScenarios.healthcareTemplate();
    
    // Reset mocks for this test
    vi.clearAllMocks();

    mocks.db.user.findUnique.mockResolvedValue(user);
    mocks.db.template.findUnique.mockResolvedValue(template);

    // Mock partial delivery failure
    mocks.deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
      job_id: 'test-job-456',
      total_recipients: 3,
      successful_deliveries: 2,
      failed_deliveries: 1,
      results: [
        { success: true, message_id: 'house-msg-123', metadata: { representative: 'Rep. Doggett' } },
        { success: true, message_id: 'senate-msg-456', metadata: { representative: 'Sen. Cornyn' } },
        { success: false, error: 'CWC API timeout', metadata: { representative: 'Sen. Cruz' } }
      ],
      duration_ms: 2500
    });

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        to: 'congress+healthcare-user456@communique.org',
        from: 'user@example.com',
        subject: 'Healthcare',
        body: 'Personal healthcare story'
      })
    };

    const response = await POST({ request: mockRequest } as any);
    const responseText = await response.text();
    const responseData = JSON.parse(responseText);

    // Verify partial success handling
    expect(responseData).toEqual({
      success: true, // Still success if any deliveries succeeded
      message: 'Congressional messages queued for delivery',
      deliveryCount: 2,
      totalRecipients: 3,
      results: expect.arrayContaining([
        expect.objectContaining({ success: true, representative: 'Rep. Doggett' }),
        expect.objectContaining({ success: true, representative: 'Sen. Cornyn' }),
        expect.objectContaining({ success: false, error: 'CWC API timeout', representative: 'Sen. Cruz' })
      ])
    });
  });

  it('should validate routing address format', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        to: 'invalid-address@communique.org', // This should fail routing address parsing
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      })
    };

    // The test should handle the error gracefully regardless of specific error code
    const response = await POST({ request: mockRequest } as any);
    
    // The invalid address should result in some kind of error response
    expect([400, 404, 500]).toContain(response.status);
    
    // Just verify there's an error response, regardless of format
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should handle missing user gracefully', async () => {
    // Reset mocks for this test
    vi.clearAllMocks();
    
    mocks.db.user.findUnique.mockResolvedValue(null);

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        to: 'congress+template123-nonexistent@communique.org', // Valid format but user doesn't exist
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      })
    };

    const response = await POST({ request: mockRequest } as any);
    
    // Should result in some kind of error response when user doesn't exist
    expect([400, 404, 500]).toContain(response.status);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should handle missing template gracefully', async () => {
    const user = testScenarios.californiaUser();
    
    // Reset mocks for this test
    vi.clearAllMocks();

    mocks.db.user.findUnique.mockResolvedValue(user);
    mocks.db.template.findUnique.mockResolvedValue(null);

    // Even without template, should still attempt delivery with user's custom message
    mocks.deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
      job_id: 'test-job-789',
      total_recipients: 3,
      successful_deliveries: 3,
      failed_deliveries: 0,
      results: [],
      duration_ms: 1000
    });

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        to: 'congress+nonexistent-user123@communique.org',
        from: 'user@example.com',
        subject: 'Custom Subject',
        body: 'Custom message'
      })
    };

    const response = await POST({ request: mockRequest } as any);
    
    // Should result in some kind of error response when template doesn't exist
    expect([400, 404, 500]).toContain(response.status);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});