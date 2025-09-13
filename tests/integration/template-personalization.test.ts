import { describe, it, expect } from 'vitest';
import { resolveVariables } from '$lib/services/personalization';
import { userFactory, representativeFactory, templateFactory } from '../fixtures/factories';

describe('Template Personalization Integration', () => {
  it('should resolve user variables in template', async () => {
    const user = userFactory.build({
      overrides: {
        name: 'Jane Smith',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102'
      }
    });

    const template = 'Dear Representative, I am [Name] from [City], [State] [Zip]. Thank you.';
    
    const resolved = resolveVariables(template, user, undefined);
    
    expect(resolved).toBe('Dear Representative, I am Jane Smith from San Francisco, CA 94102. Thank you.');
  });

  it('should resolve representative variables in template', async () => {
    const user = userFactory.build();
    const representative = representativeFactory.build({
      overrides: {
        name: 'Nancy Pelosi',
        chamber: 'house',
        party: 'Democratic'
      }
    });

    const template = 'Dear [Representative Name], As a [Representative Party] representative...';
    
    const resolved = resolveVariables(template, user, representative);
    
    expect(resolved).toBe('Dear Nancy Pelosi, As a Democratic representative...');
  });

  it('should handle complex template with multiple variable types', async () => {
    const user = userFactory.build({
      overrides: {
        name: 'John Doe',
        city: 'Austin',
        state: 'TX',
        congressional_district: 'TX-35'
      }
    });

    const representative = representativeFactory.build({
      overrides: {
        name: 'Lloyd Doggett',
        chamber: 'house',
        party: 'Democratic'
      }
    });

    const template = templateFactory.build({
      overrides: {
        message_body: `Dear [Representative Name],

I am [Name], your constituent from [City], [State]. I live in district [Congressional District].

[Personal Connection]

As a [Representative Party] representative, I hope you will consider this important issue.

Sincerely,
[Name]
[City], [State]`
      }
    });

    const personalConnection = 'Climate change has directly affected my community through increased flooding.';
    const messageWithPersonalStory = template.message_body.replace('[Personal Connection]', personalConnection);
    
    const resolved = resolveVariables(messageWithPersonalStory, user, representative);
    
    expect(resolved).toContain('Dear Lloyd Doggett,');
    expect(resolved).toContain('I am John Doe, your constituent from Austin, TX');
    expect(resolved).toContain('I live in district TX-35');
    expect(resolved).toContain('Climate change has directly affected my community');
    expect(resolved).toContain('As a Democratic representative');
    expect(resolved).toContain('Sincerely,\nJohn Doe\nAustin, TX');
  });

  it('should handle missing variables gracefully', async () => {
    const user = userFactory.build({
      overrides: {
        name: 'Test User',
        city: undefined, // Missing city
        state: 'CA'
      }
    });

    const template = 'I am [Name] from [City], [State].';
    
    const resolved = resolveVariables(template, user, undefined);
    
    // Should handle missing city gracefully
    expect(resolved).toContain('I am Test User from');
    expect(resolved).toContain('CA');
  });

  it('should preserve formatting and spacing', async () => {
    const user = userFactory.build({
      overrides: {
        name: 'Alice Johnson'
      }
    });

    const representative = representativeFactory.build({
      overrides: {
        name: 'Senator Smith'
      }
    });

    const template = `Dear [Representative Name],

    I am [Name] and I write to you today about an important matter.
    
    Thank you for your time.
    
Sincerely,
[Name]`;
    
    const resolved = resolveVariables(template, user, representative);
    
    expect(resolved).toBe(`Dear Senator Smith,

    I am Alice Johnson and I write to you today about an important matter.
    
    Thank you for your time.
    
Sincerely,
Alice Johnson`);
  });

  it('should handle special characters in variable values', async () => {
    const user = userFactory.build({
      overrides: {
        name: "O'Connor-Smith", // Apostrophe and hyphen
        city: 'São Paulo' // Non-ASCII characters
      }
    });

    const template = 'I am [Name] from [City].';
    
    const resolved = resolveVariables(template, user, undefined);
    
    expect(resolved).toBe("I am O'Connor-Smith from São Paulo.");
  });

  it('should handle nested bracket scenarios', async () => {
    const user = userFactory.build({
      overrides: {
        name: 'Test User'
      }
    });

    // Template with brackets that aren't variables
    const template = 'Dear Representative, I am [Name]. Please consider [this important issue].';
    
    const resolved = resolveVariables(template, user, undefined);
    
    expect(resolved).toBe('Dear Representative, I am Test User. Please consider [this important issue].');
  });

  it('should handle case sensitivity correctly', async () => {
    const user = userFactory.build({
      overrides: {
        name: 'Jane Doe'
      }
    });

    const template = 'I am [Name] and [name] and [NAME].';
    
    const resolved = resolveVariables(template, user, undefined);
    
    // Only exact case matches should be replaced
    expect(resolved).toBe('I am Jane Doe and [name] and [NAME].');
  });

  it('should support template inheritance and overrides', async () => {
    const baseUser = userFactory.build();
    const childUser = { ...baseUser, name: 'Override Name' };

    const template = 'Hello [Name]!';
    
    const baseResolved = resolveVariables(template, baseUser, null);
    const childResolved = resolveVariables(template, childUser, null);
    
    expect(baseResolved).not.toBe(childResolved);
    expect(childResolved).toBe('Hello Override Name!');
  });
});