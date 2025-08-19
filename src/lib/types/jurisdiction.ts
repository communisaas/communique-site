import type { GeoFence } from './location';

export type JurisdictionType =
    | 'country'
    | 'state'
    | 'province'
    | 'region'
    | 'municipality'
    | 'city'
    | 'district'
    | 'ward'
    | 'custom';

export interface Jurisdiction {
    id: string;
    country_code: string;
    type: JurisdictionType;
    name?: string;
    admin1?: string;
    admin2?: string;
    admin3?: string;
    external_ids?: Record<string, string>;
    geometry?: GeoFence | unknown; // Allow server-provided GeoJSON
    created_at: string | Date;
    updated_at: string | Date;
}

export interface Office {
    id: string;
    jurisdiction_id: string;
    role: string; // e.g., representative, senator, mayor, councillor
    title?: string;
    chamber?: string;
    level?: 'national' | 'state' | 'provincial' | 'municipal' | 'district' | string;
    contact_emails?: string[];
    contact_phone?: string;
    cwc_office_code?: string;
    is_active: boolean;
    created_at: string | Date;
    updated_at: string | Date;
}

export type TemplateScopeMode = 'jurisdictions' | 'geofence' | 'user_home' | 'country';

export interface TemplateScope {
    id: string;
    template_id: string;
    mode: TemplateScopeMode;
    country_codes?: string[];
    jurisdiction_ids?: string[];
    geofence?: GeoFence | unknown;
    created_at: string | Date;
    updated_at: string | Date;
}


