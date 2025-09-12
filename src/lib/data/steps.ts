import { Users, Mail, Globe } from '@lucide/svelte';
import type { Component } from 'svelte';

interface Step {
    icon: Component;
    title: string;
    desc: string;
}

export const steps: Step[] = [
    {
        icon: Users,
        title: "Pick the Decision-Maker",
        desc: "Who actually controls this? Congress, CEO, principal?"
    },
    {
        icon: Mail,
        title: "Load the Message", 
        desc: "Templates that already worked, or write your own"
    },
    {
        icon: Globe,
        title: "Watch It Work",
        desc: "Track opens, responses, and what changes"
    }
];
