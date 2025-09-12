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
        title: "Pick Who Controls This",
        desc: "Congress, CEOs, school boards—they all count messages"
    },
    {
        icon: Mail,
        title: "Use What Works", 
        desc: "Templates that got responses, not theories"
    },
    {
        icon: Globe,
        title: "Track the Response",
        desc: "Watch coordination turn into meetings"
    }
];
