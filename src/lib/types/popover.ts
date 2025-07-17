export type TriggerAction = (node: HTMLElement) => {
    destroy: () => void;
};

export interface PopoverSlots {
    trigger: {
        triggerAction: TriggerAction;
    };
    default: {
        open: boolean;
    };
} 