export interface Template {
    id: string;
    title: string;
    description: string;
    category: string;
    type: string;
    deliveryMethod: 'email' | 'both';
    subject?: string;
    message_body: string;
    metrics: {
        sent: number;
        opened: number;
        clicked: number;
        responded: number;
    };
    delivery_config: any;
    recipient_config: any;
    preview: string;
    recipientEmails?: string[]; // For backward compatibility
    is_public: boolean;
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
        recipientEmails: string[];
    };
    content: {
        preview: string;
        variables: string[];
    };
} 