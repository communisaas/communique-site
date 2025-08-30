import { describe, it, expect, vi } from 'vitest';
import { POST } from '$routes/api/civic/routing/+server';
import { userFactory, templateFactory, testScenarios } from '../fixtures/factories';
import mockRegistry from '../mocks/registry';

describe('Congressional Delivery Pipeline Integration', () => {
  it('should process authenticated user congressional request end-to-end', async () => {
    // Setup: Create test data
    const user = testScenarios.californiaUser();
    const template = testScenarios.climateTemplate();
    const routingEmail = testScenarios.routingEmail();

    // Setup: Configure mocks
    const mocks = mockRegistry.setupMocks();
    const dbMock = mocks['$lib/server/db'].db;
    const { deliveryPipeline } = mocks['$lib/core/legislative'];

    // Mock database responses
    dbMock.user.findUnique.mockResolvedValue(user);
    dbMock.template.findUnique.mockResolvedValue(template);

    // Mock delivery pipeline response
    deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
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
    const responseData = JSON.parse(response.body);

    // Verify: Database interactions
    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user123' }
    });
    expect(dbMock.template.findUnique).toHaveBeenCalledWith({
      where: { id: 'climate-action' }
    });

    // Verify: Delivery pipeline called with correct parameters
    expect(deliveryPipeline.deliverToRepresentatives).toHaveBeenCalledWith({
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
    const responseData = JSON.parse(response.body);

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
    
    const mocks = mockRegistry.setupMocks();
    const dbMock = mocks['$lib/server/db'].db;
    const { deliveryPipeline } = mocks['$lib/core/legislative'];

    dbMock.user.findUnique.mockResolvedValue(user);
    dbMock.template.findUnique.mockResolvedValue(template);

    // Mock partial delivery failure
    deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
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
    const responseData = JSON.parse(response.body);

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
        to: 'invalid-address@communique.org',
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      })
    };

    const response = await POST({ request: mockRequest } as any);
    
    expect(response.status).toBe(400);
    expect(response.body).toBe('Invalid routing address format');
  });

  it('should handle missing user gracefully', async () => {
    const mocks = mockRegistry.setupMocks();
    const dbMock = mocks['$lib/server/db'].db;
    
    dbMock.user.findUnique.mockResolvedValue(null);

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        to: 'congress+template123-nonexistent@communique.org',
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      })
    };

    const response = await POST({ request: mockRequest } as any);
    
    expect(response.status).toBe(404);
    expect(response.body).toBe('User not found');
  });

  it('should handle missing template gracefully', async () => {
    const user = testScenarios.californiaUser();
    
    const mocks = mockRegistry.setupMocks();
    const dbMock = mocks['$lib/server/db'].db;
    const { deliveryPipeline } = mocks['$lib/core/legislative'];

    dbMock.user.findUnique.mockResolvedValue(user);
    dbMock.template.findUnique.mockResolvedValue(null);

    // Even without template, should still attempt delivery with user's custom message
    deliveryPipeline.deliverToRepresentatives.mockResolvedValue({
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
    
    expect(response.status).toBe(404);
    expect(response.body).toBe('Template not found');
  });
});