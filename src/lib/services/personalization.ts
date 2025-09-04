/**
 * Template personalization service
 * Handles variable resolution in template messages
 */

export interface PersonalizationContext {
  user: {
    name: string;
    city?: string;
    state?: string;
    zip?: string;
    address?: string;
    congressional_district?: string;
  };
  representative?: {
    name: string;
    title?: string;
    office?: string;
    party?: string;
    chamber?: string;
  };
  template: {
    message_body: string;
  };
}

/**
 * Resolves template variables with user and representative data
 */
export function resolveVariables(
  template: string,
  user: PersonalizationContext['user'],
  representative?: PersonalizationContext['representative']
): string {
  let resolved = template;

  // Replace user variables
  if (user.name) {
    resolved = resolved.replace(/\[Name\]/g, user.name);
  }
  if (user.city) {
    resolved = resolved.replace(/\[City\]/g, user.city);
  }
  if (user.state) {
    resolved = resolved.replace(/\[State\]/g, user.state);
  }
  if (user.zip) {
    resolved = resolved.replace(/\[Zip\]/g, user.zip);
  }
  if (user.address) {
    resolved = resolved.replace(/\[Address\]/g, user.address);
  }
  if (user.congressional_district) {
    resolved = resolved.replace(/\[Congressional District\]/g, user.congressional_district);
  }

  // Replace representative variables
  if (representative?.name) {
    resolved = resolved.replace(/\[Representative Name\]/g, representative.name);
  }
  if (representative?.title) {
    resolved = resolved.replace(/\[Representative Title\]/g, representative.title);
  }
  if (representative?.party) {
    resolved = resolved.replace(/\[Representative Party\]/g, representative.party);
  }

  return resolved;
}