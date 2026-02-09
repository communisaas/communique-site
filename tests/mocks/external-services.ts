/**
 * External Service Mocks using MSW
 * 
 * Mocks only external services, not internal business logic.
 * This allows us to test real code paths with predictable external dependencies.
 */

import { http, HttpResponse } from 'msw';

// CWC (Communicating With Congress) API Mocks
export const cwcHandlers = [
  // House submission endpoint
  http.post('https://cwc-api.house.gov/submit', () => {
    return HttpResponse.json({
      success: true,
      submissionId: 'house-12345',
      status: 'queued',
      estimatedDelivery: '2024-10-04T08:00:00Z'
    });
  }),

  // Senate submission endpoint  
  http.post('https://cwc-api.senate.gov/submit', () => {
    return HttpResponse.json({
      success: true,
      submissionId: 'senate-67890',
      status: 'queued',
      estimatedDelivery: '2024-10-04T08:00:00Z'
    });
  }),

  // Job status check
  http.get('https://cwc-api.house.gov/jobs/:jobId', ({ params }) => {
    return HttpResponse.json({
      jobId: params.jobId,
      status: 'completed',
      deliveredAt: '2024-10-04T07:45:00Z',
      recipients: ['rep.smith@mail.house.gov']
    });
  }),

  // Error scenarios for testing
  http.post('https://cwc-api.house.gov/submit-error', () => {
    return HttpResponse.json(
      { error: 'Invalid ZIP code format', code: 'INVALID_ZIP' },
      { status: 400 }
    );
  })
];

// OAuth Provider Mocks
export const oauthHandlers = [
  // Google OAuth token exchange
  http.post('https://oauth2.googleapis.com/token', () => {
    return HttpResponse.json({
      access_token: 'mock-google-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      scope: 'openid email profile'
    });
  }),

  // Google user info
  http.get('https://www.googleapis.com/oauth2/v2/userinfo', () => {
    return HttpResponse.json({
      id: 'google-123456',
      email: 'test@gmail.com',
      verified_email: true,
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg'
    });
  }),

  // Facebook OAuth  
  http.post('https://graph.facebook.com/v18.0/oauth/access_token', () => {
    return HttpResponse.json({
      access_token: 'mock-facebook-token',
      token_type: 'bearer',
      expires_in: 5183944
    });
  }),

  // Twitter OAuth
  http.post('https://api.twitter.com/2/oauth2/token', () => {
    return HttpResponse.json({
      token_type: 'bearer',
      expires_in: 7200,
      access_token: 'mock-twitter-token',
      scope: 'tweet.read users.read'
    });
  })
];

// Self.xyz Identity Verification Mocks
// The Self.xyz SDK uses Celo blockchain RPC to verify ZK proofs on-chain
export const selfXyzHandlers = [
  // Celo Alfajores Testnet RPC (used when SELF_MOCK_PASSPORT=true)
  http.post('https://alfajores-forno.celo-testnet.org', async ({ request }) => {
    const body = await request.json() as any;
    const method = body.method;

    // Mock smart contract responses for ZK proof verification
    if (method === 'eth_call') {
      // Return mock data indicating valid verification
      // The actual verification logic runs in the SDK
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: '0x0000000000000000000000000000000000000000000000000000000000000001' // true
      });
    }

    // Default response for other RPC methods
    return HttpResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result: '0x'
    });
  }),

  // Celo Mainnet RPC (used when SELF_MOCK_PASSPORT=false)
  http.post('https://forno.celo.org', async ({ request }) => {
    const body = await request.json() as any;
    const method = body.method;

    if (method === 'eth_call') {
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: '0x0000000000000000000000000000000000000000000000000000000000000001' // true
      });
    }

    return HttpResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result: '0x'
    });
  })
];

// Congressional Data Services Mocks
export const congressionalDataHandlers = [
  // Representative lookup by address
  http.get('https://www.googleapis.com/civicinfo/v2/representatives', ({ request }) => {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    
    return HttpResponse.json({
      offices: [
        {
          name: 'United States House of Representatives',
          divisionId: 'ocd-division/country:us/state:ca/cd:12',
          levels: ['country'],
          roles: ['legislatorLowerBody'],
          officialIndices: [0]
        }
      ],
      officials: [
        {
          name: 'Nancy Pelosi',
          party: 'Democratic Party',
          emails: ['nancy.pelosi@mail.house.gov'],
          urls: ['https://pelosi.house.gov/'],
          channels: [
            { type: 'Twitter', id: 'SpeakerPelosi' }
          ]
        }
      ]
    });
  }),

  // District boundaries
  http.get('https://www.googleapis.com/civicinfo/v2/divisions', () => {
    return HttpResponse.json({
      results: [
        {
          ocdId: 'ocd-division/country:us/state:ca/cd:12',
          name: 'California\'s 12th congressional district'
        }
      ]
    });
  })
];

// AWS SQS Mocks for async processing
export const sqsHandlers = [
  // Send message to queue
  http.post('https://sqs.us-west-2.amazonaws.com/123456789/cwc-submissions', () => {
    return HttpResponse.json({
      MessageId: 'msg-12345-67890',
      MD5OfBody: 'mock-md5-hash',
      MD5OfMessageAttributes: 'mock-attr-hash'
    });
  }),

  // Receive messages
  http.get('https://sqs.us-west-2.amazonaws.com/123456789/cwc-submissions', () => {
    return HttpResponse.json({
      Messages: [
        {
          MessageId: 'msg-12345-67890',
          ReceiptHandle: 'mock-receipt-handle',
          Body: JSON.stringify({
            templateId: 'template-123',
            userId: 'user-456',
            submissionType: 'congressional'
          })
        }
      ]
    });
  })
];

// Census and Congress.gov API Handlers
export const censusAndCongressHandlers = [
  // Census Bureau Geocoding API
  http.get('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress', ({ request }) => {
    const url = new URL(request.url);
    const address = (url.searchParams.get('address') || '').toLowerCase();

    // Mock DC address (case-insensitive)
    if (address.includes('pennsylvania') || address.includes('washington, dc') ||
        (address.includes('dc') && address.includes('20500'))) {
      return HttpResponse.json({
        result: {
          addressMatches: [
            {
              matchedAddress: '1600 Pennsylvania Ave NW, Washington, DC 20500',
              geographies: {
                '119th Congressional Districts': [
                  {
                    CD119: '98', // DC delegate special code
                    GEOID: '1100'
                  }
                ],
                '2020 Census Blocks': [
                  {
                    GEOID: '110010062001001', // 15-digit Census Block GEOID for DC
                    STATE: '11',
                    COUNTY: '001',
                    TRACT: '006200',
                    BLOCK: '1001',
                    NAME: 'Block 1001'
                  }
                ]
              }
            }
          ]
        }
      });
    }

    // Mock NYC address (case-insensitive)
    if (address.includes('350 fifth avenue') || address.includes('350 5th ave') ||
        (address.includes('new york') && address.includes('ny'))) {
      return HttpResponse.json({
        result: {
          addressMatches: [
            {
              matchedAddress: '350 Fifth Avenue, New York, NY 10118',
              geographies: {
                '119th Congressional Districts': [
                  {
                    CD119: '10',
                    GEOID: '3610'
                  }
                ],
                '2020 Census Blocks': [
                  {
                    GEOID: '360610076001234', // 15-digit Census Block GEOID for NYC
                    STATE: '36',
                    COUNTY: '061',
                    TRACT: '007600',
                    BLOCK: '1234',
                    NAME: 'Block 1234'
                  }
                ]
              }
            }
          ]
        }
      });
    }

    // Mock Puerto Rico address (case-insensitive)
    if (address.includes('san juan') || address.includes('puerto rico') ||
        (address.includes('pr') && address.includes('00901'))) {
      return HttpResponse.json({
        result: {
          addressMatches: [
            {
              matchedAddress: 'San Juan, PR 00901',
              geographies: {
                '119th Congressional Districts': [
                  {
                    CD119: '98',
                    GEOID: '7200'
                  }
                ],
                '2020 Census Blocks': [
                  {
                    GEOID: '720070065003001', // 15-digit Census Block GEOID for PR
                    STATE: '72',
                    COUNTY: '007',
                    TRACT: '006500',
                    BLOCK: '3001',
                    NAME: 'Block 3001'
                  }
                ]
              }
            }
          ]
        }
      });
    }

    // Invalid address (ZZ state, 00000 zip, etc.)
    return HttpResponse.json({
      result: {
        addressMatches: []
      }
    });
  }),

  // Congress.gov API - Representatives
  // Returns current members with proper pagination support
  http.get('https://api.congress.gov/v3/member', ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '250', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // All current members (119th Congress)
    const allMembers = [
      // NYC Representatives
      {
        bioguideId: 'NYS001',
        name: 'Schumer, Chuck',
        partyName: 'Democratic',
        state: 'NY',
        currentMember: true,
        terms: {
          item: [{ chamber: 'Senate', startYear: 1999, party: 'Democratic' }]
        }
      },
      {
        bioguideId: 'NYS002',
        name: 'Gillibrand, Kirsten',
        partyName: 'Democratic',
        state: 'NY',
        currentMember: true,
        terms: {
          item: [{ chamber: 'Senate', startYear: 2009, party: 'Democratic' }]
        }
      },
      {
        bioguideId: 'NYH010',
        name: 'Goldman, Daniel',
        partyName: 'Democratic',
        state: 'NY',
        district: 10,
        currentMember: true,
        terms: {
          item: [{ chamber: 'House of Representatives', startYear: 2023, party: 'Democratic' }]
        }
      },
      // DC Delegate
      {
        bioguideId: 'N000147',
        name: 'Norton, Eleanor Holmes',
        partyName: 'Democratic',
        state: 'DC',
        district: undefined,
        currentMember: true,
        terms: {
          item: [{ chamber: 'House of Representatives', startYear: 1991, party: 'Democratic' }]
        }
      },
      // Puerto Rico Resident Commissioner
      {
        bioguideId: 'G000619',
        name: 'Hernández Rivera, Pablo José',
        partyName: 'New Progressive',
        state: 'PR',
        district: undefined,
        currentMember: true,
        terms: {
          item: [{ chamber: 'House of Representatives', startYear: 2025, party: 'New Progressive' }]
        }
      }
    ];

    // Apply pagination
    const paginatedMembers = allMembers.slice(offset, offset + limit);

    return HttpResponse.json({
      members: paginatedMembers,
      pagination: {
        count: paginatedMembers.length,
        next: offset + limit < allMembers.length ? `/v3/member?offset=${offset + limit}&limit=${limit}` : null
      }
    });
  }),

  // CWC Senate API (testing endpoint)
  http.post(/https:\/\/soapbox\.senate\.gov\/api\/testing-messages\/.*/, () => {
    return HttpResponse.json({
      messageId: `SEN-${Date.now()}`,
      status: 'submitted',
      timestamp: new Date().toISOString()
    });
  }),

  // CWC House API via proxy (will fail without proper config)
  http.post(/http:\/\/.*:8080\/api\/house\/submit.*/, () => {
    return HttpResponse.json(
      {
        error: 'House CWC delivery not configured'
      },
      { status: 500 }
    );
  })
];

// Combine all handlers
export const externalServiceHandlers = [
  ...cwcHandlers,
  ...oauthHandlers,
  ...selfXyzHandlers,
  ...congressionalDataHandlers,
  ...sqsHandlers,
  ...censusAndCongressHandlers
];

// Error scenario handlers for testing edge cases
export const errorHandlers = [
  // Network timeout simulation
  http.post('https://cwc-api.house.gov/timeout', () => {
    return new Promise(() => {}); // Never resolves - simulates timeout
  }),

  // Rate limiting
  http.post('https://cwc-api.house.gov/rate-limit', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded', retry_after: 60 },
      { status: 429 }
    );
  }),

  // Server error
  http.post('https://cwc-api.house.gov/server-error', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  })
];

export { http, HttpResponse };