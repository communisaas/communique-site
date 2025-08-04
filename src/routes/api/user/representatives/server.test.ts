import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET, PUT } from './+server.ts';

// Mock dependencies
vi.mock('$lib/server/db', () => ({
  db: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    user_representatives: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    representative: {
      upsert: vi.fn()
    }
  }
}));

vi.mock('$lib/congress/address-lookup', () => ({
  addressLookup: {
    lookupRepsByAddress: vi.fn()
  }
}));

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn().mockImplementation((data) => ({ 
    body: JSON.stringify(data), 
    status: 200 
  })),
  error: vi.fn().mockImplementation((status, message) => ({ 
    status, 
    body: message 
  }))
}));

describe('User Representatives API (/api/user/representatives)', () => {
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
      }
    };
  });

  describe('POST - Store Representatives', () => {
    it('stores user representatives successfully', async () => {
      const representativesData = {
        userId: 'user123',
        representatives: {
          house: {
            bioguideId: 'H001234',
            name: 'Rep. John Smith',
            party: 'Democratic',
            state: 'CA',
            district: '12',
            chamber: 'house' as const,
            officeCode: 'H001234'
          },
          senate: [
            {
              bioguideId: 'S001234',
              name: 'Sen. Jane Doe',
              party: 'Democratic',
              state: 'CA',
              district: '',
              chamber: 'senate' as const,
              officeCode: 'S001234'
            },
            {
              bioguideId: 'S005678',
              name: 'Sen. Bob Wilson',
              party: 'Republican',
              state: 'CA',
              district: '',
              chamber: 'senate' as const,
              officeCode: 'S005678'
            }
          ],
          district: {
            state: 'CA',
            district: '12'
          }
        },
        userAddress: {
          street: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90210'
        }
      };

      mockRequest.json.mockResolvedValue(representativesData);

      const { db } = await import('$lib/server/db');
      
      // Mock transaction execution
      db.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            update: vi.fn().mockResolvedValue({ id: 'user123' })
          },
          user_representatives: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            createMany: vi.fn().mockResolvedValue({ count: 3 })
          },
          representative: {
            upsert: vi.fn()
              .mockResolvedValueOnce({ id: 'rep1', chamber: 'house' })
              .mockResolvedValueOnce({ id: 'rep2', chamber: 'senate' })
              .mockResolvedValueOnce({ id: 'rep3', chamber: 'senate' })
          }
        };
        
        return await callback(mockTx);
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.representativesCount).toBe(3);
      expect(responseData.relationshipsCount).toBe(3);
      expect(db.$transaction).toHaveBeenCalled();
    });

    it('requires userId', async () => {
      mockRequest.json.mockResolvedValue({
        representatives: { house: {}, senate: [] }
      });

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(400, 'userId is required');
    });

    it('requires representatives data', async () => {
      mockRequest.json.mockResolvedValue({
        userId: 'user123'
      });

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(400, 'Representatives data is required (house and senate)');
    });

    it('handles transaction errors', async () => {
      mockRequest.json.mockResolvedValue({
        userId: 'user123',
        representatives: {
          house: { bioguideId: 'H001234', name: 'Rep. Test', party: 'D', state: 'CA', district: '1', chamber: 'house', officeCode: 'H001234' },
          senate: [],
          district: { state: 'CA', district: '1' }
        }
      });

      const { db } = await import('$lib/server/db');
      db.$transaction.mockRejectedValue(new Error('Database error'));

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(500, 'Failed to store user representatives');
    });

    it('handles empty senate array', async () => {
      mockRequest.json.mockResolvedValue({
        userId: 'user123',
        representatives: {
          house: {
            bioguideId: 'H001234',
            name: 'Rep. Solo',
            party: 'Independent',
            state: 'VT',
            district: 'At-Large',
            chamber: 'house',
            officeCode: 'H001234'
          },
          senate: [],
          district: { state: 'VT', district: 'At-Large' }
        }
      });

      const { db } = await import('$lib/server/db');
      
      db.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: { update: vi.fn() },
          user_representatives: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            createMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          representative: {
            upsert: vi.fn().mockResolvedValue({ id: 'rep1', chamber: 'house' })
          }
        };
        
        return await callback(mockTx);
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.representativesCount).toBe(1);
    });
  });

  describe('GET - Fetch Representatives', () => {
    it('fetches user representatives successfully', async () => {
      const mockUrl = new URL('http://localhost/api/user/representatives?userId=user123');
      
      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        congressional_district: 'TX-35',
        representatives: [
          {
            representative: {
              id: 'rep1',
              bioguide_id: 'H001234',
              name: 'Rep. Lloyd Doggett',
              party: 'Democratic',
              state: 'TX',
              district: '35',
              chamber: 'house',
              office_code: 'H001234'
            },
            relationship: 'house',
            assigned_at: new Date(),
            last_validated: new Date()
          },
          {
            representative: {
              id: 'rep2',
              bioguide_id: 'S001234',
              name: 'Sen. John Cornyn',
              party: 'Republican',
              state: 'TX',
              district: '',
              chamber: 'senate',
              office_code: 'S001234'
            },
            relationship: 'senate_senior',
            assigned_at: new Date(),
            last_validated: new Date()
          }
        ]
      });

      const response = await GET({ url: mockUrl, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(responseData.userId).toBe('user123');
      expect(responseData.representatives.house).toBeTruthy();
      expect(responseData.representatives.senate).toHaveLength(1);
      expect(responseData.district).toBe('TX-35');
    });

    it('requires userId parameter', async () => {
      const mockUrl = new URL('http://localhost/api/user/representatives');

      const { error } = await import('@sveltejs/kit');
      await GET({ url: mockUrl, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(400, 'userId parameter is required');
    });

    it('handles user not found', async () => {
      const mockUrl = new URL('http://localhost/api/user/representatives?userId=nonexistent');
      
      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue(null);

      const { error } = await import('@sveltejs/kit');
      await GET({ url: mockUrl, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(404, 'User not found');
    });

    it('handles database errors', async () => {
      const mockUrl = new URL('http://localhost/api/user/representatives?userId=user123');
      
      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const { error } = await import('@sveltejs/kit');
      await GET({ url: mockUrl, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(500, 'Failed to fetch user representatives');
    });

    it('formats representatives correctly with no senate', async () => {
      const mockUrl = new URL('http://localhost/api/user/representatives?userId=user123');
      
      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        congressional_district: 'TX-35',
        representatives: [
          {
            representative: {
              id: 'rep1',
              bioguide_id: 'H001234',
              name: 'Rep. Lloyd Doggett',
              party: 'Democratic',
              state: 'TX',
              district: '35',
              chamber: 'house',
              office_code: 'H001234'
            },
            relationship: 'house',
            assigned_at: new Date(),
            last_validated: new Date()
          }
        ]
      });

      const response = await GET({ url: mockUrl, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.representatives.house.name).toBe('Rep. Lloyd Doggett');
      expect(responseData.representatives.senate).toHaveLength(0);
    });
  });

  describe('PUT - Refresh Representatives', () => {
    it('refreshes representatives successfully', async () => {
      mockRequest.json.mockResolvedValue({
        userId: 'user123'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        street: '456 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75201'
      });

      const { addressLookup } = await import('$lib/congress/address-lookup');
      addressLookup.lookupRepsByAddress.mockResolvedValue({
        house: {
          bioguideId: 'H005678',
          name: 'Rep. Eddie Bernice Johnson',
          party: 'Democratic',
          state: 'TX',
          district: '30',
          chamber: 'house',
          officeCode: 'H005678'
        },
        senate: [
          {
            bioguideId: 'S001234',
            name: 'Sen. John Cornyn',
            party: 'Republican',
            state: 'TX',
            district: '',
            chamber: 'senate',
            officeCode: 'S001234'
          }
        ],
        district: { state: 'TX', district: '30' }
      });

      // Mock the POST handler that gets called internally
      db.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: { update: vi.fn() },
          user_representatives: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
            createMany: vi.fn().mockResolvedValue({ count: 2 })
          },
          representative: {
            upsert: vi.fn()
              .mockResolvedValueOnce({ id: 'rep1', chamber: 'house' })
              .mockResolvedValueOnce({ id: 'rep2', chamber: 'senate' })
          }
        };
        
        return await callback(mockTx);
      });

      const response = await PUT({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData.success).toBe(true);
      expect(addressLookup.lookupRepsByAddress).toHaveBeenCalledWith({
        street: '456 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75201'
      });
    });

    it('requires userId', async () => {
      mockRequest.json.mockResolvedValue({});

      const { error } = await import('@sveltejs/kit');
      await PUT({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(400, 'userId is required');
    });

    it('handles incomplete user address', async () => {
      mockRequest.json.mockResolvedValue({
        userId: 'user123'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        street: '123 Main St',
        city: null,
        state: 'TX',
        zip: '78701'
      });

      const { error } = await import('@sveltejs/kit');
      await PUT({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(400, 'User address information is incomplete');
    });

    it('handles address lookup failures', async () => {
      mockRequest.json.mockResolvedValue({
        userId: 'user123'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue({
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zip: '78701'
      });

      const { addressLookup } = await import('$lib/congress/address-lookup');
      addressLookup.lookupRepsByAddress.mockRejectedValue(new Error('Address lookup service unavailable'));

      const { error } = await import('@sveltejs/kit');
      await PUT({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(500, 'Failed to refresh user representatives');
    });

    it('handles user not found', async () => {
      mockRequest.json.mockResolvedValue({
        userId: 'nonexistent'
      });

      const { db } = await import('$lib/server/db');
      db.user.findUnique.mockResolvedValue(null);

      const { error } = await import('@sveltejs/kit');
      await PUT({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(400, 'User address information is incomplete');
    });
  });

  describe('Error Handling', () => {
    it('handles JSON parsing errors in POST', async () => {
      mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

      const { error } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(500, 'Failed to store user representatives');
    });

    it('handles JSON parsing errors in PUT', async () => {
      mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

      const { error } = await import('@sveltejs/kit');
      await PUT({ request: mockRequest, locals: mockLocals } as any);

      expect(error).toHaveBeenCalledWith(500, 'Failed to refresh user representatives');
    });

    it('re-throws SvelteKit errors in POST', async () => {
      mockRequest.json.mockResolvedValue({});

      const customError = { status: 400, body: 'Custom validation error' };
      
      try {
        await POST({ request: mockRequest, locals: mockLocals } as any);
      } catch (err) {
        expect(err).toEqual(customError);
      }
    });
  });
});