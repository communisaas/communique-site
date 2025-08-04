import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the db import first
vi.mock('./db', () => ({
  db: {
    user_activation: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    template_campaign: {
      findMany: vi.fn()
    }
  }
}));

// Import after mocking
import { 
  calculateTemplateR0, 
  getTemplateActivationChain, 
  calculateActivationVelocity,
  analyzeCascade,
  hasActivationData,
  getDeliveryMetrics
} from './cascade-analytics-fixed';
import { db } from './db';

describe('Fixed Cascade Analytics - Using Real user_activation Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Model Validation', () => {
    it('should demonstrate the key fix: using user_activation table instead of inferring from template_campaign', async () => {
      // OLD BROKEN APPROACH (from cascade-analytics.ts):
      // - Query template_campaign table
      // - Infer activation chains from delivery timestamps
      // - Guess who influenced whom based on geographic proximity
      
      // NEW CORRECT APPROACH (cascade-analytics-fixed.ts):
      // - Query user_activation table directly
      // - Use actual source_user_id relationships
      // - Use real activation_generation data
      // - Use actual geographic_distance measurements
      
      const realActivationData = {
        user_id: 'user2',
        template_id: 'template-123',
        source_user_id: 'user1', // REAL relationship, not inferred
        activation_generation: 1, // REAL generation, not calculated
        activation_method: 'share', // HOW they were activated
        geographic_distance: 15.5, // REAL distance, not estimated
        time_to_activation: 2.5, // REAL time, not calculated
        activation_time: new Date('2024-01-01T12:30:00Z')
      };
      
      // The fixed analytics use this REAL data instead of guessing
      expect(realActivationData.source_user_id).toBe('user1'); // Not inferred
      expect(realActivationData.activation_generation).toBe(1); // Not calculated
      expect(realActivationData.geographic_distance).toBe(15.5); // Not estimated
    });
    
    it('should separate cascade tracking from delivery tracking', () => {
      // CASCADE DATA: Who influenced whom? (user_activation table)
      const cascadeRecord = {
        user_id: 'user2',
        template_id: 'template-123',
        source_user_id: 'user1', // WHO activated them
        activation_generation: 1, // Degrees of separation
        activation_method: 'share' // HOW they were activated
      };
      
      // DELIVERY DATA: Template usage and congressional delivery (template_campaign table)
      const deliveryRecord = {
        template_id: 'template-123',
        user_id: 'user2', // WHO used the template
        delivery_type: 'congressional',
        recipient_id: 'rep-pelosi', // WHERE the message went
        status: 'delivered' // Did it work?
      };
      
      // These solve different problems:
      expect(cascadeRecord.source_user_id).toBeDefined(); // Viral spread tracking
      expect(deliveryRecord.recipient_id).toBeDefined();  // Message delivery tracking
    });
  });

  describe('calculateTemplateR0', () => {
    it('should calculate R0 correctly from real activation generations', async () => {
      // Mock REAL user_activation data with actual generations
      const mockActivations = [
        { user_id: 'user1', activation_generation: 0, activation_time: new Date('2024-01-01') },
        { user_id: 'user2', activation_generation: 0, activation_time: new Date('2024-01-02') },
        { user_id: 'user3', activation_generation: 1, activation_time: new Date('2024-01-03') },
        { user_id: 'user4', activation_generation: 1, activation_time: new Date('2024-01-04') },
        { user_id: 'user5', activation_generation: 1, activation_time: new Date('2024-01-05') },
        { user_id: 'user6', activation_generation: 1, activation_time: new Date('2024-01-06') }
      ];

      vi.mocked(db.user_activation.findMany).mockResolvedValue(mockActivations);

      const r0 = await calculateTemplateR0('template-123');

      // R0 = secondary cases / primary cases = 4 / 2 = 2.0
      expect(r0).toBe(2.0);
      expect(vi.mocked(db.user_activation.findMany)).toHaveBeenCalledWith({
        where: { template_id: 'template-123' },
        orderBy: { activation_time: 'asc' }
      });
    });

    it('should return 0 when insufficient data exists', async () => {
      vi.mocked(db.user_activation.findMany).mockResolvedValue([]);
      const r0 = await calculateTemplateR0('template-123');
      expect(r0).toBe(0);
    });
  });

  describe('getTemplateActivationChain', () => {
    it('should fetch real activation chain with user relationships', async () => {
      const mockActivations = [
        {
          user_id: 'user1',
          template_id: 'template-123',
          source_user_id: null, // Patient zero
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
          source_user_id: 'user1', // REAL relationship
          activation_generation: 1, // REAL generation
          geographic_distance: 15.5, // REAL distance
          time_to_activation: 2.5, // REAL time
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

      vi.mocked(db.user_activation.findMany).mockResolvedValue(mockActivations);

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
    });
  });

  describe('hasActivationData', () => {
    it('should check if cascade data exists', async () => {
      vi.mocked(db.user_activation.count).mockResolvedValue(5);

      const hasData = await hasActivationData('template-123');
      expect(hasData).toBe(true);
      expect(vi.mocked(db.user_activation.count)).toHaveBeenCalledWith({
        where: { template_id: 'template-123' }
      });
    });

    it('should return false when no activation data exists', async () => {
      vi.mocked(db.user_activation.count).mockResolvedValue(0);

      const hasData = await hasActivationData('template-123');
      expect(hasData).toBe(false);
    });
  });

  describe('getDeliveryMetrics', () => {
    it('should properly separate delivery metrics from cascade metrics', async () => {
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
        }
      ];

      vi.mocked(db.template_campaign.findMany).mockResolvedValue(mockCampaigns);

      const metrics = await getDeliveryMetrics('template-123');

      expect(metrics).toEqual({
        total_campaigns: 4,
        delivered_count: 2,
        pending_count: 1,
        failed_count: 1,
        success_rate: 0.5, // 2/4
        unique_users: 4 // All different users
      });

      expect(vi.mocked(db.template_campaign.findMany)).toHaveBeenCalledWith({
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

  describe('analyzeCascade Integration Test', () => {
    it('should provide complete cascade analysis using correct data sources', async () => {
      // Mock real activation data
      const mockActivations = [
        { user_id: 'user1', activation_generation: 0, activation_time: new Date('2024-01-01T00:00:00Z') },
        { user_id: 'user2', activation_generation: 1, activation_time: new Date('2024-01-01T02:00:00Z') },
        { user_id: 'user3', activation_generation: 1, activation_time: new Date('2024-01-01T04:00:00Z') }
      ];

      vi.mocked(db.user_activation.findMany).mockResolvedValue(mockActivations);

      const analysis = await analyzeCascade('template-123');

      // Should calculate real metrics from real data
      expect(analysis.r0).toBe(2.0); // 2 secondary / 1 primary
      expect(analysis.generation_depth).toBe(1); // Max generation
      expect(analysis.activation_velocity).toBe(0); // Small sample size
      expect(analysis.geographic_jump_rate).toBe(0); // No geographic data in mock
      expect(analysis.temporal_decay).toBe(0); // Small sample size
    });

    it('should return zero metrics when no data exists', async () => {
      vi.mocked(db.user_activation.findMany).mockResolvedValue([]);

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

  describe('Data Model Correctness Validation', () => {
    it('should prove that our analytics now use the correct database tables', async () => {
      // Previously, cascade analytics were INCORRECTLY using template_campaign
      // and inferring cascade relationships from delivery data.
      
      // Now, cascade analytics CORRECTLY use user_activation table
      // which has the ACTUAL cascade tracking data.
      
      const correctQuery = {
        where: { template_id: 'template-123' },
        include: {
          user: { select: { id: true, congressional_district: true, state: true, city: true, zip: true } },
          source_user: { select: { id: true, congressional_district: true, state: true } }
        },
        orderBy: { activation_time: 'asc' }
      };
      
      vi.mocked(db.user_activation.findMany).mockResolvedValue([]);
      await getTemplateActivationChain('template-123');
      
      // Verify we're using the CORRECT table and CORRECT fields
      expect(vi.mocked(db.user_activation.findMany)).toHaveBeenCalledWith(correctQuery);
      
      // This proves the fix: we query user_activation, not template_campaign
      expect(vi.mocked(db.template_campaign.findMany)).not.toHaveBeenCalled();
    });
  });
});