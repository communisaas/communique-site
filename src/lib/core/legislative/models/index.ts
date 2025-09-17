import type { JurisdictionType } from '../../../types/jurisdiction';

export interface Jurisdiction {
	id: string;
	country_code: string;
	type: JurisdictionType;
	name: string;
	parent_id?: string;
	external_ids?: Record<string, string>;
	geometry?: unknown;
}

export interface Office {
	id: string;
	jurisdiction_id: string;
	role: string;
	title: string;
	chamber?: string;
	level: 'national' | 'state' | 'provincial' | 'municipal' | 'district';
	contact_methods: ContactMethod[];
	delivery_config?: Record<string, unknown>;
	is_active: boolean;
	cwc_office_code?: string; // For CWC compatibility
	contact_emails?: string[]; // Legacy compatibility
	contact_phone?: string; // Legacy compatibility
}

export interface ContactMethod {
	type: 'email' | 'form' | 'api' | 'phone' | 'postal';
	value: string;
	metadata?: Record<string, unknown>;
}

export interface Representative {
	id: string;
	office_id: string;
	name: string;
	party?: string;
	bioguide_id?: string;
	external_ids?: Record<string, string>;
	term_start?: Date;
	term_end?: Date;
	is_current: boolean;
	title?: string; // For CWC adapter compatibility
}

export interface Chamber {
	id: string;
	jurisdiction_id: string;
	name: string;
	type: 'lower' | 'upper' | 'unicameral' | 'other';
	seat_count?: number;
	term_length?: number;
	external_ids?: Record<string, string>;
	code?: string; // For CWC adapter compatibility
	total_seats?: number; // For CWC adapter compatibility
}

export interface LegislativeSystem {
	country_code: string;
	name: string;
	type: 'parliamentary' | 'congressional' | 'hybrid' | 'other';
	chambers: Chamber[];
	primary_language?: string; // Make optional for compatibility
	supported_languages?: string[]; // Make optional for compatibility
	description?: string; // For CWC adapter compatibility
}

export interface DeliveryCapability {
	country_code?: string; // Make optional for compatibility
	methods?: ('email' | 'form' | 'api' | 'postal')[]; // Make optional for compatibility
	tier?: number; // 1=direct email, 2=form/api, 3=limited
	provider?: string;
	config?: Record<string, unknown>;
	// CWC-specific capabilities
	certified_delivery?: boolean;
	delivery_receipt?: boolean;
	bulk_delivery?: boolean;
	message_formatting?: string[];
	address_validation?: boolean;
	personalization?: boolean;
}
