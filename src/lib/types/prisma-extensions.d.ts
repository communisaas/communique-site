import type {
	template_campaign as TemplateCampaign,
	analytics_event as AnalyticsEvent,
	user_session as UserSession,
	user_representatives as UserRepresentatives,
	representative as Representative
} from '@prisma/client';

declare module '@prisma/client' {
	interface template {
		template_campaign?: TemplateCampaign[];
		analytics_events?: AnalyticsEvent[];
	}

	interface user {
		coordinates?: unknown;
		preferences?: unknown;
	}

	interface user_session {
		analytics_events?: AnalyticsEvent[];
		page_views?: number;
		events_count?: number;
	}
}

// Export empty object to make this a module
export {};
