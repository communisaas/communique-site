export interface Template {
    id: number;
    title: string;
    description: string;
    category: string;
    type: 'certified' | 'direct';
    deliveryMethod: string;
    metrics: {
        messages: string;
        reach: string;
        tooltip: string;
        target: string;
        districts?: string;    // For certified templates
        verification?: string; // For certified templates
    };
    preview: string;
    recipientEmails?: string[]; // For direct templates
}

export interface TemplateCreationContext {
    channelId: 'certified' | 'direct';
    channelTitle: string;
    features: Array<{
        icon: any;
        text: string;
    }>;
}

export interface TemplateFormData {
    objective: {
        title: string;
        description: string;
        category: string;
        goal: string;
    };
    audience: {
        organizations: string[];
        roles: string[];
        emailPatterns: string[];
    };
    content: {
        preview: string;
        variables: string[];
    };
} 