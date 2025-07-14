import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface GuestTemplateState {
	templateSlug: string;
	templateTitle: string;
	source: 'social-link' | 'direct-link' | 'share';
	timestamp: number;
	viewCount: number;
}

// Guest state for pre-authentication template interactions
function createGuestState() {
	const { subscribe, set, update } = writable<GuestTemplateState | null>(null);

	return {
		subscribe,
		
		// Store template interaction for guest users
		setTemplate: (slug: string, title: string, source: GuestTemplateState['source'] = 'direct-link') => {
			const state: GuestTemplateState = {
				templateSlug: slug,
				templateTitle: title,
				source,
				timestamp: Date.now(),
				viewCount: 1
			};
			
			set(state);
			
			// Persist to localStorage for cross-session continuity
			if (browser) {
				localStorage.setItem('communique_guest_template', JSON.stringify(state));
			}
		},
		
		// Track repeat views for engagement scoring
		incrementView: () => {
			update(state => {
				if (!state) return null;
				const updated = { ...state, viewCount: state.viewCount + 1 };
				
				if (browser) {
					localStorage.setItem('communique_guest_template', JSON.stringify(updated));
				}
				
				return updated;
			});
		},
		
		// Clear after successful conversion
		clear: () => {
			set(null);
			if (browser) {
				localStorage.removeItem('communique_guest_template');
			}
		},
		
		// Restore from localStorage on app load
		restore: () => {
			if (browser) {
				const stored = localStorage.getItem('communique_guest_template');
				if (stored) {
					try {
						const state = JSON.parse(stored);
						// Only restore if within 7 days
						if (Date.now() - state.timestamp < 7 * 24 * 60 * 60 * 1000) {
							set(state);
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