export interface Template {
    id: string;
    slug?: string;
    title: string;
    description: string;
    category: string;
    type: string;
    deliveryMethod: 'email' | 'both';
    subject?: string;
    message_body: string;
    metrics: {
        sent: number;
        opened: number;          // Deprecated - not trackable for direct email
        clicked: number;         // For direct: recipient count; for congressional: not used
        responded: number;       // For congressional: delivery confirmations; for direct: not used
        views?: number;          // Number of times the template has been viewed via deep link
        // New congressional-specific metrics
        districts_covered?: number;      // Number of unique districts reached
        total_districts?: number;        // Total districts in the target area (for calculating coverage %)
        district_coverage_percent?: number; // Calculated: districts_covered / total_districts * 100
    };
    delivery_config: unknown;
    recipient_config: unknown;
    preview: string;
    recipientEmails?: string[]; // Computed field - use extractRecipientEmails(recipient_config) instead
    is_public: boolean;
}

export interface TemplateCreationContext {
    channelId: 'certified' | 'direct';
    channelTitle: string;
    features: Array<{
        icon: unknown;
        text: string;
    }>;
}

export interface TemplateFormData {
    objective: {
        title: string;
        description: string;
        category: string;
        goal: string;
        slug?: string;
    };
    audience: {
        recipientEmails: string[];
    };
    content: {
        preview: string;
        variables: string[];
    };
    review: Record<string, never>; // For validation purposes, no data to store
} 