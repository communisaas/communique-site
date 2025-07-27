export interface UserAddress {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    congressional_district?: string;
}

export interface UserProfile {
    id: string;
    name?: string;
    email: string;
    avatar?: string;
    phone?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserLocation {
    id: string;
    user_id: string;
    latitude?: number;
    longitude?: number;
    political_embedding?: unknown;
    community_sheaves?: unknown;
    embedding_version?: string;
    last_calculated?: Date;
}

export interface Representative {
    id: string;
    name: string;
    title: string;
    district?: string;
    state: string;
    party?: string;
    office?: string;
    phone?: string;
    email?: string;
    website?: string;
}