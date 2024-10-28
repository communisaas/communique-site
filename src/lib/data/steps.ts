import { Users, Mail, Globe } from 'lucide-svelte';
import type { ComponentType } from 'svelte';

interface Step {
    icon: ComponentType;
    title: string;
    desc: string;
}

export const steps: Step[] = [
    {
        icon: Users,
        title: "Choose Your Audience",
        desc: "Connect with Congress, local officials, or other decision makers"
    },
    {
        icon: Mail,
        title: "Customize Your Message", 
        desc: "Use proven templates or write your own"
    },
    {
        icon: Globe,
        title: "Be Heard",
        desc: "Send through verified channels or direct email"
    }
];
