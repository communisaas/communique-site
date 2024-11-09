type Metrics = {
    messages: string;
    districts?: string;  // Optional since direct types don't have this
    tooltip: string;
    verification?: string;  // Optional since direct types don't have this
    reach: string;
    target?: string;  // Optional since certified types don't have this
};

export type Template = {
    id: number;
    title: string;
    description: string;
    category: string;
    type: 'certified' | 'direct';
    deliveryMethod: string;
    metrics: Metrics;
    preview: string;
    recipientEmails?: string[];  // New field for direct templates
}; 