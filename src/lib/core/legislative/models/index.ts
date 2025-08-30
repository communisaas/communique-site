export interface Jurisdiction {
    id: string;
    country_code: string;
    type: 'country' | 'state' | 'province' | 'region' | 'municipality' | 'district' | 'custom';
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
}

export interface Chamber {
    id: string;
    jurisdiction_id: string;
    name: string;
    type: 'lower' | 'upper' | 'unicameral' | 'other';
    seat_count?: number;
    term_length?: number;
    external_ids?: Record<string, string>;
}

export interface LegislativeSystem {
    country_code: string;
    name: string;
    type: 'parliamentary' | 'congressional' | 'hybrid' | 'other';
    chambers: Chamber[];
    primary_language: string;
    supported_languages: string[];
}

export interface DeliveryCapability {
    country_code: string;
    methods: ('email' | 'form' | 'api' | 'postal')[];
    tier: number; // 1=direct email, 2=form/api, 3=limited
    provider?: string;
    config?: Record<string, unknown>;
}