export interface NormalizedAddress {
    countryCode: string; // ISO-3166-1 alpha-2
    admin1?: string; // state/province/region code or name
    admin2?: string; // county/prefecture/district
    admin3?: string; // city/municipality/ward
    locality?: string; // neighborhood/locality
    postalCode?: string;
    street?: string;
    latitude?: number;
    longitude?: number;
}

export interface GeoFence {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
}


