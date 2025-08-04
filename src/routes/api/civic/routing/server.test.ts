import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server.ts';

// Mock dependencies
vi.mock('$lib/server/db', () => ({
  db: {
    user: {
      findUnique: vi.fn()
    },
    template: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('$lib/services/personalization', () => ({
  resolveVariables: vi.fn().mockImplementation((text) => text.replace('[Name]', 'John Doe'))
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

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn().mockImplementation((data) => ({ body: JSON.stringify(data) })),
  error: vi.fn().mockImplementation((status, message) => ({ status, body: message }))
}));

describe('Congressional Routing API (/api/civic/routing)', () => {
  let mockRequest: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock request
    mockRequest = {
      json: vi.fn()
    };
  });

  describe('Email Address Parsing', () => {
    it('parses authenticated user routing address correctly', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+template123-user456@communique.org',
        from: 'sender@example.com',
        subject: 'Test Subject',
        body: 'Test message body'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user456',
        name: 'John Doe',
        email: 'john@example.com',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        representatives: []
      });

      const { addressLookup } = await import('$lib/congress/address-lookup');
      addressLookup.lookupRepsByAddress.mockResolvedValue({
        house: {
          name: 'Rep. Jane Smith',
          officeCode: 'H001234',
          district: '12'
        },
        senate: [
          {
            name: 'Sen. Bob Johnson',
            officeCode: 'S001234',
            state: 'CA'
          },
          {
            name: 'Sen. Alice Williams',
            officeCode: 'S005678',
            state: 'CA'
          }
        ],
        district: '12'
      });

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockResolvedValue({ success: true, messageId: 'house-msg-123' });
      cwcClient.submitToSenate.mockResolvedValue({ success: true, messageId: 'senate-msg-123' });

      const response = await POST({ request: mockRequest } as any);
      
      expect(response.body).toContain('Congressional messages queued for delivery');
      expect(response.body).toContain('"deliveryCount":3');
    });

    it('parses guest user routing address correctly', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+guest-template123-sessionABC@communique.org',
        from: 'guest@example.com',
        subject: 'Guest Subject',
        body: 'Guest message'
      });

      const response = await POST({ request: mockRequest } as any);
      
      expect(response.body).toContain('Onboarding email sent');
      expect(response.body).toContain('"nextStep":"check_email"');
    });

    it('handles invalid routing address format', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'invalid-address@communique.org',
        from: 'sender@example.com',
        subject: 'Test',
        body: 'Test'
      });

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest } as any);
      
      expect(error).toHaveBeenCalledWith(400, 'Invalid routing address format');
    });

    it('handles missing template ID', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+@communique.org',
        from: 'sender@example.com',
        subject: 'Test',
        body: 'Test'
      });

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest } as any);
      
      expect(error).toHaveBeenCalledWith(400, 'Invalid routing address format');
    });
  });

  describe('Authenticated User Flow', () => {
    it('processes authenticated user request successfully', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+climate-action-user123@communique.org',
        from: 'user@example.com',
        subject: 'Climate Action Now',
        body: 'Personal message about climate'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user123',
        name: 'Jane Citizen',
        email: 'jane@example.com',
        street: '456 Oak Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        congressional_district: '13',
        representatives: [
          {
            representative: {
              id: 'rep1',
              name: 'Rep. Mike Davis',
              chamber: 'house',
              officeCode: 'H002345',
              office_code: 'H002345',
              district: '13',
              state: 'IL'
            }
          }
        ]
      });

      db.template.findUnique.mockResolvedValue({
        id: 'climate-action',
        subject: 'Support Climate Action',
        message_body: 'Dear [Representative Name], As your constituent, [Personal Connection]. Sincerely, [Name]'
      });

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockResolvedValue({ 
        success: true, 
        messageId: 'cwc-house-msg-789' 
      });

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(responseData.deliveryCount).toBe(1);
      expect(cwcClient.submitToHouse).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'climate',
          subject: 'Support Climate Action'
        }),
        expect.objectContaining({
          name: 'Jane Citizen',
          email: 'jane@example.com'
        }),
        expect.objectContaining({
          name: 'Rep. Mike Davis',
          chamber: 'house'
        }),
        expect.any(String)
      );
    });

    it('looks up representatives when not cached', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+template789-user456@communique.org',
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test message'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user456',
        name: 'Test User',
        street: '789 Pine St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        representatives: [] // No cached representatives
      });

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

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockResolvedValue({ success: true, messageId: 'msg-1' });
      cwcClient.submitToSenate.mockResolvedValue({ success: true, messageId: 'msg-2' });

      await POST({ request: mockRequest } as any);
      
      expect(addressLookup.lookupRepsByAddress).toHaveBeenCalledWith({
        street: '789 Pine St',
        city: 'Austin',
        state: 'TX',
        zip: '78701'
      });
      expect(cwcClient.submitToHouse).toHaveBeenCalledTimes(1);
      expect(cwcClient.submitToSenate).toHaveBeenCalledTimes(2);
    });

    it('handles user not found error', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+template123-nonexistent@communique.org',
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue(null);

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest } as any);
      
      expect(error).toHaveBeenCalledWith(404, 'User not found');
    });

    it('handles CWC submission errors gracefully', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+template123-user789@communique.org',
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user789',
        name: 'Error Test User',
        representatives: [
          {
            representative: {
              name: 'Rep. Test',
              chamber: 'house',
              officeCode: 'H999999'
            }
          }
        ]
      });

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockRejectedValue(new Error('CWC API Error'));

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true); // Still returns success
      expect(responseData.deliveryCount).toBe(1); // Still counts as attempted
    });
  });

  describe('Guest User Flow', () => {
    it('processes guest user request correctly', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+guest-healthcare-sessionXYZ123@communique.org',
        from: 'newuser@example.com',
        subject: 'Healthcare Reform',
        body: 'I support healthcare reform because...'
      });

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toContain('Onboarding email sent');
      expect(responseData.nextStep).toBe('check_email');
    });

    it('handles missing session token for guest', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+guest-template123-@communique.org',
        from: 'guest@example.com',
        subject: 'Test',
        body: 'Test'
      });

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest } as any);
      
      expect(error).toHaveBeenCalledWith(400, 'Invalid routing address format');
    });
  });

  describe('Template Variable Resolution', () => {
    it('resolves template variables correctly', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+climate-user123@communique.org',
        from: 'user@example.com',
        subject: 'Climate',
        body: 'My personal climate story...'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user123',
        name: 'Sarah Johnson',
        representatives: [
          {
            representative: {
              name: 'Rep. John Smith',
              chamber: 'house',
              officeCode: 'S001234'
            }
          }
        ]
      });

      db.template.findUnique.mockResolvedValue({
        id: 'climate',
        subject: 'Climate Action',
        message_body: 'Dear [Representative Name], I am [Name] from [City]. [Personal Connection] Thank you.'
      });

      const { resolveVariables } = await import('$lib/services/personalization');
      resolveVariables.mockImplementation((text, user, rep) => {
        return text
          .replace('[Representative Name]', rep.name)
          .replace('[Name]', user.name)
          .replace('[City]', user.city || '')
          .replace('[Personal Connection]', 'My personal climate story...');
      });

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockResolvedValue({ success: true, messageId: 'msg-123' });

      await POST({ request: mockRequest } as any);
      
      expect(resolveVariables).toHaveBeenCalled();
      expect(cwcClient.submitToHouse).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.stringContaining('My personal climate story...')
      );
    });

    it('handles missing template gracefully', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+nonexistent-user123@communique.org',
        from: 'user@example.com',
        subject: 'Custom Subject',
        body: 'Custom message'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user123',
        name: 'Test User',
        representatives: [
          {
            representative: {
              name: 'Rep. Test',
              chamber: 'house',
              officeCode: 'T001234'
            }
          }
        ]
      });

      db.template.findUnique.mockResolvedValue(null);

      const { cwcClient } = await import('$lib/congress/cwc-client');
      cwcClient.submitToHouse.mockResolvedValue({ success: true, messageId: 'msg-456' });

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(cwcClient.submitToHouse).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Custom Subject',
          message_body: 'Custom message'
        }),
        expect.any(Object),
        expect.any(Object),
        'Custom message'
      );
    });
  });

  describe('Error Handling', () => {
    it('handles JSON parsing errors', async () => {
      mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest } as any);
      
      expect(error).toHaveBeenCalledWith(500, 'Failed to process congressional routing');
    });

    it('handles database errors', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+template123-user456@communique.org',
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest } as any);
      
      expect(error).toHaveBeenCalledWith(500, 'Failed to process congressional routing');
    });

    it('handles address lookup failures', async () => {
      mockRequest.json.mockResolvedValue({
        to: 'congress+template123-user789@communique.org',
        from: 'user@example.com',
        subject: 'Test',
        body: 'Test'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user789',
        name: 'Test User',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        representatives: []
      });

      const { addressLookup } = await import('$lib/congress/address-lookup');
      addressLookup.lookupRepsByAddress.mockRejectedValue(new Error('Census API error'));

      const response = await POST({ request: mockRequest } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(responseData.deliveryCount).toBe(0); // No representatives to deliver to
    });
  });
});