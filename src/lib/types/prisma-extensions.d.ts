import type {
	template_campaign as TemplateCampaign,
	analytics_event as AnalyticsEvent,
	user_session as _UserSession,
	user_representatives as _UserRepresentatives,
	_representative as _Representative
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

	interface UserSession {
		analytics_events?: AnalyticsEvent[];
		page_views?: number;
		events_count?: number;
	}
}

// Export empty object to make this a module
export {};
