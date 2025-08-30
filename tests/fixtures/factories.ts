// Simple ID generator for tests
let idCounter = 1000;
const snowflake = () => (++idCounter).toString();

export interface FactoryOptions<T> {
  overrides?: Partial<T>;
  count?: number;
}

/**
 * Base factory class for creating test data
 */
abstract class Factory<T> {
  abstract build(options?: FactoryOptions<T>): T;

  buildList(count: number, options?: FactoryOptions<T>): T[] {
    return Array.from({ length: count }, () => this.build(options));
  }

  /**
   * Create factory with custom defaults
   */
  withDefaults(defaults: Partial<T>): Factory<T> {
    const originalBuild = this.build.bind(this);
    this.build = (options?: FactoryOptions<T>) => ({
      ...originalBuild(options),
      ...defaults,
      ...(options?.overrides || {})
    });
    return this;
  }
}

/**
 * User factory
 */
export class UserFactory extends Factory<{
  id: string;
  name: string;
  email: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  congressional_district?: string;
  phone?: string;
  created_at: Date;
  updated_at: Date;
}> {
  build(options?: FactoryOptions<any>) {
    const id = snowflake().toString();
    const baseUser = {
      id,
      name: `Test User ${id.slice(-4)}`,
      email: `user${id.slice(-4)}@test.com`,
      street: '123 Main Street',
      city: 'San Francisco', 
      state: 'CA',
      zip: '94102',
      congressional_district: 'CA-12',
      phone: '+1-555-123-4567',
      created_at: new Date(),
      updated_at: new Date()
    };

    return {
      ...baseUser,
      ...(options?.overrides || {})
    };
  }
}

/**
 * Template factory
 */
export class TemplateFactory extends Factory<{
  id: string;
  title: string;
  subject: string;
  message_body: string;
  category: string;
  tags: string[];
  is_public: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}> {
  build(options?: FactoryOptions<any>) {
    const id = snowflake().toString();
    const baseTemplate = {
      id,
      title: `Test Template ${id.slice(-4)}`,
      subject: 'Important Legislative Issue',
      message_body: 'Dear [representative.title],\n\nI am writing to you about [issue]. [Personal Connection]\n\nSincerely,\n[user.name]',
      category: 'advocacy',
      tags: ['test', 'advocacy'],
      is_public: true,
      created_by: 'user123',
      created_at: new Date(),
      updated_at: new Date()
    };

    return {
      ...baseTemplate,
      ...(options?.overrides || {})
    };
  }
}

/**
 * Representative factory  
 */
export class RepresentativeFactory extends Factory<{
  id: string;
  name: string;
  bioguide_id: string;
  chamber: 'house' | 'senate';
  party: string;
  state: string;
  district?: string;
  office_code: string;
  phone?: string;
  email?: string;
}> {
  build(options?: FactoryOptions<any>) {
    const id = snowflake().toString();
    const chamber = options?.overrides?.chamber || 'house';
    const state = options?.overrides?.state || 'CA';
    const district = chamber === 'house' ? (options?.overrides?.district || '12') : undefined;
    
    const baseRep = {
      id,
      name: chamber === 'senate' 
        ? `Sen. Test Senator ${id.slice(-4)}`
        : `Rep. Test Representative ${id.slice(-4)}`,
      bioguide_id: `T${id.slice(-6)}`,
      chamber,
      party: 'Democratic',
      state,
      district,
      office_code: `T${id.slice(-6)}`,
      phone: '+1-202-224-0000',
      email: `${chamber}@congress.gov`
    };

    return {
      ...baseRep,
      ...(options?.overrides || {})
    };
  }
}

/**
 * Address factory
 */
export class AddressFactory extends Factory<{
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
}> {
  build(options?: FactoryOptions<any>) {
    const baseAddress = {
      street: '123 Main Street',
      city: 'San Francisco',
      state: 'CA', 
      postal_code: '94102',
      country_code: 'US'
    };

    return {
      ...baseAddress,
      ...(options?.overrides || {})
    };
  }
}

/**
 * Congressional office factory
 */
export class CongressionalOfficeFactory extends Factory<{
  bioguideId: string;
  name: string;
  chamber: 'house' | 'senate';
  officeCode: string;
  state: string;
  district?: string;
  party: string;
}> {
  build(options?: FactoryOptions<any>) {
    const chamber = options?.overrides?.chamber || 'house';
    const state = options?.overrides?.state || 'CA';
    const bioguideId = options?.overrides?.bioguideId || 'T123456';
    
    const baseOffice = {
      bioguideId,
      name: chamber === 'senate' 
        ? `Sen. ${bioguideId}`
        : `Rep. ${bioguideId}`,
      chamber,
      officeCode: bioguideId,
      state,
      district: chamber === 'house' ? '12' : undefined,
      party: 'Democratic'
    };

    return {
      ...baseOffice,
      ...(options?.overrides || {})
    };
  }
}

/**
 * Delivery job factory
 */
export class DeliveryJobFactory extends Factory<{
  id: string;
  template: any;
  user: any;
  target_country?: string;
  custom_message?: string;
  created_at: Date;
}> {
  build(options?: FactoryOptions<any>) {
    const id = `job-${snowflake().toString()}`;
    
    const baseJob = {
      id,
      template: new TemplateFactory().build(),
      user: new UserFactory().build(),
      target_country: 'US',
      custom_message: 'This is my personal story about why this issue matters to me.',
      created_at: new Date()
    };

    return {
      ...baseJob,
      ...(options?.overrides || {})
    };
  }
}

/**
 * Mock request factory for API tests
 */
export class MockRequestFactory extends Factory<{
  json: () => Promise<any>;
  headers: Map<string, string>;
  url: URL;
  method: string;
}> {
  build(options?: FactoryOptions<any>) {
    const baseRequest = {
      json: async () => ({}),
      headers: new Map(),
      url: new URL('http://localhost:5173'),
      method: 'GET'
    };

    return {
      ...baseRequest,
      ...(options?.overrides || {})
    };
  }
}

// Export factory instances for easy use
export const userFactory = new UserFactory();
export const templateFactory = new TemplateFactory();
export const representativeFactory = new RepresentativeFactory();
export const addressFactory = new AddressFactory();
export const congressionalOfficeFactory = new CongressionalOfficeFactory();
export const deliveryJobFactory = new DeliveryJobFactory();
export const mockRequestFactory = new MockRequestFactory();

// Export common test scenarios
export const testScenarios = {
  /**
   * California user with SF address
   */
  californiaUser: () => userFactory.build({
    overrides: {
      state: 'CA',
      city: 'San Francisco',
      zip: '94102',
      congressional_district: 'CA-12'
    }
  }),

  /**
   * Texas user with Austin address
   */
  texasUser: () => userFactory.build({
    overrides: {
      state: 'TX',
      city: 'Austin', 
      zip: '78701',
      congressional_district: 'TX-35'
    }
  }),

  /**
   * Climate action template
   */
  climateTemplate: () => templateFactory.build({
    overrides: {
      title: 'Support Climate Action',
      subject: 'Urgent: Support Climate Legislation',
      message_body: 'Dear [representative.title],\n\nAs your constituent, I urge you to support strong climate action. [Personal Connection]\n\nClimate change affects us all.\n\nSincerely,\n[user.name]',
      category: 'environment',
      tags: ['climate', 'environment', 'urgent']
    }
  }),

  /**
   * Healthcare template
   */
  healthcareTemplate: () => templateFactory.build({
    overrides: {
      title: 'Healthcare Access for All',
      subject: 'Support Universal Healthcare',
      message_body: 'Dear [representative.title],\n\nI am writing about healthcare access in our district. [Personal Connection]\n\nPlease support universal healthcare.\n\nSincerely,\n[user.name]',
      category: 'healthcare',
      tags: ['healthcare', 'access', 'universal']
    }
  }),

  /**
   * Congressional routing email
   */
  routingEmail: () => ({
    to: 'congress+climate-action-user123@communique.org',
    from: 'user@example.com',
    subject: 'Support Climate Action',
    body: 'This is my personal message about climate change.'
  }),

  /**
   * Guest routing email  
   */
  guestRoutingEmail: () => ({
    to: 'congress+guest-healthcare-sessionXYZ@communique.org',
    from: 'newuser@example.com', 
    subject: 'Healthcare Access',
    body: 'I support universal healthcare because...'
  })
};