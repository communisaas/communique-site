import { writable } from 'svelte/store';
import type { TemplateFormData } from '$lib/types/template';

interface DraftStorage {
	[key: string]: {
		data: TemplateFormData;
		lastSaved: number;
		currentStep: string;
	}
}

// Storage key for localStorage
const STORAGE_KEY = 'communique_template_drafts';

// Auto-save interval (30 seconds)
const AUTO_SAVE_INTERVAL = 30 * 1000;

function createTemplateDraftStore() {
	const { subscribe, set, update } = writable<DraftStorage>({});

	// Load drafts from localStorage on initialization
	function loadDrafts(): DraftStorage {
		if (typeof localStorage === 'undefined') return {};
		
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				// Clean up old drafts (older than 7 days)
				const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
				const cleaned = Object.fromEntries(
					Object.entries(parsed).filter(([_, draft]: [string, any]) => 
						draft.lastSaved > cutoff
					)
				);
				return cleaned;
			}
		} catch (error) {
			console.warn('Failed to load template drafts from storage:', error);
		}
		
		return {};
	}

	// Save drafts to localStorage
	function saveDrafts(drafts: DraftStorage) {
		if (typeof localStorage === 'undefined') return;
		
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
		} catch (error) {
			console.warn('Failed to save template drafts to storage:', error);
		}
	}

	// Initialize with stored data
	const initialDrafts = loadDrafts();
	set(initialDrafts);

	// Auto-save timer registry
	const autoSaveTimers = new Map<string, ReturnType<typeof setInterval>>();


	function toPlainTemplateFormData(data: TemplateFormData): TemplateFormData {
		// Create a plain, serializable copy detached from any reactive proxies
		return {
			objective: {
				title: data.objective?.title ?? '',
				description: data.objective?.description ?? '',
				category: data.objective?.category ?? '',
				slug: data.objective?.slug ?? ''
			},
			audience: {
				recipientEmails: Array.isArray(data.audience?.recipientEmails)
					? [...data.audience.recipientEmails]
					: []
			},
			content: {
				preview: data.content?.preview ?? '',
				variables: Array.isArray(data.content?.variables) ? [...data.content.variables] : []
			},
			review: {}
		};
	}

	function saveDraft(draftId: string, data: TemplateFormData, currentStep: string) {
		let plain: TemplateFormData;
		try {
			// Prefer a structuredClone of a plain object to avoid proxy issues
			plain = toPlainTemplateFormData(data);
			// Extra safety: ensure no reactive proxies sneak in
			plain = structuredClone(plain);
		} catch {
			// Fallback: JSON round-trip as a last resort
			plain = JSON.parse(JSON.stringify(toPlainTemplateFormData(data)));
		}

		const draft = {
			data: plain,
			lastSaved: Date.now(),
			currentStep
		};

		update(drafts => {
			const updated = { ...drafts, [draftId]: draft };
			saveDrafts(updated);
			return updated;
		});
	}

	function getDraft(draftId: string): { data: TemplateFormData; lastSaved: number; currentStep: string } | null {
		const drafts = loadDrafts();
		return drafts[draftId] || null;
	}

	function deleteDraft(draftId: string) {
		update(drafts => {
			const updated = { ...drafts };
			delete updated[draftId];
			saveDrafts(updated);
			
			// Clear any auto-save timer
			const timerId = autoSaveTimers.get(draftId);
			if (timerId) {
				clearInterval(timerId);
				autoSaveTimers.delete(draftId);
			}
			
			return updated;
		});
	}

	function startAutoSave(draftId: string, getFormData: () => TemplateFormData, getCurrentStep: () => string) {
		// Clear existing timer
		const existingTimer = autoSaveTimers.get(draftId);
		if (existingTimer) {
			clearInterval(existingTimer);
		}

		// Set up new auto-save timer
		const timerId = setInterval(() => {
			const formData = getFormData();
			const currentStep = getCurrentStep();
			
			// Only save if there's actual content
			if (formData.objective.title.trim() || formData.content.preview.trim()) {
				saveDraft(draftId, formData, currentStep);
			}
		}, AUTO_SAVE_INTERVAL);

		autoSaveTimers.set(draftId, timerId);
		
		// Cleanup function
		return () => {
			clearInterval(timerId);
			autoSaveTimers.delete(draftId);
		};
	}

	function hasDraft(draftId: string): boolean {
		const drafts = loadDrafts();
		return draftId in drafts;
	}

	function getDraftAge(draftId: string): number | null {
		const draft = getDraft(draftId);
		if (!draft) return null;
		return Date.now() - draft.lastSaved;
	}

	function getAllDraftIds(): string[] {
		const drafts = loadDrafts();
		return Object.keys(drafts);
	}

	return {
		subscribe,
		saveDraft,
		getDraft,
		deleteDraft,
		startAutoSave,
		hasDraft,
		getDraftAge,
		getAllDraftIds
	};
}

export const templateDraftStore = createTemplateDraftStore();

// Helper function to generate a draft ID for a new template
export function generateDraftId(): string {
	return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to format time ago
export function formatTimeAgo(timestamp: number): string {
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / (60 * 1000));
	const hours = Math.floor(diff / (60 * 60 * 1000));
	const days = Math.floor(diff / (24 * 60 * 60 * 1000));

	if (days > 0) {
		return `${days} day${days === 1 ? '' : 's'} ago`;
	} else if (hours > 0) {
		return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	} else if (minutes > 0) {
		return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	} else {
		return 'Just now';
	}
}