import { browser } from '$app/environment';

export interface GuestTemplateState {
	templateSlug: string;
	templateTitle: string;
	source: 'social-link' | 'direct-link' | 'share';
	timestamp: number;
	viewCount: number;
	address?: string;
}

// Guest state for pre-authentication template interactions
function createGuestState() {
	let state = $state<GuestTemplateState | null>(null);

	return {
		get state() {
			return state;
		},

		// Store template interaction for guest users
		setTemplate(
			slug: string,
			title: string,
			source: GuestTemplateState['source'] = 'direct-link'
		): void {
			const newState: GuestTemplateState = {
				templateSlug: slug,
				templateTitle: title,
				source,
				timestamp: Date.now(),
				viewCount: 1
			};

			state = newState;

			// Persist to localStorage for cross-session continuity
			if (browser) {
				localStorage.setItem('communique_guest_template', JSON.stringify(newState));
			}
		},

		// Store address for ZKP flow (client-side only)
		setAddress(address: string): void {
			if (!state) return;

			const updated = { ...state, address };
			state = updated;

			if (browser) {
				localStorage.setItem('communique_guest_template', JSON.stringify(updated));
			}
		},

		// Track repeat views for engagement scoring
		incrementView(): void {
			if (!state) return;

			const updated = { ...state, viewCount: state.viewCount + 1 };
			state = updated;

			if (browser) {
				localStorage.setItem('communique_guest_template', JSON.stringify(updated));
			}
		},

		// Clear after successful conversion
		clear(): void {
			state = null;
			if (browser) {
				localStorage.removeItem('communique_guest_template');
			}
		},

		// Restore from localStorage on app load
		restore(): void {
			if (browser) {
				const stored = localStorage.getItem('communique_guest_template');
				if (stored) {
					try {
						const parsedState = JSON.parse(stored);
						// Only restore if within 7 days
						if (Date.now() - parsedState.timestamp < 7 * 24 * 60 * 60 * 1000) {
							state = parsedState;
						} else {
							localStorage.removeItem('communique_guest_template');
						}
					} catch {
						localStorage.removeItem('communique_guest_template');
					}
				}
			}
		}
	};
}

export const guestState = createGuestState();

// Auto-restore on app load
if (browser) {
	guestState.restore();
}
