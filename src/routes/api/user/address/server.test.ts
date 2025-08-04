import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server.ts';

// Mock dependencies
vi.mock('$lib/server/db', () => ({
  db: {
    user: {
      update: vi.fn()
    },
    user_representatives: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    representative: {
      findFirst: vi.fn(),
      create: vi.fn()
    }
  }
}));

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn().mockImplementation((data, options) => ({ 
    body: JSON.stringify(data), 
    status: options?.status || 200 
  }))
}));

describe('User Address API (/api/user/address)', () => {
  let mockRequest: any;
  let mockLocals: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock request
    mockRequest = {
      json: vi.fn()
    };
    
    // Default mock locals with authenticated user
    mockLocals = {
      user: {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com'
      }
    };
  });

  describe('Authentication', () => {
    it('requires user authentication', async () => {
      mockLocals.user = null;
      
      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      expect(json).toHaveBeenCalledWith(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    });
  });

  describe('Address Parsing', () => {
    it('accepts separate address components', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345'
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
          updatedAt: expect.any(Date)
        }
      });
    });

    it('parses full address string correctly', async () => {
      mockRequest.json.mockResolvedValue({
        address: '456 Oak Ave, Springfield, IL 62701'
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '456 Oak Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: {
          street: '456 Oak Ave',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          updatedAt: expect.any(Date)
        }
      });
    });

    it('handles address with ZIP+4 format', async () => {
      mockRequest.json.mockResolvedValue({
        address: '789 Pine St, Austin, TX 78701-1234'
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '789 Pine St',
        city: 'Austin',
        state: 'TX',
        zip: '78701-1234'
      });

      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: expect.objectContaining({
          street: '789 Pine St',
          city: 'Austin',
          state: 'TX',
          zip: '78701-1234'
        })
      });
    });

    it('handles malformed address gracefully', async () => {
      mockRequest.json.mockResolvedValue({
        address: 'Some incomplete address'
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: 'Some incomplete address',
        city: '',
        state: '',
        zip: ''
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: expect.objectContaining({
          street: 'Some incomplete address',
          city: '',
          state: '',
          zip: ''
        })
      });
    });

    it('requires address information', async () => {
      mockRequest.json.mockResolvedValue({});

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      expect(json).toHaveBeenCalledWith(
        { error: 'Address information is required' }, 
        { status: 400 }
      );
    });
  });

  describe('Representative Management', () => {
    it('stores new representatives for user', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        representatives: [
          {
            name: 'Rep. John Smith',
            state: 'CA',
            district: '12',
            chamber: 'house',
            email: 'john.smith@house.gov',
            phone: '202-555-0001',
            office: '123 Capitol Building'
          },
          {
            name: 'Sen. Jane Doe',
            state: 'CA',
            chamber: 'senate',
            email: 'jane.doe@senate.gov',
            phone: '202-555-0002',
            office: '456 Senate Building'
          }
        ]
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      });
      
      db.representative.findFirst.mockResolvedValue(null); // No existing reps
      db.representative.create
        .mockResolvedValueOnce({ id: 'rep123' })
        .mockResolvedValueOnce({ id: 'rep456' });
      db.user_representatives.create.mockResolvedValue({});

      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      // Should delete existing user representatives
      expect(db.user_representatives.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 'user123' }
      });
      
      // Should create new representatives
      expect(db.representative.create).toHaveBeenCalledTimes(2);
      expect(db.representative.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Rep. John Smith',
          state: 'CA',
          district: '12',
          chamber: 'house'
        })
      });
      
      // Should link representatives to user
      expect(db.user_representatives.create).toHaveBeenCalledTimes(2);
      expect(db.user_representatives.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user123',
          representative_id: 'rep123'
        }
      });
    });

    it('uses existing representatives when found', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        representatives: [
          {
            name: 'Rep. John Smith',
            state: 'CA',
            chamber: 'house'
          }
        ]
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      });
      
      // Representative already exists
      db.representative.findFirst.mockResolvedValue({ 
        id: 'existing-rep-123',
        name: 'Rep. John Smith',
        state: 'CA',
        chamber: 'house'
      });
      db.user_representatives.create.mockResolvedValue({});

      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      // Should not create new representative
      expect(db.representative.create).not.toHaveBeenCalled();
      
      // Should link existing representative to user
      expect(db.user_representatives.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user123',
          representative_id: 'existing-rep-123'
        }
      });
    });

    it('handles empty representatives array', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        representatives: []
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(db.user_representatives.deleteMany).not.toHaveBeenCalled();
      expect(db.representative.create).not.toHaveBeenCalled();
    });

    it('handles missing representatives field', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345'
        // No representatives field
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData.success).toBe(true);
      expect(db.user_representatives.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    it('returns user data in response', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345'
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        // Other fields that shouldn't be exposed
        email: 'test@example.com',
        password: 'hashed_password'
      });

      const response = await POST({ request: mockRequest, locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);
      
      expect(responseData).toEqual({
        success: true,
        message: 'Address saved successfully',
        user: {
          id: 'user123',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345'
        }
      });
      
      // Should not expose sensitive fields
      expect(responseData.user.email).toBeUndefined();
      expect(responseData.user.password).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('handles database update errors', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345'
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockRejectedValue(new Error('Database error'));

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      expect(json).toHaveBeenCalledWith(
        { error: 'Failed to save address' }, 
        { status: 500 }
      );
    });

    it('handles representative creation errors', async () => {
      mockRequest.json.mockResolvedValue({
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        representatives: [{
          name: 'Rep. Error Test',
          state: 'CA',
          chamber: 'house'
        }]
      });

      const { db } = await import('$lib/server/db');
      db.user.update.mockResolvedValue({
        id: 'user123',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345'
      });
      
      db.representative.findFirst.mockResolvedValue(null);
      db.representative.create.mockRejectedValue(new Error('DB error'));

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      expect(json).toHaveBeenCalledWith(
        { error: 'Failed to save address' }, 
        { status: 500 }
      );
    });

    it('handles JSON parsing errors', async () => {
      mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

      const { json } = await import('@sveltejs/kit');
      await POST({ request: mockRequest, locals: mockLocals } as any);
      
      expect(json).toHaveBeenCalledWith(
        { error: 'Failed to save address' }, 
        { status: 500 }
      );
    });
  });
});