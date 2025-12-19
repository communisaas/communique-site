import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as registerHandler } from '../../src/routes/api/shadow-atlas/register/+server';
import { POST as submitHandler } from '../../src/routes/api/congressional/submit/+server';
import { prisma } from '../../src/lib/core/db';

// Mock locals
const mockLocals = {
    user: { userId: 'test-user-id' },
    session: { id: 'test-session-id', userId: 'test-user-id' }
};

describe('ZKP Integration Flow', () => {
    beforeEach(async () => {
        // Clean up DB
        await prisma.submission.deleteMany();
        await prisma.shadowAtlasRegistration.deleteMany();
        await prisma.shadowAtlasTree.deleteMany();
        // Ensure user exists (upsert to avoid unique constraint if exists)
        await prisma.user.upsert({
            where: { id: 'test-user-id' },
            update: {},
            create: {
                id: 'test-user-id',
                email: 'test@example.com',
                name: 'Test User'
            }
        });

        // Ensure template exists
        await prisma.template.upsert({
            where: { id: 'template-123' },
            update: {},
            create: {
                id: 'template-123',
                slug: 'test-template',
                title: 'Test Template',
                description: 'Test Description',
                message_body: 'Test Body',
                category: 'test',
                type: 'congressional',
                userId: 'test-user-id',
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
        expect(registerData.merklePath).toHaveLength(14); // Depth 14
        expect(registerData.root).toBeDefined();

        // Verify DB state after registration
        const registration = await prisma.shadowAtlasRegistration.findUnique({
            where: { user_id: 'test-user-id' }
        });
        expect(registration).toBeDefined();
        expect(registration?.congressional_district).toBe('CA-12');

        // 2. Submission
        const submitRequest = new Request('http://localhost/api/congressional/submit', {
            method: 'POST',
            body: JSON.stringify({
                proof: 'mock-proof-hex',
                publicSignals: {
                    districtRoot: registerData.root,
                    nullifier: 'mock-nullifier-456'
                },
                encryptedWitness: 'mock-witness-base64',
                encryptedMessage: 'mock-message-base64',
                templateId: 'template-123',
                actionId: 'action-789'
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
            where: { user_id: 'test-user-id' }
        });
        expect(submission).toBeDefined();
        expect((submission as any)?.verification_status).toBe('verified');
        expect((submission as any)?.delivery_status).toBe('pending');
    });
});
