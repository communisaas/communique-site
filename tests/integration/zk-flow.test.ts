import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as registerHandler } from '../../src/routes/api/shadow-atlas/register/+server';
import { POST as submitHandler } from '../../src/routes/api/congressional/submit/+server';
import { prisma } from '../../src/lib/core/db';

// Test context - computed fresh in beforeEach for true isolation
let testRunId: string;
let testUserId: string;
let testTemplateId: string;
let mockLocals: { user: { userId: string }; session: { id: string; userId: string } };

// NOTE: This test uses unique IDs per test run for parallel safety
// No clearTestDatabase() - creates isolated data that won't conflict with other tests
describe('ZKP Integration Flow', () => {
    beforeEach(async () => {
        // Generate unique IDs for THIS test execution (not module load)
        testRunId = `zk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        testUserId = `test-user-${testRunId}`;
        testTemplateId = `template-${testRunId}`;

        mockLocals = {
            user: { userId: testUserId },
            session: { id: `session-${testRunId}`, userId: testUserId }
        };

        // No cleanup needed - IDs are unique per test
        // Create user first (template depends on it)
        await prisma.user.create({
            data: {
                id: testUserId,
                email: `${testRunId}@example.com`,
                name: 'Test User'
            }
        });

        // Then create template (depends on user)
        await prisma.template.create({
            data: {
                id: testTemplateId,
                slug: `test-template-${testRunId}`,
                title: 'Test Template',
                description: 'Test Description',
                message_body: 'Test Body',
                category: 'test',
                type: 'congressional',
                userId: testUserId,
                deliveryMethod: 'email',
                preview: 'Test Preview',
                delivery_config: {},
                recipient_config: {},
                metrics: {}
            }
        });
    });

    it('should register a user and submit a proof', async () => {
        // 1. Registration
        const registerRequest = new Request('http://localhost/api/shadow-atlas/register', {
            method: 'POST',
            body: JSON.stringify({
                identityCommitment: 'mock-commitment-123',
                district: 'CA-12'
            })
        });

        const registerResponse = await registerHandler({
            request: registerRequest,
            locals: mockLocals as any,
            params: {},
            url: new URL('http://localhost/api/shadow-atlas/register'),
            route: { id: '/api/shadow-atlas/register' },
            platform: {},
            setHeaders: vi.fn(),
            cookies: {} as any,
            getClientAddress: vi.fn()
        });

        expect(registerResponse.status).toBe(200);
        const registerData = await registerResponse.json();
        expect(registerData.leafIndex).toBeDefined();
        expect(registerData.merklePath).toHaveLength(12); // Depth 12 (current configuration)
        expect(registerData.root).toBeDefined();

        // Verify DB state after registration
        const registration = await prisma.shadowAtlasRegistration.findUnique({
            where: { user_id: testUserId }
        });
        expect(registration).toBeDefined();
        expect(registration?.congressional_district).toBe('CA-12');

        // 2. Submission (use unique nullifier + actionId per test run)
        const submitRequest = new Request('http://localhost/api/congressional/submit', {
            method: 'POST',
            body: JSON.stringify({
                proof: 'mock-proof-hex',
                publicSignals: {
                    districtRoot: registerData.root,
                    nullifier: `nullifier-${testRunId}`
                },
                encryptedWitness: 'mock-witness-base64',
                encryptedMessage: 'mock-message-base64',
                templateId: testTemplateId,
                actionId: `action-${testRunId}`
            })
        });

        const submitResponse = await submitHandler({
            request: submitRequest,
            locals: mockLocals as any,
            params: {},
            url: new URL('http://localhost/api/congressional/submit'),
            route: { id: '/api/congressional/submit' },
            platform: {},
            setHeaders: vi.fn(),
            cookies: {} as any,
            getClientAddress: vi.fn()
        });

        expect(submitResponse.status).toBe(200);
        const submitData = await submitResponse.json();
        expect(submitData.success).toBe(true);
        expect(submitData.status).toBe('verified');

        // Verify DB state after submission
        const submission = await prisma.submission.findFirst({
            where: { user_id: testUserId }
        });
        expect(submission).toBeDefined();
        expect((submission as any)?.verification_status).toBe('verified');
        expect((submission as any)?.delivery_status).toBe('pending');
    });
});
