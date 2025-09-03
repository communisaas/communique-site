import { describe, it, expect, vi } from 'vitest';
import { userFactory, representativeFactory, templateFactory, congressionalOfficeFactory } from '../fixtures/factories';
import mockRegistry from '../mocks/registry';

describe('CWC Client Unit Tests', () => {
  it('should submit to House successfully', async () => {
    const mocks = mockRegistry.setupMocks();
    const { cwcClient } = mocks['$lib/core/congress/cwc-client'];

    const template = templateFactory.build();
    const user = userFactory.build();
    const office = congressionalOfficeFactory.build({ overrides: { chamber: 'house' } });
    const message = 'Personalized message content';

    const result = await cwcClient.submitToHouse(template, user, office, message);

    expect(result).toEqual({
      success: true,
      messageId: 'house-msg-123',
      submissionId: 'cwc-house-456'
    });

    expect(cwcClient.submitToHouse).toHaveBeenCalledWith(template, user, office, message);
  });

  it('should submit to Senate successfully', async () => {
    const mocks = mockRegistry.setupMocks();
    const { cwcClient } = mocks['$lib/core/congress/cwc-client'];

    const template = templateFactory.build();
    const user = userFactory.build();
    const office = congressionalOfficeFactory.build({ overrides: { chamber: 'senate' } });
    const message = 'Personalized message content';

    const result = await cwcClient.submitToSenate(template, user, office, message);

    expect(result).toEqual({
      success: true,
      messageId: 'senate-msg-789',
      submissionId: 'cwc-senate-012'
    });

    expect(cwcClient.submitToSenate).toHaveBeenCalledWith(template, user, office, message);
  });

  it('should validate template format', async () => {
    const mocks = mockRegistry.setupMocks();
    const { cwcClient } = mocks['$lib/core/congress/cwc-client'];

    const template = templateFactory.build();
    const result = await cwcClient.validateTemplate(template);

    expect(result).toEqual({ valid: true });
    expect(cwcClient.validateTemplate).toHaveBeenCalledWith(template);
  });

  it('should check delivery status', async () => {
    const mocks = mockRegistry.setupMocks();
    const { cwcClient } = mocks['$lib/core/congress/cwc-client'];

    const messageId = 'test-msg-123';
    const result = await cwcClient.getDeliveryStatus(messageId);

    expect(result).toEqual({
      status: 'delivered',
      deliveredAt: expect.any(Date)
    });

    expect(cwcClient.getDeliveryStatus).toHaveBeenCalledWith(messageId);
  });
});