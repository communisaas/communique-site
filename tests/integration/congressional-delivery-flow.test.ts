import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all the services this integration test will use
vi.mock('$lib/server/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    template: {
      findUnique: vi.fn()
    },
    user_representatives: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    representative: {
      findFirst: vi.fn(),
      create: vi.fn()
    }
  }
}));

vi.mock('$lib/congress/address-lookup', () => ({
  addressLookup: {
    lookupRepsByAddress: vi.fn()
  }
}));

vi.mock('$lib/congress/cwc-client', () => ({
  cwcClient: {
    submitToHouse: vi.fn(),
    submitToSenate: vi.fn()
  }
}));

vi.mock('$lib/services/personalization', () => ({
  resolveVariables: vi.fn()
}));

describe('Congressional Message Delivery Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Authenticated User Flow', () => {
    it('delivers message from template selection to congressional offices', async () => {
      // Test data
      const userId = 'user123';
      const templateId = 'climate-action';
      const userAddress = {
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zip: '78701'
      };

      // 1. SETUP: Mock user with address but no cached representatives
      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: userId,
        name: 'Jane Citizen',
        email: 'jane@example.com',
        ...userAddress,
        representatives: [] // No cached representatives
      });

      // 2. SETUP: Mock template
      db.template.findUnique.mockResolvedValue({
        id: templateId,
        subject: 'Support Climate Action',
        message_body: 'Dear [Representative Name], As your constituent from [City], I urge you to support climate action. [Personal Connection] Sincerely, [Name]'
      });

      // 3. SETUP: Mock address lookup service
      const { addressLookup } = await import('$lib/congress/address-lookup');
      addressLookup.lookupRepsByAddress.mockResolvedValue({
        house: {
          name: 'Rep. Lloyd Doggett',
          officeCode: 'D000399',
          district: '35'
        },
        senate: [
          {
            name: 'Sen. John Cornyn',
            officeCode: 'C001056',
            state: 'TX'
          },
          {
            name: 'Sen. Ted Cruz',
            officeCode: 'C001098',
            state: 'TX'
          }
        ],
        district: '35'
      });

      // 4. SETUP: Mock personalization service
      const { resolveVariables } = await import('$lib/services/personalization');
      resolveVariables.mockImplementation((template, user, rep) => {
        return template
          .replace('[Representative Name]', rep.name)
          .replace('[City]', user.city)
          .replace('[Name]', user.name)
          .replace('[Personal Connection]', 'Climate change affects my family directly.');
      });

      // 5. SETUP: Mock CWC submission service
      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockResolvedValue({
        success: true,
        messageId: 'house-msg-12345'
      });
      cwcClient.submitToSenate.mockResolvedValue({
        success: true,
        messageId: 'senate-msg-67890'
      });

      // 6. EXECUTE: Import and call the civic routing endpoint
      const { POST } = await import('../../routes/api/civic/routing/+server.ts');
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          to: `congress+${templateId}-${userId}@communique.org`,
          from: 'jane@example.com',
          subject: 'Support Climate Action',
          body: 'Climate change affects my family directly.'
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);

      // 7. VERIFY: Complete flow worked
      expect(responseData.success).toBe(true);
      expect(responseData.deliveryCount).toBe(3); // 1 house + 2 senate

      // 8. VERIFY: Address lookup was called with user's address
      expect(addressLookup.lookupRepsByAddress).toHaveBeenCalledWith(userAddress);

      // 9. VERIFY: Template variables were resolved for each representative
      expect(resolveVariables).toHaveBeenCalledTimes(3);
      expect(resolveVariables).toHaveBeenCalledWith(
        expect.stringContaining('[Representative Name]'),
        expect.objectContaining({ name: 'Jane Citizen', city: 'Austin' }),
        expect.objectContaining({ name: 'Rep. Lloyd Doggett' })
      );

      // 10. VERIFY: Messages were submitted to CWC for all representatives
      expect(cwcClient.submitToHouse).toHaveBeenCalledWith(
        expect.objectContaining({
          id: templateId,
          subject: 'Support Climate Action'
        }),
        expect.objectContaining({
          name: 'Jane Citizen',
          email: 'jane@example.com'
        }),
        expect.objectContaining({
          name: 'Rep. Lloyd Doggett',
          chamber: 'house'
        }),
        expect.stringContaining('Lloyd Doggett')
      );

      expect(cwcClient.submitToSenate).toHaveBeenCalledTimes(2);
      expect(cwcClient.submitToSenate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          name: 'Sen. John Cornyn',
          chamber: 'senate'
        }),
        expect.any(String)
      );
    });

    it('uses cached representatives when available', async () => {
      const userId = 'user456';
      const templateId = 'healthcare-reform';

      // Mock user with cached representatives
      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: userId,
        name: 'Bob Smith',
        email: 'bob@example.com',
        street: '456 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
        representatives: [
          {
            representative: {
              id: 'rep1',
              name: 'Rep. Colin Allred',
              chamber: 'house',
              officeCode: 'A000376',
              district: '32',
              state: 'TX'
            }
          },
          {
            representative: {
              id: 'rep2',
              name: 'Sen. John Cornyn',
              chamber: 'senate',
              officeCode: 'C001056',
              state: 'TX'
            }
          }
        ]
      });

      db.template.findUnique.mockResolvedValue({
        id: templateId,
        subject: 'Healthcare Reform',
        message_body: 'Dear [Representative Name], Healthcare reform is critical. [Personal Connection] Thank you, [Name]'
      });

      const { resolveVariables } = await import('$lib/services/personalization');
      resolveVariables.mockImplementation((template) => 
        template.replace('[Personal Connection]', 'My family depends on affordable healthcare.')
      );

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockResolvedValue({ success: true, messageId: 'msg1' });
      cwcClient.submitToSenate.mockResolvedValue({ success: true, messageId: 'msg2' });

      const { POST } = await import('../../routes/api/civic/routing/+server.ts');
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          to: `congress+${templateId}-${userId}@communique.org`,
          from: 'bob@example.com',
          subject: 'Healthcare Reform',
          body: 'My family depends on affordable healthcare.'
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.deliveryCount).toBe(2);

      // Should NOT call address lookup since representatives are cached
      const { addressLookup } = await import('$lib/congress/address-lookup');
      expect(addressLookup.lookupRepsByAddress).not.toHaveBeenCalled();

      // Should still submit to CWC
      expect(cwcClient.submitToHouse).toHaveBeenCalled();
      expect(cwcClient.submitToSenate).toHaveBeenCalled();
    });

    it('handles guest users with onboarding flow', async () => {
      const templateId = 'voting-rights';
      const sessionToken = 'guest-session-123';

      const { POST } = await import('../../routes/api/civic/routing/+server.ts');
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          to: `congress+guest-${templateId}-${sessionToken}@communique.org`,
          from: 'newuser@example.com',
          subject: 'Voting Rights Matter',
          body: 'I believe voting rights are fundamental to democracy.'
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.message).toContain('Onboarding email sent');
      expect(responseData.nextStep).toBe('check_email');

      // Should not attempt CWC submission for guest users
      const { cwcClient } = await import('$lib/congress/cwc-client');
      expect(cwcClient.submitToHouse).not.toHaveBeenCalled();
      expect(cwcClient.submitToSenate).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling in Integration Flow', () => {
    it('gracefully handles address lookup failures', async () => {
      const userId = 'user789';
      const templateId = 'education-funding';

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: userId,
        name: 'Alice Johnson',
        street: '789 Pine St',
        city: 'Houston',
        state: 'TX',
        zip: '77001',
        representatives: []
      });

      db.template.findUnique.mockResolvedValue({
        id: templateId,
        subject: 'Education Funding',
        message_body: 'Dear [Representative Name], Education funding is vital.'
      });

      // Mock address lookup failure
      const { addressLookup } = await import('$lib/congress/address-lookup');
      addressLookup.lookupRepsByAddress.mockRejectedValue(new Error('Address service unavailable'));

      const { POST } = await import('../../routes/api/civic/routing/+server.ts');
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          to: `congress+${templateId}-${userId}@communique.org`,
          from: 'alice@example.com',
          subject: 'Education Funding',
          body: 'Schools in my area need more resources.'
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);

      // Should succeed but with zero deliveries
      expect(responseData.success).toBe(true);
      expect(responseData.deliveryCount).toBe(0);

      // Should not attempt CWC submission
      const { cwcClient } = await import('$lib/congress/cwc-client');
      expect(cwcClient.submitToHouse).not.toHaveBeenCalled();
      expect(cwcClient.submitToSenate).not.toHaveBeenCalled();
    });

    it('continues delivery even if some CWC submissions fail', async () => {
      const userId = 'user999';
      const templateId = 'infrastructure';

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: userId,
        name: 'Carlos Rodriguez',
        representatives: [
          {
            representative: {
              name: 'Rep. Test House',
              chamber: 'house',
              officeCode: 'T001234'
            }
          },
          {
            representative: {
              name: 'Sen. Test Senate',
              chamber: 'senate',
              officeCode: 'T005678'
            }
          }
        ]
      });

      db.template.findUnique.mockResolvedValue({
        id: templateId,
        subject: 'Infrastructure Investment',
        message_body: 'Infrastructure is critical.'
      });

      const { resolveVariables } = await import('$lib/services/personalization');
      resolveVariables.mockReturnValue('Infrastructure is critical.');

      // Mock CWC failures
      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockRejectedValue(new Error('House submission failed'));
      cwcClient.submitToSenate.mockResolvedValue({ success: true, messageId: 'senate-ok' });

      const { POST } = await import('../../routes/api/civic/routing/+server.ts');
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          to: `congress+${templateId}-${userId}@communique.org`,
          from: 'carlos@example.com',
          subject: 'Infrastructure Investment',
          body: 'Our roads and bridges need immediate attention.'
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);

      // Should still report success with attempted deliveries
      expect(responseData.success).toBe(true);
      expect(responseData.deliveryCount).toBe(2); // Both attempted, even though one failed

      expect(cwcClient.submitToHouse).toHaveBeenCalled();
      expect(cwcClient.submitToSenate).toHaveBeenCalled();
    });
  });

  describe('Template Variable Resolution Integration', () => {
    it('properly resolves all template variables in context', async () => {
      const userId = 'user-variables';
      const templateId = 'climate-detailed';

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: userId,
        name: 'Maria Garcia',
        email: 'maria@example.com',
        street: '555 Climate Ave',
        city: 'San Antonio',
        state: 'TX',
        zip: '78201',
        representatives: [
          {
            representative: {
              name: 'Rep. Joaquin Castro',
              chamber: 'house',
              officeCode: 'C001091',
              district: '20'
            }
          }
        ]
      });

      db.template.findUnique.mockResolvedValue({
        id: templateId,
        subject: 'Climate Action for [City]',
        message_body: 'Dear [Representative Name],\n\nI am [Name], a resident of [City], [State]. [Personal Connection]\n\nAs your constituent in District [District], I urge you to prioritize climate action.\n\nSincerely,\n[Name]\n[City], [State] [Zip]'
      });

      const { resolveVariables } = await import('$lib/services/personalization');
      resolveVariables.mockImplementation((template, user, rep) => {
        return template
          .replace(/\[Representative Name\]/g, rep.name)
          .replace(/\[Name\]/g, user.name)
          .replace(/\[City\]/g, user.city)
          .replace(/\[State\]/g, user.state)
          .replace(/\[Zip\]/g, user.zip)
          .replace(/\[District\]/g, rep.district)
          .replace(/\[Personal Connection\]/g, 'Climate change has caused severe flooding in my neighborhood.');
      });

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockImplementation((template, user, rep, personalizedBody) => {
        // Verify the personalized body has all variables resolved
        expect(personalizedBody).not.toContain('[');
        expect(personalizedBody).toContain('Maria Garcia');
        expect(personalizedBody).toContain('San Antonio');
        expect(personalizedBody).toContain('Rep. Joaquin Castro');
        expect(personalizedBody).toContain('District 20');
        expect(personalizedBody).toContain('severe flooding');
        return Promise.resolve({ success: true, messageId: 'fully-personalized' });
      });

      const { POST } = await import('../../routes/api/civic/routing/+server.ts');
      
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          to: `congress+${templateId}-${userId}@communique.org`,
          from: 'maria@example.com',
          subject: 'Climate Action for San Antonio',
          body: 'Climate change has caused severe flooding in my neighborhood.'
        })
      };

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(cwcClient.submitToHouse).toHaveBeenCalled();
    });
  });
});