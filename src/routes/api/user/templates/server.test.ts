import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server.ts';

// Mock dependencies
vi.mock('$lib/server/db', () => ({
  db: {
    template: {
      findMany: vi.fn()
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

describe('User Templates API (/api/user/templates)', () => {
  let mockLocals: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLocals = {
      auth: {
        validate: vi.fn()
      }
    };
  });

  describe('GET - Fetch User Templates', () => {
    it('fetches user templates successfully', async () => {
      const mockSession = {
        user: {
          id: 'user123',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      const mockTemplates = [
        {
          id: 'template1',
          userId: 'user123',
          title: 'Climate Action Template',
          slug: 'climate-action',
          subject: 'Support Climate Action',
          message_body: 'Dear Representative, I urge you to support climate action...',
          deliveryMethod: 'congressional',
          isPublic: false,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-20')
        },
        {
          id: 'template2',
          userId: 'user123',
          title: 'Healthcare Reform',
          slug: 'healthcare-reform',
          subject: 'Healthcare Reform Support',
          message_body: 'Dear Representative, Healthcare is a critical issue...',
          deliveryMethod: 'email',
          isPublic: true,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-18')
        }
      ];

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { db } = await import('$lib/server/db');
      db.template.findMany.mockResolvedValue(mockTemplates);

      const response = await GET({ locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData).toEqual(mockTemplates);
      expect(db.template.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123'
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    });

    it('returns empty array for user with no templates', async () => {
      const mockSession = {
        user: {
          id: 'user456',
          name: 'New User',
          email: 'new@example.com'
        }
      };

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { db } = await import('$lib/server/db');
      db.template.findMany.mockResolvedValue([]);

      const response = await GET({ locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData).toEqual([]);
      expect(db.template.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user456'
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    });

    it('requires authentication', async () => {
      mockLocals.auth.validate.mockResolvedValue(null);

      const { json } = await import('@sveltejs/kit');
      await GET({ locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    });

    it('handles session without user', async () => {
      const mockSession = {
        sessionId: 'session123'
        // No user property
      };

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { json } = await import('@sveltejs/kit');
      await GET({ locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    });

    it('handles database errors', async () => {
      const mockSession = {
        user: {
          id: 'user123',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { db } = await import('$lib/server/db');
      db.template.findMany.mockRejectedValue(new Error('Database connection failed'));

      const { json } = await import('@sveltejs/kit');
      await GET({ locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { error: 'Failed to fetch templates' }, 
        { status: 500 }
      );
    });

    it('handles auth validation errors', async () => {
      mockLocals.auth.validate.mockRejectedValue(new Error('Auth service unavailable'));

      const { json } = await import('@sveltejs/kit');
      await GET({ locals: mockLocals } as any);

      expect(json).toHaveBeenCalledWith(
        { error: 'Failed to fetch templates' }, 
        { status: 500 }
      );
    });

    it('orders templates by updatedAt desc', async () => {
      const mockSession = {
        user: {
          id: 'user123',
          name: 'Test User'
        }
      };

      const mockTemplates = [
        {
          id: 'template2',
          title: 'Recent Template',
          updatedAt: new Date('2024-01-25')
        },
        {
          id: 'template1',
          title: 'Older Template',
          updatedAt: new Date('2024-01-20')
        }
      ];

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { db } = await import('$lib/server/db');
      db.template.findMany.mockResolvedValue(mockTemplates);

      const response = await GET({ locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData[0].title).toBe('Recent Template');
      expect(responseData[1].title).toBe('Older Template');
      expect(db.template.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123'
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    });

    it('filters templates by user ID correctly', async () => {
      const mockSession = {
        user: {
          id: 'specific-user-789',
          name: 'Specific User'
        }
      };

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { db } = await import('$lib/server/db');
      db.template.findMany.mockResolvedValue([]);

      await GET({ locals: mockLocals } as any);

      expect(db.template.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'specific-user-789'
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
    });

    it('handles templates with various delivery methods', async () => {
      const mockSession = {
        user: {
          id: 'user123'
        }
      };

      const mockTemplates = [
        {
          id: 'template1',
          title: 'Congressional Template',
          deliveryMethod: 'congressional'
        },
        {
          id: 'template2',
          title: 'Email Template',
          deliveryMethod: 'email'
        },
        {
          id: 'template3',
          title: 'Mixed Template',
          deliveryMethod: 'both'
        }
      ];

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { db } = await import('$lib/server/db');
      db.template.findMany.mockResolvedValue(mockTemplates);

      const response = await GET({ locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData).toHaveLength(3);
      expect(responseData.find(t => t.deliveryMethod === 'congressional')).toBeTruthy();
      expect(responseData.find(t => t.deliveryMethod === 'email')).toBeTruthy();
      expect(responseData.find(t => t.deliveryMethod === 'both')).toBeTruthy();
    });

    it('handles templates with public and private visibility', async () => {
      const mockSession = {
        user: {
          id: 'user123'
        }
      };

      const mockTemplates = [
        {
          id: 'template1',
          title: 'Public Template',
          isPublic: true
        },
        {
          id: 'template2',
          title: 'Private Template',
          isPublic: false
        }
      ];

      mockLocals.auth.validate.mockResolvedValue(mockSession);

      const { db } = await import('$lib/server/db');
      db.template.findMany.mockResolvedValue(mockTemplates);

      const response = await GET({ locals: mockLocals } as any);
      const responseData = JSON.parse(response.body);

      expect(responseData).toHaveLength(2);
      expect(responseData.find(t => t.isPublic === true)).toBeTruthy();
      expect(responseData.find(t => t.isPublic === false)).toBeTruthy();
    });
  });
});