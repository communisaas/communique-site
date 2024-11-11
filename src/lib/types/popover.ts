export type TriggerAction = (node: HTMLElement) => {
    destroy: () => void;
};

export interface PopoverSlots {
    trigger: {
        trigger: TriggerAction;
        'aria-controls': string;
    };
    default: {
        open: boolean;
    };
} 