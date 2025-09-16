import { Shield, UserCheck, CheckCircle2 } from '@lucide/svelte';
import type { Component } from 'svelte';

interface Benefit {
	icon: Component;
	title: string;
	description: string;
}

export const benefits: Benefit[] = [
	{
		icon: UserCheck,
		title: 'Government-Grade ID Verification',
		description: 'Every user verified through ID.me'
	},
	{
		icon: Shield,
		title: 'Real Voices Only',
		description: 'No bots, no spam, no fake accounts'
	},
	{
		icon: CheckCircle2,
		title: 'Message Authenticity',
		description: 'Every message tied to a verified identity'
	}
];
