import { describe, it, expect } from 'vitest';
import { resolveTemplate } from '$lib/utils/templateResolver';
import type { Template } from '$lib/types/template';

describe('templateResolver - Variable Resolution', () => {
    const mockTemplate: Template = {
        id: 'test-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'template',
        userId: 'user-1',
        slug: 'test-template',
        title: 'Test Template',
        description: 'Test description',
        category: 'test',
        deliveryMethod: 'email',
        subject: 'Important: [Name] needs your attention',
        preview: 'Dear [Representative Name],\n\nI am [Name] from [Address].\n\n[Personal Connection]\n\nSincerely,\n[Name]',
        message_body: 'Dear [Representative Name],\n\nI am [Name] from [Address].\n\n[Personal Connection]\n\nSincerely,\n[Name]',
        hashtags: '',
        recipient_config: JSON.stringify({ emails: ['test@example.com'] }),
        political_bias: 0,
        context_embedding: null,
        is_published: true,
        is_public: true
    };

    const mockUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        representatives: [
            {
                name: 'Nancy Pelosi',
                party: 'Democrat',
                chamber: 'house',
                state: 'CA',
                district: '11'
            },
            {
                name: 'Alex Padilla',
                party: 'Democrat',
                chamber: 'senate',
                state: 'CA',
                district: ''
            }
        ]
    };

    it('should resolve user name in template', () => {
        const resolved = resolveTemplate(mockTemplate, mockUser);
        
        expect(resolved.subject).toBe('Important: John Doe needs your attention');
        expect(resolved.body).toContain('I am John Doe');
        expect(resolved.body).toContain('Sincerely,\nJohn Doe');
    });

    it('should resolve user address in template', () => {
        const resolved = resolveTemplate(mockTemplate, mockUser);
        
        expect(resolved.body).toContain('I am John Doe from 123 Main St, San Francisco, CA 94105');
    });

    it('should resolve representative name for House member', () => {
        const resolved = resolveTemplate(mockTemplate, mockUser);
        
        expect(resolved.body).toContain('Dear Nancy Pelosi');
    });

    it('should remove Personal Connection placeholder line when not filled', () => {
        const resolved = resolveTemplate(mockTemplate, mockUser);
        
        // Personal Connection line should be completely removed
        expect(resolved.body).not.toContain('[Personal Connection]');
        // Verify the line is gone but other content remains
        expect(resolved.body).toContain('Dear Nancy Pelosi');
        expect(resolved.body).toContain('Sincerely,\nJohn Doe');
    });

    it('should extract correct recipients', () => {
        const resolved = resolveTemplate(mockTemplate, mockUser);
        
        expect(resolved.recipients).toEqual(['test@example.com']);
        expect(resolved.isCongressional).toBe(false);
    });

    it('should handle congressional template', () => {
        const congressionalTemplate = {
            ...mockTemplate,
            deliveryMethod: 'both'
        };
        
        const resolved = resolveTemplate(congressionalTemplate, mockUser);
        
        expect(resolved.isCongressional).toBe(true);
        expect(resolved.routingEmail).toBe('congress+test-1-user-1@communique.org');
    });

    it('should remove representative placeholders when user has no representatives', () => {
        const userNoReps = {
            ...mockUser,
            representatives: undefined
        };
        
        const resolved = resolveTemplate(mockTemplate, userNoReps);
        
        // Representative line should be removed entirely
        expect(resolved.body).not.toContain('[Representative Name]');
        expect(resolved.body).not.toContain('Dear your Representative');
        // The greeting line should be gone, leaving clean content
        const cleanBody = resolved.body.trim();
        expect(cleanBody).toContain('I am John Doe');
        expect(cleanBody).toContain('Sincerely,\nJohn Doe');
    });

    it('should handle null user gracefully', () => {
        const resolved = resolveTemplate(mockTemplate, null);
        
        expect(resolved.body).toContain('[Your Name]');
        expect(resolved.body).toContain('[Your Address]');
        expect(resolved.body).toContain('[Your Representative\'s Name]');
    });

    it('should handle senators in template', () => {
        const senatorTemplate = {
            ...mockTemplate,
            message_body: 'Dear [Senator Name],\n\nI am writing from [State].\n\nSincerely,\n[Name]'
        };
        
        const resolved = resolveTemplate(senatorTemplate, mockUser);
        
        expect(resolved.body).toContain('Dear Alex Padilla');
        expect(resolved.body).toContain('I am writing from CA');
    });

    it('should handle multiple placeholder types', () => {
        const complexTemplate = {
            ...mockTemplate,
            message_body: 'Dear [Representative],\n\nI am [Your Name] from [City], [State] [ZIP].\n\nSincerely,\n[Name]'
        };
        
        const resolved = resolveTemplate(complexTemplate, mockUser);
        
        expect(resolved.body).toContain('Dear Rep. Nancy Pelosi');
        expect(resolved.body).toContain('I am John Doe from San Francisco, CA 94105');
    });

    it('should remove address placeholders when user has incomplete address', () => {
        const userIncompleteAddress = {
            ...mockUser,
            street: null,
            zip: null
        };
        
        const resolved = resolveTemplate(mockTemplate, userIncompleteAddress);
        
        // Address should be removed since it's incomplete
        expect(resolved.body).not.toContain('[Address]');
        expect(resolved.body).not.toContain('from ,');
        // Should have clean output without address
        expect(resolved.body).toContain('I am John Doe');
        expect(resolved.body).not.toContain('I am John Doe from');
    });

    it('should clean up multiple newlines after removing placeholders', () => {
        const templateWithGaps = {
            ...mockTemplate,
            message_body: 'Dear [Representative Name],\n\n[Personal Connection]\n\n[Your Story]\n\n[Phone Number]\n\nThank you.\n\nSincerely,\n[Name]'
        };
        
        const resolved = resolveTemplate(templateWithGaps, mockUser);
        
        // Should not have more than 2 consecutive newlines
        expect(resolved.body).not.toMatch(/\n{3,}/);
        // Should have clean structure
        expect(resolved.body).toBe('Dear Nancy Pelosi,\n\nThank you.\n\nSincerely,\nJohn Doe');
    });
});