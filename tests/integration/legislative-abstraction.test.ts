import { describe, it, expect, vi } from 'vitest';
import { deliveryPipeline, adapterRegistry } from '$lib/core/legislative';
import { userFactory, templateFactory, deliveryJobFactory, addressFactory } from '../fixtures/factories';
import mockRegistry from '../mocks/registry';

describe('Legislative Abstraction Integration', () => {
  it('should handle US congressional delivery through adapter system', async () => {
    const user = userFactory.build({
      overrides: { 
        name: 'Jane Citizen',
        address: addressFactory.build({ overrides: { country_code: 'US' } })
      }
    });
    
    const template = templateFactory.build({
      overrides: {
        message_body: 'Dear [representative.name], I am [user.name] from [user.city]. [Personal Connection] Thank you.'
      }
    });

    const job = deliveryJobFactory.build({
      overrides: {
        user,
        template,
        target_country: 'US',
        custom_message: 'Climate change affects my community directly.'
      }
    });

    // Mock the adapter registry to return US adapter
    const mockUSAdapter = {
      country_code: 'US',
      name: 'United States Congress',
      lookupRepresentativesByAddress: vi.fn().mockResolvedValue([
        {
          id: 'us-house-ca-12',
          office_id: 'us-house-ca-12',
          name: 'Nancy Pelosi',
          party: 'Democratic',
          bioguide_id: 'P000197',
          is_current: true
        },
        {
          id: 'us-senate-ca-padilla',
          office_id: 'us-senate-ca',
          name: 'Alex Padilla', 
          party: 'Democratic',
          bioguide_id: 'P000145',
          is_current: true
        }
      ]),
      validateRepresentative: vi.fn().mockResolvedValue(true),
      deliverMessage: vi.fn().mockResolvedValue({
        success: true,
        message_id: 'cwc-msg-123',
        metadata: { provider: 'CWC', chamber: 'house' }
      })
    };

    vi.mocked(adapterRegistry.getAdapter).mockResolvedValue(mockUSAdapter);

    // Execute delivery
    const result = await deliveryPipeline.deliverToRepresentatives(job);

    // Verify adapter was called correctly
    expect(adapterRegistry.getAdapter).toHaveBeenCalledWith('US');
    expect(mockUSAdapter.lookupRepresentativesByAddress).toHaveBeenCalledWith({
      street: user.address?.street,
      city: user.address?.city,
      state: user.address?.state,
      postal_code: user.address?.postal_code,
      country_code: 'US'
    });

    // Verify delivery results
    expect(result.successful_deliveries).toBeGreaterThan(0);
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          success: true,
          message_id: expect.stringMatching(/cwc-msg-/),
          metadata: expect.objectContaining({
            provider: 'CWC'
          })
        })
      ])
    );
  });

  it('should handle UK parliamentary delivery through adapter system', async () => {
    const ukUser = userFactory.build({
      overrides: {
        name: 'John Smith',
        address: addressFactory.build({
          overrides: {
            street: '10 Downing Street',
            city: 'London',
            state: 'England', 
            postal_code: 'SW1A 2AA',
            country_code: 'UK'
          }
        })
      }
    });

    const template = templateFactory.build({
      overrides: {
        subject: 'Support Climate Action',
        message_body: 'Dear [representative.title], I am writing as your constituent. [Personal Connection] Please support this important issue.'
      }
    });

    const job = deliveryJobFactory.build({
      overrides: {
        user: ukUser,
        template,
        target_country: 'UK'
      }
    });

    // Mock UK Parliament adapter
    const mockUKAdapter = {
      country_code: 'UK',
      name: 'United Kingdom Parliament',
      lookupRepresentativesByAddress: vi.fn().mockResolvedValue([
        {
          id: 'uk-mp-SW1A2AA',
          office_id: 'uk-commons-SW1A2AA',
          name: 'MP for Westminster',
          party: 'Conservative',
          is_current: true
        }
      ]),
      validateRepresentative: vi.fn().mockResolvedValue(true),
      deliverMessage: vi.fn().mockResolvedValue({
        success: true,
        message_id: 'uk-msg-456',
        metadata: { provider: 'UK Parliament', method: 'email' }
      })
    };

    vi.mocked(adapterRegistry.getAdapter).mockResolvedValue(mockUKAdapter);

    const result = await deliveryPipeline.deliverToRepresentatives(job);

    // Verify UK-specific handling
    expect(adapterRegistry.getAdapter).toHaveBeenCalledWith('UK');
    expect(mockUKAdapter.lookupRepresentativesByAddress).toHaveBeenCalledWith({
      street: '10 Downing Street',
      city: 'London',
      state: 'England',
      postal_code: 'SW1A 2AA',
      country_code: 'UK'
    });

    expect(result.successful_deliveries).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        success: true,
        message_id: 'uk-msg-456',
        metadata: expect.objectContaining({
          provider: 'UK Parliament',
          method: 'email'
        })
      })
    );
  });

  it('should fall back to generic adapter for unsupported countries', async () => {
    const canadianUser = userFactory.build({
      overrides: {
        address: addressFactory.build({
          overrides: {
            country_code: 'CA',
            city: 'Toronto',
            state: 'ON',
            postal_code: 'M5V 3A8'
          }
        })
      }
    });

    const job = deliveryJobFactory.build({
      overrides: {
        user: canadianUser,
        target_country: 'CA'
      }
    });

    // Mock generic adapter (no specific implementation available)
    const mockGenericAdapter = {
      country_code: 'CA',
      name: 'Canada Legislative System',
      lookupRepresentativesByAddress: vi.fn().mockResolvedValue([]),
      validateRepresentative: vi.fn().mockResolvedValue(false),
      deliverMessage: vi.fn().mockResolvedValue({
        success: false,
        error: 'No delivery method available for CA',
        metadata: { provider: 'Generic', country: 'CA' }
      })
    };

    vi.mocked(adapterRegistry.getAdapter).mockResolvedValue(mockGenericAdapter);

    const result = await deliveryPipeline.deliverToRepresentatives(job);

    // Verify fallback behavior
    expect(result.successful_deliveries).toBe(0);
    expect(result.failed_deliveries).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        success: false,
        error: 'No delivery method available for CA'
      })
    );
  });

  it('should handle adapter registry capabilities query', async () => {
    vi.mocked(adapterRegistry.getSupportedCountries).mockResolvedValue(['US', 'UK']);
    vi.mocked(adapterRegistry.getCapabilities).mockResolvedValue([
      {
        country_code: 'US',
        methods: ['api', 'form'],
        tier: 2,
        provider: 'CWC'
      },
      {
        country_code: 'UK', 
        methods: ['email', 'form'],
        tier: 2,
        provider: 'Parliament.uk'
      }
    ]);

    const supportedCountries = await adapterRegistry.getSupportedCountries();
    const capabilities = await adapterRegistry.getCapabilities();

    expect(supportedCountries).toEqual(['US', 'UK']);
    expect(capabilities).toHaveLength(2);
    expect(capabilities[0]).toEqual(
      expect.objectContaining({
        country_code: 'US',
        methods: expect.arrayContaining(['api', 'form']),
        tier: 2,
        provider: 'CWC'
      })
    );
  });

  it('should validate representatives before delivery', async () => {
    const user = userFactory.build();
    const template = templateFactory.build();
    const job = deliveryJobFactory.build({ overrides: { user, template } });

    const mockAdapter = {
      country_code: 'US',
      name: 'United States Congress',
      lookupRepresentativesByAddress: vi.fn().mockResolvedValue([
        {
          id: 'us-house-ca-12',
          office_id: 'us-house-ca-12', 
          name: 'Former Rep (Term Ended)',
          is_current: true // Will fail validation
        }
      ]),
      validateRepresentative: vi.fn().mockResolvedValue(false), // Representative not current
      deliverMessage: vi.fn()
    };

    vi.mocked(adapterRegistry.getAdapter).mockResolvedValue(mockAdapter);

    const result = await deliveryPipeline.deliverToRepresentatives(job);

    // Should not attempt delivery to invalid representative
    expect(mockAdapter.validateRepresentative).toHaveBeenCalled();
    expect(mockAdapter.deliverMessage).not.toHaveBeenCalled();
    expect(result.total_recipients).toBe(0);
  });
});