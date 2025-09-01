import { vi } from 'vitest';
import { FEATURES, FeatureStatus } from '$lib/features/config';

export interface MockConfig {
  enabled: boolean;
  implementation?: any;
  metadata?: Record<string, unknown>;
}

export interface DatabaseMock {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  template: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user_representatives: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  representative: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  // Analytics tables
  analytics_event: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  user_session: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

class MockRegistry {
  private mocks = new Map<string, MockConfig>();
  private dbMock: DatabaseMock | null = null;

  /**
   * Auto-configure mocks based on feature flags
   */
  configureMocks() {
    // Core features always mocked
    this.enableMock('database', true);
    this.enableMock('congressional_routing', FEATURES.CONGRESSIONAL_ROUTING === FeatureStatus.ON);
    this.enableMock('oauth_login', FEATURES.OAUTH_LOGIN === FeatureStatus.ON);
    
    // Beta features conditionally mocked
    if (process.env.ENABLE_BETA === 'true') {
      this.enableMock('cascade_analytics', FEATURES.CASCADE_ANALYTICS === FeatureStatus.BETA);
      this.enableMock('legislative_channels', FEATURES.LEGISLATIVE_CHANNELS === FeatureStatus.BETA);
    }
    
    // Research features excluded unless explicitly enabled
    if (process.env.ENABLE_RESEARCH === 'true') {
      this.enableMock('political_field', FEATURES.POLITICAL_FIELD_MODELING === FeatureStatus.RESEARCH);
    }
  }

  private enableMock(service: string, enabled: boolean) {
    this.mocks.set(service, { enabled });
  }

  /**
   * Create database mock with consistent interface
   */
  createDatabaseMock(): DatabaseMock {
    if (this.dbMock) return this.dbMock;

    this.dbMock = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      template: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      user_representatives: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn()
      },
      representative: {
        findFirst: vi.fn(),
        create: vi.fn()
      },
      // Analytics tables
      analytics_event: {
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn(),
        delete: vi.fn()
      },
      user_session: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn().mockResolvedValue({ id: 'mock-session', session_id: 'mock-session-id' }),
        update: vi.fn(),
        delete: vi.fn()
      }
    };

    return this.dbMock;
  }

  /**
   * Create CWC client mock
   */
  createCWCMock() {
    return {
      cwcClient: {
        submitToHouse: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'house-msg-123',
          submissionId: 'cwc-house-456'
        }),
        submitToSenate: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'senate-msg-789',
          submissionId: 'cwc-senate-012'
        }),
        validateTemplate: vi.fn().mockResolvedValue({ valid: true }),
        getDeliveryStatus: vi.fn().mockResolvedValue({ 
          status: 'delivered',
          deliveredAt: new Date()
        })
      }
    };
  }

  /**
   * Create address lookup mock
   */
  createAddressLookupMock() {
    return {
      addressLookup: {
        lookupRepsByAddress: vi.fn().mockResolvedValue({
          house: {
            name: 'Rep. Jane Smith',
            bioguideId: 'S001234',
            officeCode: 'S001234',
            chamber: 'house',
            party: 'Democratic',
            district: '12',
            state: 'CA'
          },
          senate: [
            {
              name: 'Sen. Alex Padilla',
              bioguideId: 'P000145',
              officeCode: 'P000145',
              chamber: 'senate',
              party: 'Democratic',
              state: 'CA'
            },
            {
              name: 'Sen. Laphonza Butler',
              bioguideId: 'B001234',
              officeCode: 'B001234', 
              chamber: 'senate',
              party: 'Democratic',
              state: 'CA'
            }
          ],
          district: { state: 'CA', district: '12' }
        }),
        validateReps: vi.fn().mockResolvedValue({ valid: true, errors: [] })
      }
    };
  }

  /**
   * Create legislative delivery pipeline mock
   */
  createLegislativeMock() {
    return {
      deliveryPipeline: {
        deliverToRepresentatives: vi.fn().mockResolvedValue({
          job_id: 'test-job-123',
          total_recipients: 3,
          successful_deliveries: 3,
          failed_deliveries: 0,
          results: [
            { 
              success: true, 
              message_id: 'house-msg-123', 
              metadata: { representative: 'Rep. Jane Smith', provider: 'CWC' } 
            },
            { 
              success: true, 
              message_id: 'senate-msg-456', 
              metadata: { representative: 'Sen. Alex Padilla', provider: 'CWC' } 
            },
            { 
              success: true, 
              message_id: 'senate-msg-789', 
              metadata: { representative: 'Sen. Laphonza Butler', provider: 'CWC' } 
            }
          ],
          duration_ms: 1500
        })
      },
      adapterRegistry: {
        getAdapter: vi.fn().mockResolvedValue({
          country_code: 'US',
          name: 'United States Congress',
          lookupRepresentativesByAddress: vi.fn().mockResolvedValue([]),
          deliverMessage: vi.fn().mockResolvedValue({ success: true })
        }),
        getSupportedCountries: vi.fn().mockResolvedValue(['US', 'UK']),
        getCapabilities: vi.fn().mockResolvedValue([
          { country_code: 'US', methods: ['api', 'form'], tier: 2 },
          { country_code: 'UK', methods: ['email'], tier: 2 }
        ])
      }
    };
  }

  /**
   * Create analytics system mock
   */
  createAnalyticsMock() {
    return {
      analytics: {
        trackEvent: vi.fn().mockResolvedValue(undefined),
        trackFunnelEvent: vi.fn().mockResolvedValue(undefined),
        trackTemplateView: vi.fn().mockResolvedValue(undefined),
        trackOnboardingStarted: vi.fn().mockResolvedValue(undefined),
        trackAuthCompleted: vi.fn().mockResolvedValue(undefined),
        trackTemplateUsed: vi.fn().mockResolvedValue(undefined),
        trackSocialShare: vi.fn().mockResolvedValue(undefined),
        trackPageView: vi.fn().mockResolvedValue(undefined),
        trackInteraction: vi.fn().mockResolvedValue(undefined),
        trackError: vi.fn().mockResolvedValue(undefined),
        identifyUser: vi.fn().mockResolvedValue(undefined),
        flushEvents: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        isReady: true,
        currentSessionId: 'mock-session-123'
      },
      funnelAnalytics: {
        track: vi.fn(),
        trackTemplateView: vi.fn(),
        trackOnboardingStarted: vi.fn(),
        trackAuthCompleted: vi.fn(),
        trackTemplateUsed: vi.fn(),
        trackSocialShare: vi.fn(),
        getFunnelMetrics: vi.fn().mockReturnValue({
          total_events: 0,
          unique_templates: 0,
          conversion_rate: 0,
          funnel_steps: {
            template_viewed: 0,
            onboarding_started: 0,
            auth_completed: 0,
            template_used: 0
          }
        }),
        clear: vi.fn()
      }
    };
  }

  /**
   * Get SvelteKit mocks
   */
  createSvelteKitMocks() {
    return {
      json: vi.fn().mockImplementation((data) => ({ 
        body: JSON.stringify(data),
        status: 200,
        headers: { 'content-type': 'application/json' }
      })),
      error: vi.fn().mockImplementation((status, message) => ({ 
        status, 
        body: message,
        headers: {}
      })),
      redirect: vi.fn().mockImplementation((status, location) => ({
        status,
        headers: { location }
      }))
    };
  }

  /**
   * Setup all mocks for a test suite
   */
  setupMocks() {
    this.configureMocks();

    const mocks = {
      // Database
      '$lib/core/db': { db: this.createDatabaseMock() },
      
      // Congressional services
      '$lib/congress/cwc-client': this.createCWCMock(),
      '$lib/congress/address-lookup': this.createAddressLookupMock(),
      
      // New legislative abstraction
      '$lib/core/legislative': this.createLegislativeMock(),
      
      // Analytics system
      '$lib/core/analytics/database': this.createAnalyticsMock().analytics,
      '$lib/analytics/funnel': this.createAnalyticsMock().funnelAnalytics,
      
      // SvelteKit
      '@sveltejs/kit': this.createSvelteKitMocks(),

      // Services (only if enabled)
      ...(this.mocks.get('cascade_analytics')?.enabled && {
        '$lib/experimental/cascade/cascade-analytics-fixed': {
          calculateTemplateR0: vi.fn().mockResolvedValue(2.5),
          getTemplateActivationChain: vi.fn().mockResolvedValue([]),
          analyzeCascade: vi.fn().mockResolvedValue({
            r0: 2.5,
            generation_depth: 3,
            activation_velocity: 1.2,
            geographic_jump_rate: 0.65,
            temporal_decay: 0.85
          })
        }
      })
    };

    return mocks;
  }

  /**
   * Reset all mocks
   */
  reset() {
    this.dbMock = null;
    this.mocks.clear();
  }

  /**
   * Get current mock configuration
   */
  getConfig() {
    return Object.fromEntries(this.mocks);
  }
}

export const mockRegistry = new MockRegistry();
export default mockRegistry;