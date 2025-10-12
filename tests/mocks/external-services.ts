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
export const selfXyzHandlers = [
  // Initialize verification session
  http.post('https://api.self.xyz/v1/verifications', () => {
    return HttpResponse.json({
      id: 'verification-123',
      status: 'pending',
      qr_code: 'data:image/png;base64,mock-qr-code',
      expires_at: '2024-10-04T08:00:00Z'
    });
  }),

  // Check verification status
  http.get('https://api.self.xyz/v1/verifications/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'verified',
      proof: {
        age_over_18: true,
        us_citizen: true,
        verified_at: '2024-10-04T07:30:00Z'
      }
    });
  }),

  // Webhook for verification completion
  http.post('https://api.self.xyz/webhooks/verification', () => {
    return HttpResponse.json({ received: true });
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

// Combine all handlers
export const externalServiceHandlers = [
  ...cwcHandlers,
  ...oauthHandlers,
  ...selfXyzHandlers,
  ...congressionalDataHandlers,
  ...sqsHandlers
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