import { supportedIACAStates } from '$lib/core/identity/iaca-roots';

export function load() {
	return {
		supportedStates: supportedIACAStates(),
	};
}
