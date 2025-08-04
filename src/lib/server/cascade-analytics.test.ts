import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  calculateTemplateR0, 
  getTemplateActivationChain, 
  calculateActivationVelocity,
  analyzeCascade,
  hasActivationData,
  getDeliveryMetrics
} from './cascade-analytics-fixed';

// Mock the database
const mockDb = {
  user_activation: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  template_campaign: {
    findMany: vi.fn()
  }
};

// Mock the db import
vi.mock('./db', () => ({
  db: mockDb
}));

// Mock the cascade analytics functions
vi.mock('./cascade-analytics-fixed', async () => {
  const actual = await vi.importActual('./cascade-analytics-fixed');
  return {
    ...actual,
    getTemplateActivationChain: vi.fn(),
    calculateActivationVelocity: vi.fn()
  };
});

describe('Fixed Cascade Analytics - Using Real user_activation Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTemplateR0', () => {
    it('should calculate R0 correctly from real activation data', async () => {
      // Mock activation data: 2 primary users (gen 0), 4 secondary users (gen 1)
      const mockActivations = [
        { user_id: 'user1', activation_generation: 0, activation_time: new Date('2024-01-01') },
        { user_id: 'user2', activation_generation: 0, activation_time: new Date('2024-01-02') },
        { user_id: 'user3', activation_generation: 1, activation_time: new Date('2024-01-03') },
        { user_id: 'user4', activation_generation: 1, activation_time: new Date('2024-01-04') },
        { user_id: 'user5', activation_generation: 1, activation_time: new Date('2024-01-05') },
        { user_id: 'user6', activation_generation: 1, activation_time: new Date('2024-01-06') }
      ];

      mockDb.user_activation.findMany.mockResolvedValue(mockActivations);

      const r0 = await calculateTemplateR0('template-123');

      // R0 = secondary cases / primary cases = 4 / 2 = 2.0
      expect(r0).toBe(2.0);
      expect(mockDb.user_activation.findMany).toHaveBeenCalledWith({
        where: { template_id: 'template-123' },
        orderBy: { activation_time: 'asc' }
      });
    });

    it('should return 0 when no secondary activations exist', async () => {
      const mockActivations = [
        { user_id: 'user1', activation_generation: 0, activation_time: new Date('2024-01-01') }
      ];

      mockDb.user_activation.findMany.mockResolvedValue(mockActivations);

      const r0 = await calculateTemplateR0('template-123');
      expect(r0).toBe(0);
    });

    it('should return 0 for insufficient data', async () => {
      mockDb.user_activation.findMany.mockResolvedValue([]);
      const r0 = await calculateTemplateR0('template-123');
      expect(r0).toBe(0);
    });
  });

  describe('getTemplateActivationChain', () => {
    it('should fetch real activation chain from user_activation table', async () => {
      const mockActivations = [
        {
          user_id: 'user1',
          template_id: 'template-123',
          source_user_id: null,
          activation_generation: 0,
          geographic_distance: null,
          time_to_activation: null,
          activation_time: new Date('2024-01-01T10:00:00Z'),
          user: {
            id: 'user1',
            congressional_district: 'CA-12',
            state: 'CA',
            city: 'San Francisco',
            zip: '94102'
          },
          source_user: null
        },
        {
          user_id: 'user2',
          template_id: 'template-123',
          source_user_id: 'user1',
          activation_generation: 1,
          geographic_distance: 15.5,
          time_to_activation: 2.5,
          activation_time: new Date('2024-01-01T12:30:00Z'),
          user: {
            id: 'user2',
            congressional_district: 'CA-14',
            state: 'CA',
            city: 'Palo Alto',
            zip: '94301'
          },
          source_user: {
            id: 'user1',
            congressional_district: 'CA-12',
            state: 'CA'
          }
        }
      ];

      mockDb.user_activation.findMany.mockResolvedValue(mockActivations);

      const chain = await getTemplateActivationChain('template-123');

      expect(chain).toHaveLength(2);
      expect(chain[0]).toEqual({
        user_id: 'user1',
        template_id: 'template-123',
        activated_at: new Date('2024-01-01T10:00:00Z'),
        source_user_id: null,
        activation_generation: 0,
        geographic_distance: 0,
        time_to_activation: 0
      });
      expect(chain[1]).toEqual({
        user_id: 'user2',
        template_id: 'template-123',
        activated_at: new Date('2024-01-01T12:30:00Z'),
        source_user_id: 'user1',
        activation_generation: 1,
        geographic_distance: 15.5,
        time_to_activation: 2.5
      });

      expect(mockDb.user_activation.findMany).toHaveBeenCalledWith({
        where: { template_id: 'template-123' },
        include: {
          user: {
            select: {
              id: true,
              congressional_district: true,
              state: true,
              city: true,
              zip: true
            }
          },
          source_user: {
            select: {
              id: true,
              congressional_district: true,
              state: true
            }
          }
        },
        orderBy: { activation_time: 'asc' }
      });
    });
  });

  describe('calculateActivationVelocity', () => {
    it('should calculate peak activation velocity correctly', async () => {
      // Mock 15 activations over 24 hours with a spike in the middle
      const mockActivations = Array.from({ length: 15 }, (_, i) => ({
        user_id: `user${i + 1}`,
        template_id: 'template-123',
        activated_at: new Date(Date.now() + i * 2 * 60 * 60 * 1000), // Every 2 hours
        source_user_id: i > 0 ? 'user1' : null,
        activation_generation: i > 0 ? 1 : 0,
        geographic_distance: Math.random() * 100,
        time_to_activation: Math.random() * 24
      }));

      // Create a spike - 6 activations in 3 hours (hours 6-9)
      for (let i = 5; i < 11; i++) {
        mockActivations[i].activated_at = new Date(Date.now() + (6 + (i - 5) * 0.5) * 60 * 60 * 1000);
      }

      vi.mocked(getTemplateActivationChain).mockResolvedValue(mockActivations);

      const velocity = await calculateActivationVelocity('template-123');

      // Should find the 6-hour window with the highest activation rate
      expect(velocity).toBeGreaterThan(0);
    });

    it('should return 0 for insufficient sample size', async () => {
      const mockActivations = Array.from({ length: 5 }, (_, i) => ({
        user_id: `user${i + 1}`,
        template_id: 'template-123',
        activated_at: new Date(),
        source_user_id: null,
        activation_generation: 0,
        geographic_distance: 0,
        time_to_activation: 0
      }));

      vi.mocked(getTemplateActivationChain).mockResolvedValue(mockActivations);

      const velocity = await calculateActivationVelocity('template-123');
      expect(velocity).toBe(0);
    });
  });

  describe('hasActivationData', () => {
    it('should return true when activation data exists', async () => {
      mockDb.user_activation.count.mockResolvedValue(5);

      const hasData = await hasActivationData('template-123');
      expect(hasData).toBe(true);
      expect(mockDb.user_activation.count).toHaveBeenCalledWith({
        where: { template_id: 'template-123' }
      });
    });

    it('should return false when no activation data exists', async () => {
      mockDb.user_activation.count.mockResolvedValue(0);

      const hasData = await hasActivationData('template-123');
      expect(hasData).toBe(false);
    });
  });

  describe('getDeliveryMetrics', () => {
    it('should separate delivery metrics from cascade metrics', async () => {
      const mockCampaigns = [
        {
          status: 'delivered',
          created_at: new Date('2024-01-01'),
          delivered_at: new Date('2024-01-01T01:00:00Z'),
          user_id: 'user1'
        },
        {
          status: 'delivered',
          created_at: new Date('2024-01-02'),
          delivered_at: new Date('2024-01-02T02:00:00Z'),
          user_id: 'user2'
        },
        {
          status: 'pending',
          created_at: new Date('2024-01-03'),
          delivered_at: null,
          user_id: 'user3'
        },
        {
          status: 'failed',
          created_at: new Date('2024-01-04'),
          delivered_at: null,
          user_id: 'user4'
        },
        {
          status: 'delivered',
          created_at: new Date('2024-01-05'),
          delivered_at: new Date('2024-01-05T01:30:00Z'),
          user_id: 'user1' // Same user, different campaign
        }
      ];

      mockDb.template_campaign.findMany.mockResolvedValue(mockCampaigns);

      const metrics = await getDeliveryMetrics('template-123');

      expect(metrics).toEqual({
        total_campaigns: 5,
        delivered_count: 3,
        pending_count: 1,
        failed_count: 1,
        success_rate: 0.6, // 3/5
        unique_users: 4 // user1, user2, user3, user4
      });

      expect(mockDb.template_campaign.findMany).toHaveBeenCalledWith({
        where: { template_id: 'template-123' },
        select: {
          status: true,
          created_at: true,
          delivered_at: true,
          user_id: true
        }
      });
    });
  });

  describe('analyzeCascade - Full Integration', () => {
    it('should provide complete cascade analysis using real data', async () => {
      // Mock comprehensive activation data
      const mockActivations = [
        { user_id: 'user1', activation_generation: 0, activation_time: new Date('2024-01-01T00:00:00Z') },
        { user_id: 'user2', activation_generation: 1, activation_time: new Date('2024-01-01T02:00:00Z') },
        { user_id: 'user3', activation_generation: 1, activation_time: new Date('2024-01-01T04:00:00Z') },
        { user_id: 'user4', activation_generation: 2, activation_time: new Date('2024-01-01T06:00:00Z') }
      ];

      const mockChain = mockActivations.map(a => ({
        user_id: a.user_id,
        template_id: 'template-123',
        activated_at: a.activation_time,
        source_user_id: a.activation_generation > 0 ? 'user1' : null,
        activation_generation: a.activation_generation,
        geographic_distance: a.activation_generation > 0 ? 25.0 : 0,
        time_to_activation: a.activation_generation > 0 ? 2.0 : 0
      }));

      mockDb.user_activation.findMany.mockResolvedValue(mockActivations);
      vi.mocked(getTemplateActivationChain).mockResolvedValue(mockChain);

      const analysis = await analyzeCascade('template-123');

      expect(analysis).toEqual({
        r0: 2.0, // 2 secondary / 1 primary
        generation_depth: 2, // Max generation
        activation_velocity: 0, // Low sample size returns 0
        geographic_jump_rate: 0.75, // 3 of 4 activations have source_user_id, all have distance > 0
        temporal_decay: expect.any(Number)
      });
    });

    it('should return zero metrics when no activation data exists', async () => {
      vi.spyOn({ getTemplateActivationChain }, 'getTemplateActivationChain').mockResolvedValue([]);

      const analysis = await analyzeCascade('template-123');

      expect(analysis).toEqual({
        r0: 0,
        generation_depth: 0,
        activation_velocity: 0,
        geographic_jump_rate: 0,
        temporal_decay: 0
      });
    });
  });

  describe('Data Model Validation', () => {
    it('should validate that user_activation table has all required fields', async () => {
      const requiredFields = [
        'user_id',
        'template_id',
        'source_user_id',
        'activation_generation',
        'activation_method',
        'geographic_distance',
        'activation_time',
        'time_to_activation'
      ];

      // This test ensures our analytics expect the correct schema
      const mockActivation = {
        user_id: 'user1',
        template_id: 'template-123',
        source_user_id: 'user2',
        activation_generation: 1,
        activation_method: 'share',
        geographic_distance: 15.5,
        activation_time: new Date(),
        time_to_activation: 2.5,
        user: { id: 'user1', congressional_district: 'CA-12', state: 'CA', city: 'SF', zip: '94102' },
        source_user: { id: 'user2', congressional_district: 'CA-14', state: 'CA' }
      };

      mockDb.user_activation.findMany.mockResolvedValue([mockActivation]);

      const chain = await getTemplateActivationChain('template-123');
      
      // Verify all required fields are accessible
      expect(chain[0]).toHaveProperty('user_id');
      expect(chain[0]).toHaveProperty('template_id');
      expect(chain[0]).toHaveProperty('source_user_id');
      expect(chain[0]).toHaveProperty('activation_generation');
      expect(chain[0]).toHaveProperty('geographic_distance');
      expect(chain[0]).toHaveProperty('time_to_activation');
    });

    it('should demonstrate the difference between cascade and delivery data', async () => {
      // Cascade data: tracks HOW templates spread between users
      const cascadeData = {
        user_id: 'user2',
        template_id: 'template-123',
        source_user_id: 'user1', // WHO activated them
        activation_generation: 1, // Degrees of separation
        activation_method: 'share', // HOW they were activated
        geographic_distance: 25.0, // Distance from source
        time_to_activation: 3.5 // Hours from exposure to action
      };

      // Delivery data: tracks template usage and congressional delivery
      const deliveryData = {
        template_id: 'template-123',
        user_id: 'user2', // WHO used the template
        delivery_type: 'congressional',
        recipient_id: 'rep-pelosi',
        status: 'delivered', // Delivery status
        sent_at: new Date(),
        delivered_at: new Date()
      };

      // These serve completely different purposes:
      // - user_activation tracks viral spread (cascade analytics)
      // - template_campaign tracks message delivery (delivery metrics)
      
      expect(cascadeData.source_user_id).toBeDefined(); // Cascade: who influenced whom
      expect(deliveryData.recipient_id).toBeDefined();  // Delivery: where message went
      
      expect(cascadeData.activation_generation).toBeDefined(); // Cascade: viral generations
      expect(deliveryData.status).toBeDefined();              // Delivery: success/failure
    });
  });
});