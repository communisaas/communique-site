import { browser } from '$app/environment';
import { z } from 'zod';

export interface GuestTemplateState {
	templateSlug: string;
	templateTitle: string;
	source: 'social-link' | 'direct-link' | 'share';
	timestamp: number;
	viewCount: number;
	address?: string;
}

// Zod schema for guest state validation
const GuestTemplateStateSchema = z.object({
	templateSlug: z.string(),
	templateTitle: z.string(),
	source: z.enum(['social-link', 'direct-link', 'share']),
	timestamp: z.number(),
	viewCount: z.number(),
	address: z.string().optional()
});

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
						const parsed = JSON.parse(stored);
						const result = GuestTemplateStateSchema.safeParse(parsed);

						if (result.success) {
							// Only restore if within 7 days
							if (Date.now() - result.data.timestamp < 7 * 24 * 60 * 60 * 1000) {
								state = result.data;
							} else {
								localStorage.removeItem('communique_guest_template');
							}
						} else {
							console.warn('[GuestState] Invalid stored state:', result.error.flatten());
							localStorage.removeItem('communique_guest_template');
						}
					} catch (error) {
						console.warn('[GuestState] Failed to parse stored state:', error);
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
