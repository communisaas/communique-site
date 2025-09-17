/**
 * Global type definitions for test environment
 */

// Extend Window interface for analytics
declare global {
	interface Window {
		analytics?: {
			trackAuthCompleted?: (templateId: string, provider: string, userId: string) => void;
			trackTemplateUsed?: (templateId: string, deliveryMethod: string, userId: string) => void;
			trackTemplateView?: (templateId: string, source?: string) => void;
			trackOnboardingStarted?: (templateId: string) => void;
			trackSocialShare?: (templateId: string, platform: string) => void;
		};
	}

	// Playwright test global types
	namespace globalThis {
		var expect: any;
		var test: any;
		var describe: any;
	}
}

export {};