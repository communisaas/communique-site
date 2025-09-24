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
	_representative?: {
		name: string;
		title?: string;
		office?: string;
		party?: string;
		chamber?: string;
		state?: string;
		district?: string;
	};
	template: {
		message_body: string;
	};
}

/**
 * Resolves template variables with user and _representative data
 */
export function resolveVariables(
	template: string,
	user: PersonalizationContext['user'],
	_representative?: PersonalizationContext['_representative']
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
		resolved = resolved.replace(/\[Address \]/g, user.address);
	}
	if (user.congressional_district) {
		resolved = resolved.replace(/\[Congressional District\]/g, user.congressional_district);
	}

	// Replace _representative variables
	if (_representative?.name) {
		resolved = resolved.replace(/\[Representative Name\]/g, _representative.name);
	}
	if (_representative?.title) {
		resolved = resolved.replace(/\[Representative Title\]/g, _representative.title);
	}
	if (_representative?.party) {
		resolved = resolved.replace(/\[Representative Party\]/g, _representative.party);
	}
	if (_representative?.state) {
		resolved = resolved.replace(/\[Representative State\]/g, _representative.state);
	}
	if (_representative?.district) {
		resolved = resolved.replace(/\[Representative District\]/g, _representative.district);
	}
	if (_representative?.chamber) {
		resolved = resolved.replace(/\[Representative Chamber\]/g, _representative.chamber);
	}

	return resolved;
}
