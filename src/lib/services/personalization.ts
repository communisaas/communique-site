import type { User, representative } from '@prisma/client';

// Define a map of variables and their resolution logic
const variableMap: Record<string, (user: User, rep?: representative) => string> = {
    '[Name]': (user) => user.name || '',
    '[Address]': (user) => [user.street, user.city, user.state, user.zip].filter(Boolean).join(', ') || '',
    '[Representative Name]': (user, rep) => rep?.name || '',
    '[Personal Connection]': () => '' // This is user-defined and should be in the body already
};

/**
 * Resolves variables in the email body.
 * 
 * @param body The email body with unresolved variables
 * @param user The user sending the email
 * @param rep The representative receiving the email
 * @returns The email body with all variables resolved
 */
export function resolveVariables(body: string, user: User, rep?: Representative): string {
	let resolvedBody = body;

	// Handle resolved variables
	for (const [variable, resolver] of Object.entries(variableMap)) {
		const value = resolver(user, rep);
		const escapedVar = escapeRegExp(variable);

		// Regex for a variable on a line by itself (a "block")
		const blockRegex = new RegExp(`^[ \t]*${escapedVar}[ \t]*\\r?\\n`, 'gm');
		// Regex for an inline variable
		const inlineRegex = new RegExp(escapedVar, 'g');

		if (value) {
			// If there's a value, just do a simple inline replacement
			resolvedBody = resolvedBody.replace(inlineRegex, value);
		} else {
			// If the value is empty, we first try to remove it as a block.
			const newBody = resolvedBody.replace(blockRegex, '');
			if (resolvedBody.length !== newBody.length) {
				// The block was successfully removed.
				resolvedBody = newBody;
			} else {
				// Block removal didn't happen, so it must be an inline variable.
				resolvedBody = resolvedBody.replace(inlineRegex, '');
			}
		}
	}

	// Remove any unresolved variables that are on their own lines
	const unresolvedBlockRegex = new RegExp(`^[ \t]*\\[.*?\\][ \t]*\\r?\\n`, 'gm');
	resolvedBody = resolvedBody.replace(unresolvedBlockRegex, '');

	// Remove any remaining inline unresolved variables
	const unresolvedInlineRegex = new RegExp(`\\[.*?\\]`, 'g');
	resolvedBody = resolvedBody.replace(unresolvedInlineRegex, '');


	// Clean up any extra newlines that might result from empty variables
	resolvedBody = resolvedBody.replace(/\n{3,}/g, '\n\n');

	return resolvedBody.trim();
}

/**
 * Escapes special characters in a string for use in a regular expression.
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
} 